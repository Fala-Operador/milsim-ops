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
import { Preco } from "@/components/Preco";
import { MSG_SEM_RECEBIMENTO, taxaPlataforma } from "@/lib/repasses";
import { descontoDoBeneficio, descreverBeneficio, statusVoucher } from "@/lib/participacao";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Campo, SkeletonPagina } from "@/components/ui";
import { tr } from "@/i18n/routes/inscricao.$eventoId";
import { localeAtual } from "@/i18n/dicionario";

const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export const Route = createFileRoute("/inscricao/$eventoId")({
  validateSearch: (s: Record<string, unknown>): { cortesia: string | undefined; voucher: string | undefined; pagamento?: string | undefined; comunidade?: string | undefined } => ({
    cortesia: typeof s["cortesia"] === "string" ? s["cortesia"] : undefined,
    voucher: typeof s["voucher"] === "string" ? s["voucher"] : undefined,
    // Veio da comunidade sem ter acesso: explica que a comunidade é para inscritos.
    comunidade: s["comunidade"] === "1" || s["comunidade"] === 1 ? "1" : undefined,
    // Volta do checkout do Stripe sem pagar.
    pagamento: typeof s["pagamento"] === "string" ? s["pagamento"] : undefined,
  }),
  loader: async ({ params }) => {
    const { evento, pagamentoOnline, taxaCompradorPercentual, vendasAbertas } = await obterEventoFn({ data: { eventoId: params.eventoId } });
    if (!evento || evento.status !== "publicado") throw notFound();
    return { evento, pagamentoOnline, taxaCompradorPercentual, vendasAbertas };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: tr("inscricao_nome", { nome: loaderData.evento.nome }) },
          { name: "description", content: tr("confirme_sua_inscricao_no_evento") },
          { property: "og:title", content: tr("inscricao_nome", { nome: loaderData.evento.nome }) },
          { property: "og:description", content: tr("confirme_sua_inscricao_no_evento") },
        ]
      : [{ title: tr("inscricao_milsim_ops") }],
  }),
  pendingComponent: SkeletonPagina,
  component: PaginaInscricao,
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">{tr("inscricoes_indisponiveis")}</h1>
      <p className="mt-2 text-muted-foreground">{tr("este_evento_nao_esta_aberto_para")}</p>
    </div>
  ),
});

