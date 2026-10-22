import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Clock, Rocket } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { comprarImpulso, retomarPagamentoImpulso, sincronizarPagamentoImpulso, usarImpulso } from "@/api/impulsos.functions";
import {
  ROTULO_STATUS_IMPULSO, eventosImpulsionaveis, impulsosDaOrganizacao, pendenciasUso, periodoDoImpulso, planosDeImpulso,
  rotuloDuracao, statusDoImpulso, type StatusExibidoImpulso,
} from "@/lib/impulsos";
import { statusExibido } from "@/lib/impulsionamento";
import { StatusImpulsionamento } from "@/components/impulsionamentos";
import { formatarDataBR, formatarDataHoraBR } from "@/lib/domain/money";
import { Preco } from "@/components/Preco";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Campo, EstadoVazio, Modal } from "@/components/ui";
import type { BaseDados, ImpulsoComprado } from "@/lib/domain/types";

export const Route = createFileRoute("/organizacao/impulsos")({
  head: () => ({
    meta: [
      { title: "Impulsionar — Organização MilSim Ops" },
      { name: "description", content: "Compre impulsos e destaque as operações da sua organização na página inicial e na listagem." },
      { property: "og:title", content: "Impulsionar — Organização MilSim Ops" },
      { property: "og:description", content: "Impulsos de destaque para as operações da organização." },
    ],
  }),
  // Retorno do checkout do Stripe: ?pagamento=sucesso&sessao=cs_...
  validateSearch: (s: Record<string, unknown>): { pagamento?: string | undefined; sessao?: string | undefined } => ({
    pagamento: typeof s["pagamento"] === "string" ? s["pagamento"] : undefined,
    sessao: typeof s["sessao"] === "string" ? s["sessao"] : undefined,
  }),
  component: Impulsos,
});

const TOM: Record<StatusExibidoImpulso, "secondary" | "success" | "warning" | "destructive" | "accent"> = {
  aguardando_pagamento: "warning", processando: "warning", disponivel: "success", usado: "accent",
  expirado: "secondary", cancelado: "secondary", reembolsado: "destructive",
};

type Aviso = { tom: "ok" | "perigo"; texto: string };

/** Confere o pagamento ao voltar do checkout e repete por alguns segundos enquanto o Stripe confirma. */
function useRetornoDoCheckout(sessao: string | undefined, cancelado: boolean, usuarioId: string | undefined): Aviso | null {
  const navigate = useNavigate();
  const [aviso, setAviso] = useState<Aviso | null>(cancelado ? { tom: "perigo", texto: "Pagamento não concluído. Você pode tentar de novo quando quiser." } : null);
  const feito = useRef<string | null>(null);
  const montada = useRef(true);
  useEffect(() => {
    montada.current = true;
    return () => { montada.current = false; };
  }, []);
  useEffect(() => {
    if (!usuarioId || (!sessao && !cancelado)) return;
    if (sessao && feito.current !== sessao) {
      feito.current = sessao;
      let tentativas = 0;
      const conferir = async () => {
        try {
          const i = await sincronizarPagamentoImpulso(sessao);
          if (!montada.current) return;
          if (i?.status === "disponivel") setAviso({ tom: "ok", texto: "Pagamento confirmado. Seu impulso já está disponível para usar." });
          else if (i?.status === "cancelado") setAviso({ tom: "perigo", texto: "O pagamento não foi aprovado." });
          else {
            setAviso({ tom: "ok", texto: "Ainda não recebemos a confirmação do pagamento. Esta página atualiza sozinha." });
            if (++tentativas < 6) setTimeout(conferir, 3000);
          }
        } catch (err) {
          if (montada.current) setAviso({ tom: "perigo", texto: err instanceof Error ? err.message : "Não foi possível conferir o pagamento." });
        }
      };
      void conferir();
    }
    // Tira os parâmetros do endereço para um recarregamento não repetir a conferência.
    navigate({ to: "/organizacao/impulsos", search: { pagamento: undefined, sessao: undefined }, replace: true });
  }, [sessao, cancelado, usuarioId, navigate]);
  return aviso;
}

