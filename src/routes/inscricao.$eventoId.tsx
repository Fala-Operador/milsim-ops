import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { carregarBase } from "@/services/db";
import { obterEventoFn } from "@/api/sessao.functions";
import { useEventoAtual } from "@/hooks/useEventoAtual";
import { registrarInicioInscricao } from "@/services/analytics";
import { disponibilidadeNaBase, ocupacaoExercito } from "@/services/inscricoes";
import { descontoCupom, TEXTO_MOTIVO } from "@/lib/vendas";
import { reservaVigente } from "@/lib/pagamentos";
import { confirmarInscricao, previsualizarCupom } from "@/api/inscricoes.functions";
import { useAuth } from "@/contexts/AuthContext";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { descontoDoBeneficio, descreverBeneficio, statusVoucher } from "@/lib/participacao";
import { Botao, Campo, Cartao, Entrada, Selecao, SkeletonPagina } from "@/components/ui";

const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export const Route = createFileRoute("/inscricao/$eventoId")({
  validateSearch: (s: Record<string, unknown>): { cortesia: string | undefined; voucher: string | undefined; pagamento?: string | undefined } => ({
    cortesia: typeof s["cortesia"] === "string" ? s["cortesia"] : undefined,
    voucher: typeof s["voucher"] === "string" ? s["voucher"] : undefined,
    // Volta do checkout do Stripe sem pagar.
    pagamento: typeof s["pagamento"] === "string" ? s["pagamento"] : undefined,
  }),
  loader: async ({ params }) => {
    const { evento, pagamentoOnline } = await obterEventoFn({ data: { eventoId: params.eventoId } });
    if (!evento || evento.status !== "publicado") throw notFound();
    return { evento, pagamentoOnline };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `Inscrição — ${loaderData.evento.nome}` },
          { name: "description", content: "Confirme sua inscrição no evento." },
          { property: "og:title", content: `Inscrição — ${loaderData.evento.nome}` },
          { property: "og:description", content: "Confirme sua inscrição no evento." },
        ]
      : [{ title: "Inscrição — MilSim Ops" }],
  }),
  pendingComponent: SkeletonPagina,
  component: PaginaInscricao,
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">Inscrições indisponíveis</h1>
      <p className="mt-2 text-muted-foreground">Este evento não está aberto para inscrições.</p>
    </div>
  ),
});

