import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { carregarBase } from "@/services/db";
import {
  confirmarInscricao,
  validarCupom,
  loteVigente,
  ocupacaoExercito,
} from "@/services/inscricoes";
import { useAuth } from "@/contexts/AuthContext";
import { formatarBRL } from "@/lib/domain/money";
import { Botao, Campo, Cartao, Entrada, Selecao, SkeletonPagina } from "@/components/ui";

export const Route = createFileRoute("/inscricao/$eventoId")({
  validateSearch: (s: Record<string, unknown>) => ({
    cortesia: typeof s["cortesia"] === "string" ? s["cortesia"] : undefined,
  }),
  loader: ({ params }) => {
    const base = carregarBase();
    const evento = base.eventos.find((e) => e.id === params.eventoId);
    if (!evento || evento.status !== "publicado") throw notFound();
    return { evento };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `Inscrição — ${loaderData.evento.nome}` },
          { name: "description", content: "Confirmação de inscrição simulada. Nenhuma cobrança será feita." },
          { property: "og:title", content: `Inscrição — ${loaderData.evento.nome}` },
          { property: "og:description", content: "Inscrição simulada, sem cobrança." },
        ]
      : [{ title: "Inscrição — MilSim Ops" }],
  }),
  component: PaginaInscricao,
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">Inscrições indisponíveis</h1>
      <p className="mt-2 text-muted-foreground">Este evento não está aberto para inscrições.</p>
    </div>
  ),
});

function PaginaInscricao() {
  const { evento } = Route.useLoaderData();
  const { cortesia: codigoCortesia } = Route.useSearch();
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
  const [desconto, setDesconto] = useState(0);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const emAndamento = useRef(false); // impede duplicidade por cliques repetidos

  const tipo = evento.tipos.find((t) => t.id === tipoId);
  const lote = tipo ? loteVigente(evento, tipo.id) : undefined;
  const preco = cortesia
    ? 0
    : (lote?.itens.find((i) => i.tipoId === tipoId)?.precoCentavos ?? tipo?.precoBaseCentavos ?? 0);

  // Cadastro iniciado a partir do evento: preserva o destino e retorna após autenticação
  if (!usuario) {
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

  const aoAplicarCupom = () => {
    setErro("");
    setOk("");
    setDesconto(0);
    if (!tipo) {
      setErro("Selecione o tipo de ingresso antes do cupom.");
      return;
    }
    try {
      const c = validarCupom(base, evento.id, cupom, tipo.id);
      const d = Math.round((preco * c.descontoPercentual) / 100);
      setDesconto(d);
      setOk(`Cupom ${c.codigo} aplicado: -${c.descontoPercentual}%.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Cupom inválido.");
    }
  };

  const aoConfirmar = async () => {
    if (emAndamento.current) return;
    setErro("");
    if (!tipoId || !exercitoId) {
      setErro("Selecione o tipo de ingresso e o exército.");
      return;
    }
    emAndamento.current = true;
    setConfirmando(true);
    try {
      await confirmarInscricao({
        eventoId: evento.id,
        usuarioId: usuario.id,
        tipoId,
        exercitoId,
        codigoCupom: desconto > 0 ? cupom : undefined,
        cortesiaId: cortesia?.id,
      });
      navigate({ to: "/app/ingressos" });
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
          <Campo rotulo="1. Tipo de ingresso" htmlFor="tipo">
            <Selecao id="tipo" value={tipoId} onChange={(e) => { setTipoId(e.target.value); setDesconto(0); }} disabled={!!cortesia}>
              <option value="">Selecione</option>
              {evento.tipos.filter((t) => !t.arquivado).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome} — {formatarBRL(loteVigente(evento, t.id)?.itens.find((i) => i.tipoId === t.id)?.precoCentavos ?? t.precoBaseCentavos)}
                </option>
              ))}
            </Selecao>
          </Campo>

          {tipo && !cortesia && (
            <p className="text-sm text-muted-foreground">
              2. Lote vigente: <strong>{lote?.nome ?? "nenhum lote vigente"}</strong>
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

          {!cortesia && (
            <Campo rotulo="4. Cupom (opcional)" htmlFor="cupom">
              <div className="flex gap-2">
                <Entrada id="cupom" value={cupom} onChange={(e) => setCupom(e.target.value)} placeholder="CODIGO" />
                <Botao type="button" variante="contorno" onClick={aoAplicarCupom}>Aplicar</Botao>
              </div>
            </Campo>
          )}

          {tipo && (
            <div className="rounded-md border border-border bg-elevated p-4 text-sm">
              <p className="font-medium">5. Revisão</p>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <p>Evento: {evento.nome}</p>
                <p>Ingresso: {tipo.nome}{lote ? ` (${lote.nome})` : ""}</p>
                <p>Valor original: {formatarBRL(preco)}</p>
                {desconto > 0 && <p>Desconto: −{formatarBRL(desconto)}</p>}
                <p className="font-medium text-foreground">
                  Valor final: {formatarBRL(Math.max(0, preco - desconto))}
                  {cortesia && " (cortesia por convite)"}
                  {desconto >= preco && preco > 0 && " (inscrição integralmente descontada)"}
                </p>
              </div>
            </div>
          )}

          {ok && <p role="status" className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">{ok}</p>}
          {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

          <Botao onClick={aoConfirmar} disabled={confirmando} className="w-full">
            {confirmando ? "Confirmando..." : "Confirmar inscrição simulada"}
          </Botao>
          <p className="text-center text-xs text-muted-foreground">
            Nenhuma cobrança será feita. Não pedimos cartão, PIX ou dados de pagamento.
          </p>
        </div>
      </Cartao>
    </div>
  );
}
