// Organização vê apenas demandas encaminhadas pela administração para ela.
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { useSuporte } from "@/contexts/SuporteContext";
import { linkAnexo, marcarRetornoEnviado } from "@/api/suporte.functions";
import { encaminhamentos, naoLidas, protocolo, ROTULO_STATUS, type Encaminhamento } from "@/lib/suporte";
import { formatarDataHoraBR } from "@/lib/domain/money";
import type { AnexoCompartilhado, Chamado, Usuario } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui";
import { Conversa } from "./Conversa";
import { Indisponivel } from "./CentralSuporte";
import { SituacaoEncaminhamento } from "./PainelEncaminhamento";

function AnexoCompartilhadoBotao({ chamadoId, a }: { chamadoId: string; a: AnexoCompartilhado }) {
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState("");
  const abrir = async () => {
    setAbrindo(true); setErro("");
    const janela = window.open("", "_blank");
    try {
      const url = await linkAnexo(chamadoId, a.mensagemId);
      if (janela) { janela.opener = null; janela.location.href = url; } else window.location.assign(url);
    } catch (e) { janela?.close(); setErro(e instanceof Error ? e.message : "Falha ao abrir."); } finally { setAbrindo(false); }
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
    try { await marcarRetornoEnviado(atual.c.id, atual.e.id); sinalizar(atual.c.id); } catch (e) { setErro(e instanceof Error ? e.message : "Falha."); } finally { setOcupado(false); }
  };

  return (
    // No celular, a lista sozinha flui com a página; a altura fixa vale para a conversa e para lista + conversa lado a lado.
    <div className={`flex overflow-hidden rounded-lg border border-border bg-card ${selecionado ? "h-[calc(100dvh-12rem)] min-h-[520px]" : "md:h-[calc(100dvh-12rem)] md:min-h-[520px]"}`}>
      <section aria-label="Demandas encaminhadas" className={`${selecionado ? "hidden md:flex" : "flex"} w-full flex-col border-border md:w-80 md:shrink-0 md:border-r`}>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {itens.length === 0 && <li className="p-4"><EstadoVazio titulo="Nenhuma demanda" descricao="Quando a administração precisar da organização, a demanda aparece aqui." /></li>}
          {itens.map(({ c, e }) => {
            const ev = base.eventos.find((x) => x.id === c.eventoId);
            const n = naoLidas({ ...c, mensagens: e.mensagens }, usuario.id, lidoAte(c.id));
            return (
              <li key={e.id}>
                <Button variant="plain" size="none" type="button" onClick={() => onSelecionar(e.id)} aria-current={e.id === selecionado ? "true" : undefined}
                  className={`block w-full border-b border-border px-3 py-3 text-left hover:bg-secondary/60 ${e.id === selecionado ? "bg-secondary" : ""} ${n > 0 ? "border-l-4 border-l-accent" : ""}`}>
                  <p className="truncate text-sm font-medium">{c.assunto}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{protocolo(c)} · {ev?.nome ?? "Evento"}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <SituacaoEncaminhamento e={e} />
                    <span className="ml-auto text-[11px] text-muted-foreground">{formatarDataHoraBR(e.criadoEm)}</span>
                  </div>
                </Button>
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-label="Demanda" className={`${selecionado ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {atual ? (
          <>
            <header className="space-y-2 border-b border-border px-4 py-3 text-sm">
              <div className="flex items-start gap-2">
                <Button type="button" variant="ghost" className="!px-2 !py-1 md:hidden" onClick={() => onSelecionar(undefined)} aria-label="Voltar para a lista"><ArrowLeft className="h-4 w-4" /></Button>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-base font-semibold">{atual.c.assunto}</h2>
                  <p className="text-xs text-muted-foreground">{protocolo(atual.c)} · {base.eventos.find((x) => x.id === atual.c.eventoId)?.nome ?? "Evento"} · Chamado: {ROTULO_STATUS[atual.c.status]}</p>
                </div>
                <SituacaoEncaminhamento e={atual.e} />
              </div>
              <p className="text-xs text-muted-foreground">Orientação da administração</p>
              <p className="whitespace-pre-wrap rounded-md border border-border bg-background/60 px-3 py-2">{atual.e.orientacao}</p>
              {atual.e.anexos.length > 0 && <div className="flex flex-wrap gap-2">{atual.e.anexos.map((a) => <AnexoCompartilhadoBotao key={a.mensagemId} chamadoId={atual.c.id} a={a} />)}</div>}
              {atual.c.status !== "fechado" && atual.e.situacao !== "retorno_enviado" && (
                <Button type="button" variant="outline" className="!py-1 text-xs" disabled={ocupado} onClick={marcar}>Marcar retorno enviado à administração</Button>
              )}
              {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
              <p className="text-[11px] text-muted-foreground"><Badge>Interno</Badge> Suas mensagens vão para a administração, que dá a devolutiva ao participante.</p>
            </header>
            <Conversa key={atual.e.id} base={base} chamado={atual.c} usuarioId={usuario.id} somenteLeitura={atual.c.status === "fechado"} encaminhamentoId={atual.e.id}
              rotuloEnviar="Enviar à administração" aviso="Destino: administração." textoVazio="Responda à administração com as informações solicitadas." />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            {selecionado ? <Indisponivel onVoltar={() => onSelecionar(undefined)} /> : <EstadoVazio titulo="Selecione uma demanda" descricao="Escolha uma demanda encaminhada pela administração." />}
          </div>
        )}
      </section>
    </div>
  );
}
