import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Clock, Rocket } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { comprarImpulso, retomarPagamentoImpulso, sincronizarPagamentoImpulso, usarImpulso } from "@/api/impulsos.functions";
import {
  ROTULO_STATUS_IMPULSO, eventosImpulsionaveis, impulsosDaOrganizacao, pendenciasUso, periodoDoImpulso, planosDeImpulso,
  duracaoNaTela, nomeImpulso, statusDoImpulso, type StatusExibidoImpulso,
} from "@/lib/impulsos";
import { statusExibido } from "@/lib/impulsionamento";
import { StatusImpulsionamento } from "@/components/impulsionamentos";
import { formatarDataBR, formatarDataHoraBR } from "@/lib/domain/money";
import { Preco } from "@/components/Preco";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Campo, EstadoVazio, Modal } from "@/components/ui";
import type { BaseDados, ImpulsoComprado } from "@/lib/domain/types";
import { tr } from "@/i18n/routes/organizacao.impulsos";

export const Route = createFileRoute("/organizacao/impulsos")({
  head: () => ({
    meta: [
      { title: tr("impulsionar_organizacao_milsim_ops") },
      { name: "description", content: tr("compre_impulsos_e_destaque_as_operacoes") },
      { property: "og:title", content: tr("impulsionar_organizacao_milsim_ops") },
      { property: "og:description", content: tr("impulsos_de_destaque_para_as_operacoes") },
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
  const [aviso, setAviso] = useState<Aviso | null>(cancelado ? { tom: "perigo", texto: tr("pagamento_nao_concluido_voce_pode_tentar") } : null);
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
          if (i?.status === "disponivel") setAviso({ tom: "ok", texto: tr("pagamento_confirmado_seu_impulso_ja_esta") });
          else if (i?.status === "cancelado") setAviso({ tom: "perigo", texto: tr("o_pagamento_nao_foi_aprovado") });
          else {
            setAviso({ tom: "ok", texto: tr("ainda_nao_recebemos_a_confirmacao_do") });
            if (++tentativas < 6) setTimeout(conferir, 3000);
          }
        } catch (err) {
          if (montada.current) setAviso({ tom: "perigo", texto: err instanceof Error ? err.message : tr("nao_foi_possivel_conferir_o_pagamento") });
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
    return <EstadoVazio titulo={tr("impulsos_sao_da_organizacao")} descricao={tr("entre_com_a_conta_de_organizador")} />;
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
    <section className="space-y-8">
      <div>
        <h1 className="titulo-pagina">{tr("impulsionar")}</h1>
        <p className="subtitulo-pagina">{tr("compre_um_impulso_e_use_numa")}</p>
      </div>
      {aviso && (
        <p role="status" className={`border-l-2 px-4 py-3 text-sm ${aviso.tom === "ok" ? "border-success bg-success/10 text-success" : "border-destructive bg-destructive/10 text-destructive"}`}>
          {aviso.texto}
        </p>
      )}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

      <ol className="grid overflow-hidden rounded-lg border border-border sm:grid-cols-3 sm:divide-x sm:divide-border" aria-label={tr("como_funciona")}>
        {[
          [tr("compre_o_pacote"), tr("pagamento_pelo_stripe_o_prazo_de")],
          [tr("escolha_a_operacao"), tr("qualquer_operacao_publicada_da_sua_organ")],
          [tr("fique_em_destaque"), tr("destaques_da_pagina_inicial_e_topo")],
        ].map(([t, d], k) => (
          <li key={t} className="flex gap-3 p-4">
            <span className="font-display text-3xl font-bold leading-none text-accent">{String(k + 1).padStart(2, "0")}</span>
            <span><span className="block font-semibold">{t}</span><span className="text-sm text-muted-foreground">{d}</span></span>
          </li>
        ))}
      </ol>

      {meus.length > 0 && (
        <section aria-labelledby="t-meus">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="t-meus" className="text-lg font-semibold">{tr("seus_impulsos")}</h2>
            {disponiveis.length > 0 && (
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {disponiveis.length === 1 ? tr("1_disponivel") : tr("length_disponiveis", { length: disponiveis.length })}{" "}{tr("expira_se_nao_for_usado")}</span>
            )}
          </div>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {meus.map((i) => (
              <LinhaImpulso key={i.id} base={base} impulso={i} agora={agora} ocupado={ocupado === i.id}
                onUsar={() => setUsando(i)} onPagar={() => void pagar(i)} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="t-pacotes">
        <h2 id="t-pacotes" className="text-lg font-semibold">{tr("pacotes")}</h2>
        {meus.length === 0 && <p className="mt-1 text-sm text-muted-foreground">{tr("voce_ainda_nao_tem_impulsos_escolha")}</p>}
        {planos.length === 0 ? (
          <div className="mt-3"><EstadoVazio titulo={tr("nenhum_pacote_a_venda_no_momento")} descricao={tr("a_plataforma_ainda_nao_liberou_pacotes")} /></div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {planos.map((p) => (
              <li key={p.id} className="flex flex-col overflow-hidden rounded-lg border border-border">
                {p.imagemUrl ? <img src={p.imagemUrl} alt={nomeImpulso(p.duracaoHoras)} loading="lazy" className="aspect-[16/9] w-full object-cover" /> : <div className="aspect-[16/9] bg-secondary" />}
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <p className="font-semibold">{nomeImpulso(p.duracaoHoras)}</p>
                  <p className="font-display text-4xl font-bold leading-none tabular-nums">{p.precoCentavos === 0 ? tr("gratis") : <Preco centavos={p.precoCentavos} />}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{tr("use_em_ate_validadedias_dias_apos", { validadeDias: p.validadeDias })}</p>
                  <Button className="mt-4" disabled={ocupado !== null} onClick={() => void comprar(p.id)}>
                    <Rocket className="size-4" aria-hidden />{ocupado === p.id ? tr("abrindo_pagamento") : tr("comprar")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

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
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="flex min-w-0 items-start gap-3">
      <span className={`grid size-10 shrink-0 place-items-center rounded-md border ${st === "disponivel" ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-muted-foreground"}`} aria-hidden><Rocket className="size-4" /></span>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{tr("impulso_de_duracaohoras", { duracaoHoras: duracaoNaTela(i.duracaoHoras) })}</span>
          <Badge variant={TOM[st]}>{ROTULO_STATUS_IMPULSO[st]}</Badge>
          {campanha && <StatusImpulsionamento s={statusExibido(base, campanha, agora)} />}
        </div>
        <p className="text-xs text-muted-foreground">{tr("comprado_em_criadoem", { criadoEm: formatarDataBR(i.criadoEm) })}{" "}{i.precoCentavos === 0 ? tr("gratis_2") : <Preco centavos={i.precoCentavos} />}
          {st === "disponivel" && i.expiraEm && <> · <Clock className="inline h-3 w-3" />{" "}{tr("use_ate_expiraem", { expiraEm: formatarDataHoraBR(i.expiraEm) })}</>}
          {st === "expirado" && i.expiraEm && <>{" "}{tr("expirou_em_expiraem", { expiraEm: formatarDataBR(i.expiraEm) })}</>}
        </p>
        {campanha && (
          <p className="text-xs text-muted-foreground">
            {evento?.nome ?? tr("operacao")}: {formatarDataHoraBR(campanha.inicioEm)} → {formatarDataHoraBR(campanha.fimEm)}
          </p>
        )}
      </div>
      </div>
      {st === "disponivel" && <Button onClick={onUsar}>{tr("usar_em_uma_operacao")}</Button>}
      {st === "aguardando_pagamento" && <Button variant="outline" disabled={ocupado} onClick={onPagar}>{ocupado ? tr("abrindo") : tr("pagar")}</Button>}
    </li>
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
    <Modal aberto titulo={tr("usar_impulso_de_duracaohoras", { duracaoHoras: duracaoNaTela(impulso.duracaoHoras) })} onFechar={onFechar}>
      {eventos.length === 0 ? (
        <EstadoVazio titulo={tr("nenhuma_operacao_publicada")} descricao={tr("publique_uma_operacao_para_poder_impulsi")} />
      ) : (
        <div className="space-y-4">
          <Campo rotulo={tr("operacao")} htmlFor="imp-evento">
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
              <p>{tr("em_destaque_de")}{" "}<strong>{formatarDataHoraBR(periodo.inicioEm)}</strong>{" "}{tr("ate")}{" "}<strong>{formatarDataHoraBR(periodo.fimEm)}</strong>.</p>
              {periodo.enfileirado && <p className="text-muted-foreground">{tr("esta_operacao_ja_tem_um_impulso")}</p>}
              {periodo.cortado && <p className="text-warning">{tr("a_operacao_termina_antes_do_fim")}</p>}
              <p className="text-muted-foreground">{tr("depois_de_usado_o_impulso_nao")}</p>
            </div>
          )}
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onFechar}>{tr("cancelar")}</Button>
            <Button disabled={!periodo || salvando} onClick={() => void confirmar()}>{salvando ? tr("impulsionando") : tr("impulsionar")}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
