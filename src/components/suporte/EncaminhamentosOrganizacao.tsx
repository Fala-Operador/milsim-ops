// Organização vê apenas demandas encaminhadas pela administração para ela.
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Inbox, Loader2, MessageSquareReply, Send } from "lucide-react";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { useSuporte } from "@/contexts/SuporteContext";
import { linkAnexo, marcarRetornoEnviado } from "@/api/suporte.functions";
import { encaminhamentos, naoLidas, protocolo, ROTULO_STATUS, type Encaminhamento } from "@/lib/suporte";
import { formatarDataHoraBR } from "@/lib/domain/money";
import type { AnexoCompartilhado, Chamado, Usuario } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Conversa } from "./Conversa";
import { Indisponivel } from "./CentralSuporte";
import { SituacaoEncaminhamento } from "./PainelEncaminhamento";
import { tr } from "@/i18n/components/suporte/EncaminhamentosOrganizacao";

function AnexoCompartilhadoBotao({ chamadoId, a }: { chamadoId: string; a: AnexoCompartilhado }) {
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState("");
  const abrir = async () => {
    setAbrindo(true); setErro("");
    const janela = window.open("", "_blank");
    try {
      const url = await linkAnexo(chamadoId, a.mensagemId);
      if (janela) { janela.opener = null; janela.location.href = url; } else window.location.assign(url);
    } catch (e) { janela?.close(); setErro(e instanceof Error ? e.message : tr("falha_ao_abrir")); } finally { setAbrindo(false); }
  };
  return (
    <span className="inline-flex flex-col">
      <Button variant="plain" size="none" type="button" onClick={abrir} disabled={abrindo} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary">
        {abrindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}{a.nome}
      </Button>
      {erro && <span className="text-xs text-destructive">{erro}</span>}
    </span>
  );
}