function PaginaInscricao() {
  const { evento: eventoCarregado, pagamentoOnline, taxaCompradorPercentual, vendasAbertas } = Route.useLoaderData();
  const evento = useEventoAtual(eventoCarregado);
  const { cortesia: codigoCortesia, voucher: voucherInicial, pagamento: retornoPagamento, comunidade: vemDaComunidade } = Route.useSearch();
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
  // Taxa de serviço somada no checkout (mesma conta do servidor na reserva).
  const taxaServico = vaiPagar ? taxaPlataforma(valorFinal, taxaCompradorPercentual) : 0;
  const reservaAberta = base.inscricoes.find(
    (i) => i.eventoId === evento.id && i.usuarioId === usuario?.id && i.pagamento?.status === "aguardando" && reservaVigente(i),
  );

  // Cadastro iniciado a partir do evento: preserva o destino e retorna após autenticação
  if (!usuario || !montado) {
    const destino = `/inscricao/${evento.id}${codigoCortesia ? `?cortesia=${codigoCortesia}` : ""}`;
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <h1 className="font-display text-xl font-semibold uppercase">{tr("entre_para_se_inscrever")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{tr("para_se_inscrever_em")}{" "}<strong>{evento.nome}</strong>{tr("entre_na_sua_conta_ou_conclua")}</p>
          <div className="mt-4 flex gap-2">
            <Link to="/login" search={{ redirect: destino }}>
              <Button>{tr("entrar")}</Button>
            </Link>
            <Link to="/cadastro" search={{ redirect: destino }}>
              <Button variant="outline">{tr("cadastrar")}</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const aoAplicarCupom = async () => {
    setErroCupom("");
    setAvisoCupom("");
    setCupomAplicado(null);
    if (!tipo) {
      setErroCupom(tr("selecione_o_tipo_de_ingresso_antes"));
      return;
    }
    try {
      // Validado no servidor: os códigos de cupom nunca são enviados ao navegador.
      const c = await previsualizarCupom(evento.id, cupom, tipo.id);
      setCupomAplicado({ codigo: c.codigo, percentual: c.descontoPercentual });
    } catch (err) {
      setErroCupom(err instanceof Error ? err.message : tr("nao_foi_possivel_validar_o_cupom"));
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
      setAvisoCupom(tr("cupom_removido_do_calculo", { motivo: err instanceof Error ? err.message : tr("nao_vale_para_este_ingresso") }));
    }
  };

  const impedimento = cortesia
    ? ""
    : !algumDisponivel
      ? tr("inscricoes_indisponiveis_no_momento_nao")
      : disp && !disp.disponivel
        ? tr("as_inscricoes_deste_ingresso_estao_indis", { valor: TEXTO_MOTIVO[disp.motivo] })
        : vaiPagar && !vendasAbertas
          ? MSG_SEM_RECEBIMENTO
          : "";

  const aoConfirmar = async () => {
    if (emAndamento.current || impedimento) return;
    setErro("");
    if (!tipoId || !exercitoId) {
      setErro(tr("selecione_o_tipo_de_ingresso_e"));
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
      setErro(err instanceof Error ? err.message : tr("falha_ao_confirmar_inscricao"));
      emAndamento.current = false;
      setConfirmando(false);
    }
  };

  const exercitoSel = evento.exercitos.find((x) => x.id === exercitoId);
  const inicio = new Date(evento.inicioEm);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:py-10">
      <nav aria-label={tr("breadcrumb")} className="rotulo-tecnico">
        <Link to="/" className="hover:text-foreground">{tr("operacoes")}</Link> /{" "}
        <Link to="/eventos/$eventoId" params={{ eventoId: evento.id }} className="hover:text-foreground">{evento.nome}</Link>{" "}{tr("inscricao")}</nav>
      <h1 className="titulo-pagina mt-2">{tr("garantir_vaga")}</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0 space-y-8">
          {vemDaComunidade && (
            <p role="status" className="border-l-2 border-accent bg-accent/5 px-4 py-3 text-sm">{tr("a_comunidade_desta_operacao_e_exclusiva")}</p>
          )}
          {cortesia && (
            <p className="border-l-2 border-accent bg-accent/5 px-4 py-3 text-sm">{tr("cortesia_para_nomeconvidado_o_resgate_de", { nomeConvidado: cortesia.nomeConvidado })}</p>
          )}
          {reservaAberta && (
            <div role="status" className="border-l-2 border-warning bg-warning/10 px-4 py-3 text-sm">
              <p className="font-medium text-warning">{retornoPagamento === "cancelado" ? tr("pagamento_nao_concluido") : tr("voce_tem_uma_reserva_aguardando_pagament")}</p>
              <p className="mt-0.5 text-muted-foreground">{tr("sua_vaga_fica_reservada_ate")}{" "}{new Date(reservaAberta.pagamento!.expiraEm).toLocaleTimeString(localeAtual(), { hour: "2-digit", minute: "2-digit" })}{tr("conclua_o_pagamento_em")}{" "}<Link to="/app/ingressos" className="underline">{tr("meus_ingressos")}</Link>{" "}{tr("ou_faca_uma_nova_inscricao_abaixo")}</p>
            </div>
          )}
          {!cortesia && !algumDisponivel && (
            <div role="status" className="border-l-2 border-warning bg-warning/10 px-4 py-3 text-sm">
              <p className="font-medium text-warning">{tr("inscricoes_indisponiveis_no_momento")}</p>
              <p className="mt-0.5 text-muted-foreground">
                {proximaAbertura ? tr("as_vendas_abrem_em_proximaabertura", { proximaAbertura: formatarDataBR(proximaAbertura) }) : tr("a_organizacao_ainda_nao_abriu_um")}
              </p>
            </div>
          )}

          <Etapa n={1} titulo={tr("ingresso")} detalhe={tipo && !cortesia ? tr("lote_vigente", { lote: lote ? lote.nome : tr("nenhum_lote_vigente") }) : undefined}>
            <RadioGroup value={tipoId} onValueChange={(v) => void aoTrocarTipo(v)} disabled={!!cortesia} aria-label={tr("tipo_de_ingresso")} className="grid gap-2 sm:grid-cols-2">
              {tiposAtivos.map((t) => {
                const d = disponibilidades.get(t.id)!;
                const off = !cortesia && !d.disponivel;
                return (
                  <Label key={t.id} htmlFor={`tipo-${t.id}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 font-normal transition-colors has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/5 ${off ? "cursor-not-allowed opacity-50" : "hover:bg-secondary/60"}`}>
                    <RadioGroupItem id={`tipo-${t.id}`} value={t.id} disabled={off} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.nome}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {cortesia ? tr("cortesia") : d.disponivel ? tr("disponivel") : tr("indisponivel_valorvalor2", { valor: TEXTO_MOTIVO[d.motivo], valor2: d.motivo === "agendado" && d.inicioVendas ? tr("abre_em", { data: formatarDataBR(d.inicioVendas) }) : "" })}
                      </span>
                    </span>
                    <span className="font-display text-2xl font-bold tabular-nums leading-none">{cortesia ? "—" : d.disponivel ? formatarBRL(d.precoCentavos) : "—"}</span>
                  </Label>
                );
              })}
            </RadioGroup>
          </Etapa>

          <Etapa n={2} titulo={tr("exercito")}>
            <RadioGroup value={exercitoId} onValueChange={setExercitoId} aria-label={tr("exercito")} className="grid gap-2 sm:grid-cols-2">
              {evento.exercitos.map((ex) => {
                const ocupadas = ocupacaoExercito(base, evento.id, ex.id);
                const livres = ex.capacidade - ocupadas;
                const pct = ex.capacidade > 0 ? Math.min(100, Math.round((ocupadas / ex.capacidade) * 100)) : 100;
                return (
                  <Label key={ex.id} htmlFor={`ex-${ex.id}`}
                    className={`flex cursor-pointer flex-col gap-3 rounded-md border p-4 font-normal transition-colors has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/5 ${livres <= 0 ? "cursor-not-allowed opacity-50" : "hover:bg-secondary/60"}`}>
                    <span className="flex items-center gap-3">
                      <RadioGroupItem id={`ex-${ex.id}`} value={ex.id} disabled={livres <= 0} />
                      <span className="flex-1 font-display text-xl font-bold uppercase leading-none">{ex.nome}</span>
                      <span className="font-mono text-xs text-muted-foreground">{livres > 0 ? tr("livres_vagas", { livres }) : tr("sem_vagas")}</span>
                    </span>
                    <span className="h-1 overflow-hidden rounded-full bg-secondary" aria-hidden><span className="block h-full bg-accent" style={{ width: `${pct}%` }} /></span>
                  </Label>
                );
              })}
            </RadioGroup>
          </Etapa>

          {!cortesia && (vouchers.length > 0 || !voucherId) && (
            <Etapa n={3} titulo={tr("desconto")} detalhe={tr("opcional")}>
              <div className="space-y-4">
                {vouchers.length > 0 && (
                  <Campo rotulo={tr("beneficio_de_recompensa")} htmlFor="voucher">
                    <NativeSelect id="voucher" value={voucherId} onChange={(e) => { setVoucherId(e.target.value); setCupomAplicado(null); }}>
                      <option value="">{tr("nao_usar_beneficio")}</option>
                      {vouchers.map((v) => (
                        <option key={v.id} value={v.id}>{tr("nome_beneficio_ate_resgatarate", { nome: v.beneficio.nome, beneficio: descreverBeneficio(v.beneficio), resgatarAte: formatarDataBR(v.beneficio.resgatarAte) })}</option>
                      ))}
                    </NativeSelect>
                    <p className="text-xs text-muted-foreground">{tr("o_beneficio_nao_reserva_vaga_e")}</p>
                    {voucher && tipo && !voucherServe && <p role="alert" className="text-sm text-destructive">{tr("este_beneficio_nao_vale_para_o")}</p>}
                  </Campo>
                )}
                {!voucherId && (
                  <Campo rotulo={tr("cupom")} htmlFor="cupom">
                    {cupomAplicado ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success" role="status">
                        <span><span className="font-mono font-semibold">{cupomAplicado.codigo}</span>{" "}{tr("aplicado_percentual_de_desconto", { percentual: cupomAplicado.percentual })}</span>
                        <Button type="button" variant="link" size="none" className="text-success" onClick={removerCupom}>{tr("remover")}</Button>
                      </div>
                    ) : (
                      <div className="flex max-w-md gap-2">
                        <Input id="cupom" value={cupom} onChange={(e) => { setCupom(e.target.value); setErroCupom(""); }} placeholder={tr("codigo")} aria-describedby="cupom-msg" className="font-mono uppercase" />
                        <Button type="button" variant="outline" onClick={aoAplicarCupom} disabled={!cupom.trim()}>{tr("aplicar")}</Button>
                      </div>
                    )}
                    <div id="cupom-msg">
                      {erroCupom && <p role="alert" className="text-sm text-destructive">{erroCupom}</p>}
                      {avisoCupom && <p role="status" className="text-sm text-warning">{avisoCupom}</p>}
                    </div>
                  </Campo>
                )}
              </div>
            </Etapa>
          )}
        </div>

        <aside aria-label={tr("resumo_do_pedido")} className="overflow-hidden rounded-lg border border-border lg:sticky lg:top-24">
          <div className="relative aspect-[16/9] bg-black text-white">
            {evento.imagemUrl && <img src={evento.imagemUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />}
            <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" aria-hidden />
            <span className="absolute inset-x-0 bottom-0 p-4">
              <span className="block font-mono text-[11px] uppercase tracking-wider text-white/75">{tr("inicioem_valorh_cidade_uf", { inicioEm: formatarDataBR(evento.inicioEm), valor: String(inicio.getHours()).padStart(2, "0"), cidade: evento.cidade, uf: evento.uf })}</span>
              <span className="mt-1 block font-display text-2xl font-bold uppercase leading-none">{evento.nome}</span>
            </span>
          </div>
          <div className="p-4">
            <p className="rotulo-tecnico">{tr("resumo")}</p>
            <dl className="mt-2 divide-y divide-border text-sm">
              <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">{tr("ingresso")}</dt><dd className="text-right">{tipo?.nome ?? "—"}</dd></div>
              {!cortesia && <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">{tr("lote")}</dt><dd className="text-right">{tipo ? lote?.nome ?? "—" : "—"}</dd></div>}
              <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">{tr("exercito")}</dt><dd className="text-right">{exercitoSel?.nome ?? "—"}</dd></div>
              <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">{tr("valor")}</dt><dd className="font-mono tabular-nums">{!tipo || impedimento ? "—" : <Preco centavos={preco} />}</dd></div>
              {tipo && !voucherId && cupomAplicado && !impedimento && (
                <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">{tr("cupom_codigo_percentual", { codigo: cupomAplicado.codigo, percentual: cupomAplicado.percentual })}</dt><dd className="font-mono tabular-nums text-success">−<Preco centavos={desconto} /></dd></div>
              )}
              {tipo && descontoVoucher > 0 && <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">{tr("beneficio")}</dt><dd className="font-mono tabular-nums text-success">−<Preco centavos={descontoVoucher} /></dd></div>}
              {tipo && !impedimento && taxaServico > 0 && (
                <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">{tr("taxa_de_servico_valor", { valor: String(taxaCompradorPercentual).replace(".", ",") })}</dt><dd className="font-mono tabular-nums">+<Preco centavos={taxaServico} /></dd></div>
              )}
            </dl>
            <div className="mt-2 flex items-end justify-between border-t border-border pt-3">
              <span className="text-sm font-medium">{taxaServico > 0 ? tr("total_a_pagar") : tr("valor_final")}</span>
              <span className="font-display text-4xl font-bold leading-none tabular-nums">
                {!tipo || impedimento ? "—" : <Preco centavos={valorFinal + (taxaServico > 0 ? taxaServico : 0)} />}
              </span>
            </div>
            {cortesia && <p className="mt-1 text-right text-xs text-muted-foreground">{tr("cortesia")}</p>}
            {tipo && !impedimento && !cortesia && preco > 0 && desconto >= preco && <p className="mt-1 text-right text-xs text-muted-foreground">{tr("inscricao_integralmente_descontada")}</p>}

            {impedimento && algumDisponivel && (
              <p role="alert" className="mt-3 border-l-2 border-warning bg-warning/10 px-3 py-2 text-sm text-warning">{impedimento}</p>
            )}
            {erro && <p role="alert" className="mt-3 border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

            <Button onClick={aoConfirmar} disabled={confirmando || !!impedimento} size="lg" className="mt-4 w-full">
              {confirmando ? (vaiPagar ? tr("abrindo_pagamento") : tr("confirmando")) : vaiPagar ? tr("ir_para_o_pagamento") : tr("confirmar_inscricao")}
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {pagamentoOnline
                ? tr("o_pagamento_e_feito_no_ambiente")
                : tr("a_plataforma_nao_processa_pagamentos_nao")}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Etapa({ n, titulo, detalhe, children }: { n: number; titulo: string; detalhe?: string | undefined; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`etapa-${n}`} className="grid gap-4 border-t border-border pt-6 sm:grid-cols-[56px_minmax(0,1fr)]">
      <span className="font-display text-4xl font-bold leading-none text-accent" aria-hidden>{String(n).padStart(2, "0")}</span>
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`etapa-${n}`} className="text-lg font-semibold">{titulo}</h2>
          {detalhe && <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{detalhe}</span>}
        </div>
        {children}
      </div>
    </section>
  );
}