function Impulsos() {
  useVersaoBase();
  const { usuario } = useAuth();
  const { sessao, pagamento } = Route.useSearch();
  const aviso = useRetornoDoCheckout(sessao, pagamento === "cancelado", usuario?.id);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [usando, setUsando] = useState<ImpulsoComprado | null>(null);
  const organizacaoId = usuario?.organizacaoId;
  if (!usuario || !organizacaoId || usuario.perfil !== "organizador") {
    return <EstadoVazio titulo="Impulsos são da organização" descricao="Entre com a conta de organizador para comprar e usar impulsos." />;
  }
  const base = carregarBase();
  const agora = new Date();
  const planos = planosDeImpulso(base).filter((p) => p.ativo);
  const meus = impulsosDaOrganizacao(base, organizacaoId, agora);
  const disponiveis = meus.filter((i) => statusDoImpulso(i, agora) === "disponivel");

  const executar = async (chave: string, fn: () => Promise<void>) => {
    setErro(""); setOcupado(chave);
    try { await fn(); } catch (e) { setErro((e as Error).message); } finally { setOcupado(null); }
  };
  const comprar = (planoId: (typeof planos)[number]["id"]) => executar(planoId, async () => {
    const r = await comprarImpulso(planoId);
    if (r.urlPagamento) window.location.assign(r.urlPagamento);
  });
  const pagar = (i: ImpulsoComprado) => executar(i.id, async () => {
    const r = await retomarPagamentoImpulso(i.id);
    if (r.urlPagamento) window.location.assign(r.urlPagamento);
  });

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold uppercase">Impulsionar</h1>
        <p className="text-sm text-muted-foreground">
          Compre um impulso e use numa operação publicada: ela aparece nos destaques da página inicial e no topo da listagem de eventos, em todo o Brasil, pelo período do impulso.
        </p>
      </div>
      {aviso && (
        <p role="status" className={`rounded-md border px-3 py-2 text-sm ${aviso.tom === "ok" ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
          {aviso.texto}
        </p>
      )}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold uppercase">Comprar impulso</h2>
        {planos.length === 0 ? (
          <EstadoVazio titulo="Nenhum impulso à venda no momento" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {planos.map((p) => (
              <Card key={p.id} className="flex flex-col gap-3 overflow-hidden p-0">
                {p.imagemUrl && <img src={p.imagemUrl} alt={p.rotulo} loading="lazy" className="aspect-[3/2] w-full object-cover" />}
                <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
                <div className="flex items-center gap-2">
                  <Rocket className="h-4 w-4 shrink-0 text-primary" />
                  <span className="font-semibold">{p.rotulo}</span>
                </div>
                <p className="font-mono text-2xl font-semibold text-accent">{p.precoCentavos === 0 ? "Grátis" : <Preco centavos={p.precoCentavos} />}</p>
                <p className="text-xs text-muted-foreground">Use em até {p.validadeDias} dias depois da compra.</p>
                <Button className="mt-auto" disabled={ocupado !== null} onClick={() => void comprar(p.id)}>
                  {ocupado === p.id ? "Abrindo pagamento…" : "Comprar"}
                </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold uppercase">Meus impulsos</h2>
        {disponiveis.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {disponiveis.length === 1 ? "1 impulso disponível" : `${disponiveis.length} impulsos disponíveis`}. Impulso não usado dentro da validade expira.
          </p>
        )}
        {meus.length === 0 ? (
          <EstadoVazio titulo="Nenhum impulso ainda" descricao="Os impulsos comprados aparecem aqui até serem usados." />
        ) : (
          <div className="space-y-2">
            {meus.map((i) => (
              <LinhaImpulso key={i.id} base={base} impulso={i} agora={agora} ocupado={ocupado === i.id}
                onUsar={() => setUsando(i)} onPagar={() => void pagar(i)} />
            ))}
          </div>
        )}
      </div>

      {usando && <ModalUsar base={base} impulso={usando} onFechar={() => setUsando(null)} />}
    </section>
  );
}

function LinhaImpulso({ base, impulso: i, agora, ocupado, onUsar, onPagar }: {
  base: BaseDados; impulso: ImpulsoComprado; agora: Date; ocupado: boolean; onUsar: () => void; onPagar: () => void;
}) {
  const st = statusDoImpulso(i, agora);
  const campanha = i.impulsionamentoId ? base.impulsionamentos.find((c) => c.id === i.impulsionamentoId) : undefined;
  const evento = i.eventoId ? base.eventos.find((e) => e.id === i.eventoId) : undefined;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Impulso de {rotuloDuracao(i.duracaoHoras)}</span>
          <Badge variant={TOM[st]}>{ROTULO_STATUS_IMPULSO[st]}</Badge>
          {campanha && <StatusImpulsionamento s={statusExibido(base, campanha, agora)} />}
        </div>
        <p className="text-xs text-muted-foreground">
          Comprado em {formatarDataBR(i.criadoEm)} · {i.precoCentavos === 0 ? "grátis" : <Preco centavos={i.precoCentavos} />}
          {st === "disponivel" && i.expiraEm && <> · <Clock className="inline h-3 w-3" /> use até {formatarDataHoraBR(i.expiraEm)}</>}
          {st === "expirado" && i.expiraEm && <> · expirou em {formatarDataBR(i.expiraEm)}</>}
        </p>
        {campanha && (
          <p className="text-xs text-muted-foreground">
            {evento?.nome ?? "Operação"}: {formatarDataHoraBR(campanha.inicioEm)} → {formatarDataHoraBR(campanha.fimEm)}
          </p>
        )}
      </div>
      {st === "disponivel" && <Button onClick={onUsar}>Usar em uma operação</Button>}
      {st === "aguardando_pagamento" && <Button variant="outline" disabled={ocupado} onClick={onPagar}>{ocupado ? "Abrindo…" : "Pagar"}</Button>}
    </Card>
  );
}

function ModalUsar({ base, impulso, onFechar }: { base: BaseDados; impulso: ImpulsoComprado; onFechar: () => void }) {
  const agora = new Date();
  const eventos = eventosImpulsionaveis(base, impulso.organizacaoId, agora);
  const [eventoId, setEventoId] = useState(eventos[0]?.id ?? "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const evento = eventos.find((e) => e.id === eventoId);
  const pendencias = evento ? pendenciasUso(base, impulso, evento, agora) : [];
  const periodo = evento && !pendencias.length ? periodoDoImpulso(base, evento, impulso.duracaoHoras, agora) : undefined;

  const confirmar = async () => {
    setErro(""); setSalvando(true);
    try {
      await usarImpulso(impulso.id, eventoId);
      onFechar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal aberto titulo={`Usar impulso de ${rotuloDuracao(impulso.duracaoHoras)}`} onFechar={onFechar}>
      {eventos.length === 0 ? (
        <EstadoVazio titulo="Nenhuma operação publicada" descricao="Publique uma operação para poder impulsionar." />
      ) : (
        <div className="space-y-4">
          <Campo rotulo="Operação" htmlFor="imp-evento">
            <NativeSelect id="imp-evento" value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
              {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome} ({formatarDataBR(e.inicioEm)})</option>)}
            </NativeSelect>
          </Campo>
          {pendencias.length > 0 && (
            <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-destructive">
              {pendencias.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
          {periodo && (
            <div className="space-y-1 rounded-md border border-border bg-secondary/40 p-3 text-sm">
              <p>Em destaque de <strong>{formatarDataHoraBR(periodo.inicioEm)}</strong> até <strong>{formatarDataHoraBR(periodo.fimEm)}</strong>.</p>
              {periodo.enfileirado && <p className="text-muted-foreground">Esta operação já tem um impulso em andamento: este começa quando o anterior terminar.</p>}
              {periodo.cortado && <p className="text-warning">A operação termina antes do fim do impulso; o tempo restante será perdido.</p>}
              <p className="text-muted-foreground">Depois de usado, o impulso não pode ser trocado de operação.</p>
            </div>
          )}
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onFechar}>Cancelar</Button>
            <Button disabled={!periodo || salvando} onClick={() => void confirmar()}>{salvando ? "Impulsionando…" : "Impulsionar"}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