/** Sem demanda aberta: o papel da organização no atendimento, em três passos. */
function ComoFuncionamDemandas() {
  const passos = [
    { icone: Inbox, titulo: tr("a_administracao_encaminha"), texto: tr("quando_um_chamado_depende_da_organizacao") },
    { icone: MessageSquareReply, titulo: tr("voce_responde_a_administracao"), texto: tr("a_conversa_e_interna_o_participante") },
    { icone: Send, titulo: tr("marque_o_retorno_enviado"), texto: tr("a_administracao_da_a_devolutiva_ao") },
  ];
  return (
    <div className="w-full max-w-md text-left">
      <p className="rotulo-tecnico">{tr("demandas")}</p>
      <h2 className="mt-1 font-display text-2xl font-bold uppercase leading-tight">{tr("como_funciona_para_a_organizacao")}</h2>
      <ol className="mt-5 space-y-4">
        {passos.map(({ icone: Icone, titulo, texto }, i) => (
          <li key={titulo} className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-background text-accent" aria-hidden="true"><Icone className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="text-sm font-medium"><span className="mr-1.5 font-mono text-xs text-muted-foreground">0{i + 1}</span>{titulo}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function EncaminhamentosOrganizacao({ usuario, selecionado, onSelecionar }: { usuario: Usuario; selecionado: string | undefined; onSelecionar: (id: string | undefined) => void }) {
  const versao = useVersaoBase();
  const base = useMemo(() => carregarBase(), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const { lidoAte, acompanhar, sinalizar } = useSuporte();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => acompanhar(), [acompanhar]);

  const itens = useMemo(() => {
    const l: { c: Chamado; e: Encaminhamento }[] = [];
    for (const c of base.chamados) for (const e of encaminhamentos(base, c)) if (e.organizacaoId === usuario.organizacaoId) l.push({ c, e });
    return l.sort((a, b) => (b.e.mensagens.at(-1)?.criadoEm ?? b.e.criadoEm).localeCompare(a.e.mensagens.at(-1)?.criadoEm ?? a.e.criadoEm));
  }, [base, usuario.organizacaoId]);
  const atual = selecionado ? itens.find((x) => x.e.id === selecionado) : undefined;

  useEffect(() => setErro(""), [selecionado]);

  const marcar = async () => {
    if (!atual || ocupado) return;
    setOcupado(true); setErro("");
    try { await marcarRetornoEnviado(atual.c.id, atual.e.id); sinalizar(atual.c.id); } catch (e) { setErro(e instanceof Error ? e.message : tr("falha")); } finally { setOcupado(false); }
  };

  return (
    // No celular, a lista sozinha flui com a página; a altura fixa vale para a conversa e para lista + conversa lado a lado.
    <div className={`flex overflow-hidden rounded-lg border border-border bg-card ${selecionado ? "h-[calc(100dvh-12rem)] min-h-[520px]" : "md:h-[calc(100dvh-12rem)] md:min-h-[520px]"}`}>
      <section aria-label={tr("demandas_encaminhadas")} className={`${selecionado ? "hidden md:flex" : "flex"} w-full flex-col border-border md:w-80 md:shrink-0 md:border-r`}>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {itens.length === 0 && (
            <li className="flex flex-col items-center px-6 py-10 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full border border-border text-muted-foreground" aria-hidden="true"><Inbox className="h-5 w-5" /></span>
              <p className="mt-3 text-sm font-medium">{tr("nenhuma_demanda_por_aqui")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{tr("quando_a_administracao_precisar_da_organ")}</p>
            </li>
          )}
          {itens.map(({ c, e }) => {
            const ev = base.eventos.find((x) => x.id === c.eventoId);
            const n = naoLidas({ ...c, mensagens: e.mensagens }, usuario.id, lidoAte(c.id));
            return (
              <li key={e.id}>
                <Button variant="plain" size="none" type="button" onClick={() => onSelecionar(e.id)} aria-current={e.id === selecionado ? "true" : undefined}
                  className={`relative block w-full border-b border-border px-4 py-3 text-left hover:bg-secondary/50 ${e.id === selecionado ? "bg-secondary before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent" : ""}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={`truncate text-sm ${n > 0 ? "font-semibold" : "font-medium"}`}>
                      {n > 0 && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent align-middle" aria-label={tr("n_nao_lidas", { n })} />}
                      {c.assunto}
                    </p>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatarDataHoraBR(e.criadoEm).slice(0, 5)}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{ev?.nome ?? tr("evento")}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <SituacaoEncaminhamento e={e} />
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{protocolo(c)}</span>
                  </div>
                </Button>
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-label={tr("demanda")} className={`${selecionado ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {atual ? (
          <>
            <header className="space-y-2 border-b border-border px-4 py-3 text-sm">
              <div className="flex items-start gap-2">
                <Button type="button" variant="ghost" className="!px-2 !py-1 md:hidden" onClick={() => onSelecionar(undefined)} aria-label={tr("voltar_para_a_lista")}><ArrowLeft className="h-4 w-4" /></Button>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-lg font-bold uppercase leading-tight">{atual.c.assunto}</h2>
                  <p className="text-xs text-muted-foreground">{protocolo(atual.c)} · {base.eventos.find((x) => x.id === atual.c.eventoId)?.nome ?? tr("evento")}{" "}{tr("chamado_valor", { valor: ROTULO_STATUS[atual.c.status] })}</p>
                </div>
                <SituacaoEncaminhamento e={atual.e} />
              </div>
              <p className="text-xs text-muted-foreground">{tr("orientacao_da_administracao")}</p>
              <p className="whitespace-pre-wrap rounded-md border border-border bg-background/60 px-3 py-2">{atual.e.orientacao}</p>
              {atual.e.anexos.length > 0 && <div className="flex flex-wrap gap-2">{atual.e.anexos.map((a) => <AnexoCompartilhadoBotao key={a.mensagemId} chamadoId={atual.c.id} a={a} />)}</div>}
              {atual.c.status !== "fechado" && atual.e.situacao !== "retorno_enviado" && (
                <Button type="button" variant="outline" className="!py-1 text-xs" disabled={ocupado} onClick={marcar}>{tr("marcar_retorno_enviado_a_administracao")}</Button>
              )}
              {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
              <p className="text-[11px] text-muted-foreground"><Badge>{tr("interno")}</Badge>{" "}{tr("suas_mensagens_vao_para_a_administracao")}</p>
            </header>
            <Conversa key={atual.e.id} base={base} chamado={atual.c} usuarioId={usuario.id} somenteLeitura={atual.c.status === "fechado"} encaminhamentoId={atual.e.id}
              rotuloEnviar={tr("enviar_a_administracao")} aviso={tr("destino_administracao")} textoVazio={tr("responda_a_administracao_com_as_informac")} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            {selecionado ? <Indisponivel onVoltar={() => onSelecionar(undefined)} /> : <ComoFuncionamDemandas />}
          </div>
        )}
      </section>
    </div>
  );
}