function PaginaInscricao() {
  const { evento: eventoCarregado, pagamentoOnline } = Route.useLoaderData();
  const evento = useEventoAtual(eventoCarregado);
  const { cortesia: codigoCortesia, voucher: voucherInicial, pagamento: retornoPagamento } = Route.useSearch();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const base = carregarBase();

  const cortesia = useMemo(
    () =>
      codigoCortesia
        ? base.cortesias.find((c) => c.codigo === codigoCortesia && c.eventoId === evento.id)
        : undefined,
    [codigoCortesia, base, evento.id],
  );

  const [tipoId, setTipoId] = useState(cortesia?.tipoId ?? "");
  const [exercitoId, setExercitoId] = useState(cortesia?.exercitoId ?? "");
  const [cupom, setCupom] = useState("");
  const [voucherId, setVoucherId] = useState(voucherInicial ?? "");
  // Cupom aplicado guarda só o percentual; o desconto é recalculado a cada troca de ingresso.
  const [cupomAplicado, setCupomAplicado] = useState<{ codigo: string; percentual: number } | null>(null);
  const [erroCupom, setErroCupom] = useState("");
  const [avisoCupom, setAvisoCupom] = useState("");
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const emAndamento = useRef(false); // impede duplicidade por cliques repetidos
  // Chave de idempotência da tentativa: se a resposta se perder e a pessoa reenviar, o
  // servidor devolve a mesma inscrição (e o mesmo checkout) em vez de criar outra.
  const clienteId = useRef(novoId());
  // O servidor não conhece a sessão guardada no navegador: só após montar decidimos
  // se mostramos o formulário ou o convite para entrar (evita divergência na hidratação).
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  // Início do fluxo só quando o formulário aparece (usuário logado, após montar).
  const formularioVisivel = montado && !!usuario;
  useEffect(() => {
    if (formularioVisivel) registrarInicioInscricao(evento.id);
  }, [formularioVisivel, evento.id]);

  const tiposAtivos = evento.tipos.filter((t) => !t.arquivado);
  const disponibilidades = new Map(tiposAtivos.map((t) => [t.id, disponibilidadeNaBase(base, evento, t.id)]));
  const algumDisponivel = [...disponibilidades.values()].some((d) => d.disponivel);
  const tipo = evento.tipos.find((t) => t.id === tipoId);
  const disp = tipo ? disponibilidades.get(tipo.id) : undefined;
  const lote = disp?.disponivel ? disp.lote : undefined;
  // Sem lote vigente não existe preço: nunca usamos o preço base como alternativa.
  const preco = cortesia ? 0 : disp?.disponivel ? disp.precoCentavos : 0;
  const desconto = cupomAplicado && !cortesia ? descontoCupom(preco, cupomAplicado.percentual) : 0;
  const proximaAbertura = [...disponibilidades.values()]
    .flatMap((d) => (!d.disponivel && d.motivo === "agendado" && d.inicioVendas ? [d.inicioVendas] : []))
    .sort()[0];

  // Benefícios de recompensa da própria conta válidos para este evento/ingresso.
  const vouchers = base.vouchers.filter(
    (v) => v.usuarioId === usuario?.id && statusVoucher(v) === "disponivel" && v.beneficio.eventosElegiveis.includes(evento.id),
  );
  const voucher = vouchers.find((v) => v.id === voucherId);
  const voucherServe = !!voucher && !!tipo && (!voucher.beneficio.tiposElegiveis.length || voucher.beneficio.tiposElegiveis.includes(tipo.id));
  const descontoVoucher = voucher && voucherServe ? descontoDoBeneficio(voucher.beneficio, preco) : 0;
  const valorFinal = Math.max(0, preco - (voucherId ? descontoVoucher : desconto));
  // Com o Stripe ativo, valor a pagar passa pelo checkout; cortesia e valor zerado confirmam direto.
  const vaiPagar = pagamentoOnline && !cortesia && !!tipo && valorFinal > 0;
  const reservaAberta = base.inscricoes.find(
    (i) => i.eventoId === evento.id && i.usuarioId === usuario?.id && i.pagamento?.status === "aguardando" && reservaVigente(i),
  );

  // Cadastro iniciado a partir do evento: preserva o destino e retorna após autenticação
  if (!usuario || !montado) {
    const destino = `/inscricao/${evento.id}${codigoCortesia ? `?cortesia=${codigoCortesia}` : ""}`;
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Cartao>
          <h1 className="font-display text-xl font-semibold uppercase">Entre para se inscrever</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Para se inscrever em <strong>{evento.nome}</strong>, entre na sua conta ou conclua o
            cadastro. Você voltará automaticamente para esta inscrição.
          </p>
          <div className="mt-4 flex gap-2">
            <Link to="/login" search={{ redirect: destino }}>
              <Botao>Entrar</Botao>
            </Link>
            <Link to="/cadastro" search={{ redirect: destino }}>
              <Botao variante="contorno">Cadastrar</Botao>
            </Link>
          </div>
        </Cartao>
      </div>
    );
  }

  const aoAplicarCupom = async () => {
    setErroCupom("");
    setAvisoCupom("");
    setCupomAplicado(null);
    if (!tipo) {
      setErroCupom("Selecione o tipo de ingresso antes do cupom.");
      return;
    }
    try {
      // Validado no servidor: os códigos de cupom nunca são enviados ao navegador.
      const c = await previsualizarCupom(evento.id, cupom, tipo.id);
      setCupomAplicado({ codigo: c.codigo, percentual: c.descontoPercentual });
    } catch (err) {
      setErroCupom(err instanceof Error ? err.message : "Não foi possível validar o cupom.");
    }
  };

  const removerCupom = () => { setCupomAplicado(null); setCupom(""); setErroCupom(""); setAvisoCupom(""); };

  // Troca de ingresso: revalida o cupom aplicado para o novo tipo.
  const aoTrocarTipo = async (novo: string) => {
    setTipoId(novo);
    setErro("");
    if (!cupomAplicado) return;
    try {
      const c = await previsualizarCupom(evento.id, cupomAplicado.codigo, novo);
      setCupomAplicado({ codigo: c.codigo, percentual: c.descontoPercentual });
      setAvisoCupom("");
    } catch (err) {
      setCupomAplicado(null);
      setAvisoCupom(`Cupom removido do cálculo: ${err instanceof Error ? err.message : "não vale para este ingresso."}`);
    }
  };

  const impedimento = cortesia
    ? ""
    : !algumDisponivel
      ? "Inscrições indisponíveis no momento: não há lote de venda vigente para nenhum ingresso."
      : disp && !disp.disponivel
        ? `As inscrições deste ingresso estão indisponíveis porque ${TEXTO_MOTIVO[disp.motivo]}.`
        : "";

  const aoConfirmar = async () => {
    if (emAndamento.current || impedimento) return;
    setErro("");
    if (!tipoId || !exercitoId) {
      setErro("Selecione o tipo de ingresso e o exército.");
      return;
    }
    emAndamento.current = true;
    setConfirmando(true);
    try {
      const r = await confirmarInscricao({
        eventoId: evento.id,
        tipoId,
        exercitoId,
        codigoCupom: !voucherId && cupomAplicado ? cupomAplicado.codigo : undefined,
        cortesiaId: cortesia?.id,
        voucherId: voucherId || undefined,
        clienteId: clienteId.current,
      });
      // Reserva criada: segue para a página de pagamento do Stripe.
      if (r.urlPagamento) window.location.assign(r.urlPagamento);
      else navigate({ to: "/app/ingressos" });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao confirmar inscrição.");
      emAndamento.current = false;
      setConfirmando(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">Eventos</Link> /{" "}
        <Link to="/eventos/$eventoId" params={{ eventoId: evento.id }} className="hover:underline">{evento.nome}</Link>{" "}
        / Inscrição
      </nav>
      <Cartao className="mt-3">
        <h1 className="font-display text-2xl font-semibold uppercase">Inscrição — {evento.nome}</h1>
        {cortesia && (
          <p className="mt-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
            Cortesia para {cortesia.nomeConvidado}. O resgate depende de disponibilidade e não
            aceita cupom adicional.
          </p>
        )}

        <div className="mt-5 space-y-4">
          {reservaAberta && (
            <div role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
              <p className="font-medium">{retornoPagamento === "cancelado" ? "Pagamento não concluído" : "Você tem uma reserva aguardando pagamento"}</p>
              <p className="text-xs">
                Sua vaga fica reservada até {new Date(reservaAberta.pagamento!.expiraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
                Conclua o pagamento em <Link to="/app/ingressos" className="underline">Meus ingressos</Link> ou faça uma nova inscrição abaixo (a reserva anterior é substituída).
              </p>
            </div>
          )}
          {!cortesia && !algumDisponivel && (
            <div role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
              <p className="font-medium">Inscrições indisponíveis no momento</p>
              <p className="text-xs">
                {proximaAbertura ? `As vendas abrem em ${formatarDataBR(proximaAbertura)}.` : "A organização ainda não abriu um lote de venda para esta operação."}
              </p>
            </div>
          )}

          <Campo rotulo="1. Tipo de ingresso" htmlFor="tipo">
            <Selecao id="tipo" value={tipoId} onChange={(e) => aoTrocarTipo(e.target.value)} disabled={!!cortesia}>
              <option value="">Selecione</option>
              {tiposAtivos.map((t) => {
                const d = disponibilidades.get(t.id)!;
                return (
                  <option key={t.id} value={t.id} disabled={!cortesia && !d.disponivel}>
                    {t.nome} — {cortesia ? "cortesia" : d.disponivel ? formatarBRL(d.precoCentavos) : `indisponível (${TEXTO_MOTIVO[d.motivo]}${d.motivo === "agendado" && d.inicioVendas ? `, abre em ${formatarDataBR(d.inicioVendas)}` : ""})`}
                  </option>
                );
              })}
            </Selecao>
          </Campo>

          {tipo && !cortesia && (
            <p className="text-sm text-muted-foreground">
              2. Lote vigente: <strong>{lote ? lote.nome : "nenhum lote vigente"}</strong>
            </p>
          )}

          <Campo rotulo="3. Exército" htmlFor="exercito">
            <Selecao id="exercito" value={exercitoId} onChange={(e) => setExercitoId(e.target.value)}>
              <option value="">Selecione</option>
              {evento.exercitos.map((ex) => {
                const livres = ex.capacidade - ocupacaoExercito(base, evento.id, ex.id);
                return (
                  <option key={ex.id} value={ex.id} disabled={livres <= 0}>
                    {ex.nome} — {livres > 0 ? `${livres} vagas` : "sem vagas"}
                  </option>
                );
              })}
            </Selecao>
          </Campo>

          {!cortesia && vouchers.length > 0 && (
            <Campo rotulo="Benefício de recompensa (opcional)" htmlFor="voucher">
              <Selecao id="voucher" value={voucherId} onChange={(e) => { setVoucherId(e.target.value); setCupomAplicado(null); }}>
                <option value="">Não usar benefício</option>
                {vouchers.map((v) => (
                  <option key={v.id} value={v.id}>{v.beneficio.nome} — {descreverBeneficio(v.beneficio)} (até {formatarDataBR(v.beneficio.resgatarAte)})</option>
                ))}
              </Selecao>
              <p className="text-xs text-muted-foreground">O benefício não reserva vaga e não acumula com cupom. Ele só é consumido quando a inscrição for confirmada.</p>
              {voucher && tipo && !voucherServe && <p role="alert" className="text-sm text-destructive">Este benefício não vale para o ingresso escolhido.</p>}
            </Campo>
          )}

          {!cortesia && !voucherId && (
            <Campo rotulo="4. Cupom (opcional)" htmlFor="cupom">
              {cupomAplicado ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success" role="status">
                  <span>{cupomAplicado.codigo} aplicado: {cupomAplicado.percentual}% de desconto.</span>
                  <Botao type="button" variante="fantasma" onClick={removerCupom}>Remover cupom</Botao>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Entrada id="cupom" value={cupom} onChange={(e) => { setCupom(e.target.value); setErroCupom(""); }} placeholder="CODIGO" aria-describedby="cupom-msg" />
                  <Botao type="button" variante="contorno" onClick={aoAplicarCupom} disabled={!cupom.trim()}>Aplicar</Botao>
                </div>
              )}
              <div id="cupom-msg">
                {erroCupom && <p role="alert" className="text-sm text-destructive">{erroCupom}</p>}
                {avisoCupom && <p role="status" className="text-sm text-warning">{avisoCupom}</p>}
              </div>
            </Campo>
          )}

          {tipo && (
            <div className="rounded-md border border-border bg-elevated p-4 text-sm">
              <p className="font-medium">5. Revisão</p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted-foreground">
                <dt>Evento</dt><dd className="text-right text-foreground">{evento.nome}</dd>
                <dt>Ingresso</dt><dd className="text-right text-foreground">{tipo.nome}</dd>
                {!cortesia && <><dt>Lote</dt><dd className="text-right text-foreground">{lote?.nome ?? "—"}</dd></>}
                <dt>Exército</dt><dd className="text-right text-foreground">{evento.exercitos.find((x) => x.id === exercitoId)?.nome ?? "—"}</dd>
                <dt>Valor original</dt><dd className="text-right font-mono">{impedimento ? "—" : formatarBRL(preco)}</dd>
                {!voucherId && cupomAplicado && !impedimento && (
                  <><dt>Cupom {cupomAplicado.codigo} ({cupomAplicado.percentual}%)</dt><dd className="text-right font-mono">−{formatarBRL(desconto)}</dd></>
                )}
                {descontoVoucher > 0 && <><dt>Benefício de recompensa</dt><dd className="text-right font-mono">−{formatarBRL(descontoVoucher)}</dd></>}
                <dt className="font-medium text-foreground">Valor final</dt>
                <dd className="text-right font-mono font-medium text-foreground">
                  {impedimento ? "—" : formatarBRL(valorFinal)}
                  {cortesia && " (cortesia)"}
                </dd>
              </dl>
              {!impedimento && !cortesia && preco > 0 && desconto >= preco && <p className="mt-1 text-xs">Inscrição integralmente descontada.</p>}
            </div>
          )}

          {impedimento && algumDisponivel && (
            <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">{impedimento}</p>
          )}
          {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

          <Botao onClick={aoConfirmar} disabled={confirmando || !!impedimento} className="w-full">
            {confirmando ? (vaiPagar ? "Abrindo pagamento..." : "Confirmando...") : vaiPagar ? "Ir para o pagamento" : "Confirmar inscrição"}
          </Botao>
          <p className="text-center text-xs text-muted-foreground">
            {pagamentoOnline
              ? "O pagamento é feito no ambiente seguro do Stripe; a plataforma não recebe nem guarda dados do seu cartão. A vaga fica reservada por cerca de 30 minutos enquanto você paga."
              : "A plataforma não processa pagamentos: não pedimos cartão, PIX ou dados de pagamento."}
          </p>
        </div>
      </Cartao>
    </div>
  );
}
