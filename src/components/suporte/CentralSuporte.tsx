// Central de Suporte compartilhada: "participante" (Meus chamados) e "equipe"
// (administração / organização). Lista + conversa + painel de detalhes recolhível.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, PanelRightClose, PanelRightOpen, Plus, Search } from "lucide-react";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { useSuporte } from "@/contexts/SuporteContext";
import { alterarStatusChamado, assumirChamado } from "@/api/suporte.functions";
import { PainelEncaminhamento } from "./PainelEncaminhamento";
import {
  ROTULO_STATUS, CATEGORIAS_SUPORTE, ativo, naoLidas, ordenarParaAtendimento, pendenteDeResposta, podeAtender, protocolo,
  responsavelId, solucao, tipoDoChamado, ultimaAtividade, ultimaMensagem, vinculadoA, type AcaoStatus,
  ROTULO_STATUS_EXIBIDO, statusExibido, retornoRecebido, encaminhamentos, canalDe, type StatusExibido,
} from "@/lib/suporte";
import { formatarDataHoraBR } from "@/lib/domain/money";
import type { BaseDados, Chamado, StatusChamado, Usuario } from "@/lib/domain/types";
import { AreaTexto, Badge, Botao, EstadoVazio, Selecao } from "@/components/ui";
import { Conversa } from "./Conversa";
import { NovoChamado } from "./NovoChamado";

const TOM: Record<StatusExibido, "padrao" | "sucesso" | "aviso" | "destaque"> = {
  aberto: "destaque", em_atendimento: "aviso", aguardando_participante: "padrao", aguardando_organizador: "padrao", resolvido: "sucesso", fechado: "padrao",
};
const nome = (u: Usuario | undefined) => (u ? u.nomeExibicao || u.nomeCompleto : "—");

export function StatusChamadoBadge({ s }: { s: StatusExibido }) {
  return <Badge tom={TOM[s]}>{ROTULO_STATUS_EXIBIDO[s]}</Badge>;
}

/** Mesma mensagem para inexistente e sem acesso: não revela nada restrito. */
export function Indisponivel({ onVoltar }: { onVoltar: () => void }) {
  return (
    <div className="space-y-3">
      <EstadoVazio titulo="Esta solicitação não está disponível para sua conta." descricao="Ela pode ter sido removida ou pertencer a outra pessoa." />
      <Botao type="button" variante="contorno" onClick={onVoltar}>Voltar para meus atendimentos</Botao>
    </div>
  );
}

interface Props {
  modo: "participante" | "equipe";
  usuario: Usuario;
  selecionado: string | undefined;
  onSelecionar: (id: string | undefined) => void;
  eventoInicial?: string | undefined;
}

export function CentralSuporte({ modo, usuario, selecionado, onSelecionar, eventoInicial }: Props) {
  const versao = useVersaoBase();
  const base = useMemo(() => carregarBase(), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const { lidoAte, acompanhar } = useSuporte();
  const [novo, setNovo] = useState<{ anterior?: Chamado } | null>(eventoInicial ? {} : null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState({ evento: "", categoria: "", status: "", responsavel: "" });
  const [detalhes, setDetalhes] = useState(false);

  useEffect(() => acompanhar(), [acompanhar]);
  // Painel de detalhes aberto por padrão só em telas largas; no celular ele cobre a conversa.
  useEffect(() => { setDetalhes(window.matchMedia("(min-width: 1024px)").matches); }, []);

  const meus = useMemo(() => base.chamados.filter((c) =>
    modo === "participante" ? c.solicitanteId === usuario.id : podeAtender(base, usuario, c)), [base, modo, usuario]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return meus.filter((c) => {
      if (filtro.evento && (filtro.evento === "plataforma" ? !!c.eventoId : c.eventoId !== filtro.evento)) return false;
      if (filtro.categoria && c.categoria !== filtro.categoria) return false;
      if (filtro.status && statusExibido(base, c) !== filtro.status) return false;
      if (filtro.responsavel) {
        const r = responsavelId(c);
        if (filtro.responsavel === "nenhum" ? !!r : filtro.responsavel === "eu" ? r !== usuario.id : r !== filtro.responsavel) return false;
      }
      if (!q) return true;
      const sol = nome(base.usuarios.find((u) => u.id === c.solicitanteId)).toLowerCase();
      return protocolo(c).toLowerCase().includes(q) || c.assunto.toLowerCase().includes(q) || sol.includes(q);
    });
  }, [meus, busca, filtro, base, usuario.id]);

  // Ordem estável: novos chamados entram no topo, os existentes não pulam enquanto se lê.
  const ordem = useRef<string[]>([]);
  const chaveFiltro = JSON.stringify([busca, filtro, modo]);
  const ultimaChave = useRef("");
  const ordenados = useMemo(() => {
    const porId = new Map(filtrados.map((c) => [c.id, c]));
    if (ultimaChave.current !== chaveFiltro || ordem.current.length === 0) {
      ultimaChave.current = chaveFiltro;
      ordem.current = (modo === "equipe" ? ordenarParaAtendimento(filtrados) : [...filtrados].sort((a, b) => ultimaAtividade(b).localeCompare(ultimaAtividade(a)))).map((c) => c.id);
    } else {
      const novos = filtrados.filter((c) => !ordem.current.includes(c.id)).map((c) => c.id);
      ordem.current = [...novos, ...ordem.current.filter((id) => porId.has(id))];
    }
    return ordem.current.map((id) => porId.get(id)!).filter(Boolean);
  }, [filtrados, chaveFiltro, modo]);

  const atual = selecionado ? meus.find((c) => c.id === selecionado) : undefined;
  const naoEncontrado = !!selecionado && !atual && !novo;

  const indicadores = useMemo(() => {
    const conta = (s: StatusExibido) => meus.filter((c) => statusExibido(base, c) === s).length;
    return { aberto: conta("aberto"), em_atendimento: conta("em_atendimento"), aguardando_participante: conta("aguardando_participante"), aguardando_organizador: conta("aguardando_organizador"), resolvido: conta("resolvido") };
  }, [meus, base]);

  const eventosDaLista = [...new Set(meus.map((c) => c.eventoId).filter(Boolean))].map((id) => base.eventos.find((e) => e.id === id)).filter(Boolean);
  const equipe = base.usuarios.filter((u) => u.ativo && (u.perfil === "admin" || u.perfil === "organizador"));

  const abrirNovo = (anterior?: Chamado) => { setNovo(anterior ? { anterior } : {}); onSelecionar(undefined); };
  const mostrandoPainel = !!atual || !!novo;

  return (
    <div className="space-y-4">
      {modo === "equipe" && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(Object.keys(indicadores) as (keyof typeof indicadores)[]).map((k) => (
            <button key={k} type="button" onClick={() => setFiltro((f) => ({ ...f, status: f.status === k ? "" : k }))}
              className={`rounded-lg border p-3 text-left ${filtro.status === k ? "border-primary bg-primary/10" : "border-border bg-card"}`} aria-pressed={filtro.status === k}>
              <dt className="text-xs text-muted-foreground">{ROTULO_STATUS_EXIBIDO[k]}</dt>
              <dd className="font-display text-2xl font-semibold">{indicadores[k]}</dd>
            </button>
          ))}
        </dl>
      )}

      <div className="flex h-[calc(100dvh-12rem)] min-h-[520px] overflow-hidden rounded-lg border border-border bg-card">
        {/* Lista */}
        <section aria-label="Chamados" className={`${mostrandoPainel ? "hidden md:flex" : "flex"} w-full flex-col border-r border-border md:w-80 md:shrink-0`}>
          <div className="space-y-2 border-b border-border p-3">
            <div className="flex items-center gap-2">
              <label className="relative flex-1">
                <span className="sr-only">Buscar por protocolo, assunto{modo === "equipe" ? " ou solicitante" : ""}</span>
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={modo === "equipe" ? "Protocolo, assunto ou solicitante" : "Buscar chamados"}
                  className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none" />
              </label>
              {modo === "participante" && <Botao type="button" className="!px-3 !py-2" onClick={() => abrirNovo()} aria-label="Abrir chamado"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Novo</span></Botao>}
            </div>
            {modo === "equipe" && (
              <div className="grid grid-cols-2 gap-2">
                <Selecao aria-label="Filtrar por evento" value={filtro.evento} onChange={(e) => setFiltro({ ...filtro, evento: e.target.value })}>
                  <option value="">Todos os eventos</option>
                  {usuario.perfil === "admin" && <option value="plataforma">Plataforma</option>}
                  {eventosDaLista.map((e) => e && <option key={e.id} value={e.id}>{e.nome}</option>)}
                </Selecao>
                <Selecao aria-label="Filtrar por categoria" value={filtro.categoria} onChange={(e) => setFiltro({ ...filtro, categoria: e.target.value })}>
                  <option value="">Todas as categorias</option>
                  {CATEGORIAS_SUPORTE.map((c) => <option key={c}>{c}</option>)}
                </Selecao>
                <Selecao aria-label="Filtrar por status" value={filtro.status} onChange={(e) => setFiltro({ ...filtro, status: e.target.value })}>
                  <option value="">Todos os status</option>
                  {(["aberto", "em_atendimento", "aguardando_participante", "aguardando_organizador", "resolvido", "fechado"] as StatusExibido[]).map((s) => <option key={s} value={s}>{ROTULO_STATUS_EXIBIDO[s]}</option>)}
                </Selecao>
                <Selecao aria-label="Filtrar por responsável" value={filtro.responsavel} onChange={(e) => setFiltro({ ...filtro, responsavel: e.target.value })}>
                  <option value="">Qualquer responsável</option>
                  <option value="eu">Comigo</option>
                  <option value="nenhum">Sem responsável</option>
                  {usuario.perfil === "admin" && equipe.filter((u) => u.id !== usuario.id).map((u) => <option key={u.id} value={u.id}>{nome(u)}</option>)}
                </Selecao>
              </div>
            )}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {ordenados.length === 0 && (
              <li className="p-4"><EstadoVazio titulo="Nenhum chamado" descricao={modo === "participante" ? "Abra um chamado para falar com a organização ou a administração." : "Nenhum chamado com esses filtros."} /></li>
            )}
            {ordenados.map((c) => {
              const n = naoLidas(c, usuario.id, lidoAte(c.id));
              const ult = modo === "equipe" ? c.mensagens.filter((m) => m.tipo !== "sistema" && canalDe(m) === "participante").at(-1) : ultimaMensagem(c);
              const ev = c.eventoId ? base.eventos.find((e) => e.id === c.eventoId) : undefined;
              const resp = responsavelId(c);
              const sel = c.id === selecionado;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => { setNovo(null); onSelecionar(c.id); }} aria-current={sel ? "true" : undefined}
                    className={`block w-full border-b border-border px-3 py-3 text-left hover:bg-secondary/60 ${sel ? "bg-secondary" : ""} ${n > 0 ? "border-l-4 border-l-accent" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className={`min-w-0 truncate text-sm ${n > 0 ? "font-semibold" : "font-medium"}`}>{c.assunto}</p>
                      {n > 0 && <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground" aria-label={`${n} não lidas`}>{n}</span>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{protocolo(c)} · {ev ? ev.nome : "Plataforma"}{modo === "equipe" ? ` · ${nome(base.usuarios.find((u) => u.id === c.solicitanteId))}` : ""}</p>
                    {ult && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{ult.corpo || (ult.anexo ? "📎 Anexo" : "")}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <StatusChamadoBadge s={statusExibido(base, c)} />
                      {modo === "equipe" && pendenteDeResposta(c) && <Badge tom="aviso">Aguardando resposta</Badge>}
                      {modo === "equipe" && retornoRecebido(base, c) && <Badge tom="destaque">Retorno do organizador recebido</Badge>}
                      {modo === "equipe" && <span className="text-[11px] text-muted-foreground">{resp ? `Resp.: ${resp === usuario.id ? "você" : nome(base.usuarios.find((u) => u.id === resp))}` : "Sem responsável"}</span>}
                      <span className="ml-auto text-[11px] text-muted-foreground">{formatarDataHoraBR(ultimaAtividade(c))}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">Atualiza sozinho a cada 15 s e entre abas abertas.</p>
        </section>

        {/* Conversa / novo chamado */}
        <section aria-label="Conversa" className={`${mostrandoPainel ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
          {novo ? (
            <>
              <BotaoVoltar onClick={() => setNovo(null)} />
              <NovoChamado key={novo.anterior?.id ?? "novo"} base={base} usuarioId={usuario.id} eventoInicial={eventoInicial} anterior={novo.anterior}
                onCriado={(id) => { setNovo(null); onSelecionar(id); }} onCancelar={() => setNovo(null)} />
            </>
          ) : atual ? (
            <>
              <CabecalhoConversa base={base} c={atual} detalhes={detalhes} onDetalhes={() => setDetalhes((d) => !d)} onVoltar={() => onSelecionar(undefined)} />
              <div className="relative flex min-h-0 flex-1">
                {modo === "equipe"
                  ? <AreasAtendimento base={base} c={atual} usuario={usuario} />
                  : <Conversa key={atual.id} base={base} chamado={atual} usuarioId={usuario.id} somenteLeitura={atual.status === "fechado"} />}
                {detalhes && <PainelDetalhes base={base} c={atual} usuario={usuario} modo={modo} onNovoVinculado={() => abrirNovo(atual)} onFechar={() => setDetalhes(false)} />}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              {naoEncontrado
                ? <Indisponivel onVoltar={() => onSelecionar(undefined)} />
                : <EstadoVazio titulo="Selecione um chamado" descricao={modo === "participante" ? "Ou abra uma nova solicitação." : "Escolha um chamado na lista para atender."} />}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Duas áreas distintas: conversa com o participante e encaminhamento interno ao organizador. */
function AreasAtendimento({ base, c, usuario }: { base: BaseDados; c: Chamado; usuario: Usuario }) {
  const [aba, setAba] = useState<"participante" | "interno">("participante");
  useEffect(() => setAba("participante"), [c.id]);
  const encs = encaminhamentos(base, c);
  const retorno = retornoRecebido(base, c);
  const abaCls = (ativa: boolean) => `flex-1 border-b-2 px-3 py-2 text-sm font-medium ${ativa ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Área do atendimento" className="flex border-b border-border">
        <button type="button" role="tab" aria-selected={aba === "participante"} className={abaCls(aba === "participante")} onClick={() => setAba("participante")}>Conversa com o participante</button>
        <button type="button" role="tab" aria-selected={aba === "interno"} className={abaCls(aba === "interno")} onClick={() => setAba("interno")}>
          Encaminhamento ao organizador{encs.length > 0 && ` (${encs.length})`}
          {retorno && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">Retorno</span>}
        </button>
      </div>
      {aba === "participante"
        ? <Conversa key={c.id} base={base} chamado={c} usuarioId={usuario.id} somenteLeitura={c.status === "fechado"} rotuloEnviar="Responder ao participante" aviso="Visível para o participante." />
        : <PainelEncaminhamento key={c.id} base={base} c={c} usuario={usuario} />}
    </div>
  );
}

function BotaoVoltar({ onClick }: { onClick: () => void }) {
  return (
    <div className="border-b border-border p-2 md:hidden">
      <Botao type="button" variante="fantasma" className="!px-2 !py-1 text-sm" onClick={onClick}><ArrowLeft className="h-4 w-4" />Chamados</Botao>
    </div>
  );
}

function CabecalhoConversa({ base, c, detalhes, onDetalhes, onVoltar }: { base: BaseDados; c: Chamado; detalhes: boolean; onDetalhes: () => void; onVoltar: () => void }) {
  const ev = c.eventoId ? base.eventos.find((e) => e.id === c.eventoId) : undefined;
  const resp = responsavelId(c);
  return (
    <header className="flex items-start gap-2 border-b border-border px-3 py-3 sm:px-4">
      <Botao type="button" variante="fantasma" className="!px-2 !py-1 md:hidden" onClick={onVoltar} aria-label="Voltar para a lista"><ArrowLeft className="h-4 w-4" /></Botao>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-display text-base font-semibold">{c.assunto}</h2>
        <p className="truncate text-xs text-muted-foreground">
          {protocolo(c)} · {nome(base.usuarios.find((u) => u.id === c.solicitanteId))} · {ev ? ev.nome : "Plataforma"} · Responsável: {resp ? nome(base.usuarios.find((u) => u.id === resp)) : "nenhum"}
        </p>
      </div>
      <StatusChamadoBadge s={statusExibido(base, c)} />
      <Botao type="button" variante="fantasma" className="!px-2 !py-1" onClick={onDetalhes} aria-expanded={detalhes} aria-label={detalhes ? "Recolher detalhes" : "Mostrar detalhes"}>
        {detalhes ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
      </Botao>
    </header>
  );
}

function PainelDetalhes({ base, c, usuario, modo, onNovoVinculado, onFechar }: { base: BaseDados; c: Chamado; usuario: Usuario; modo: Props["modo"]; onNovoVinculado: () => void; onFechar: () => void }) {
  const { sinalizar } = useSuporte();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [resolvendo, setResolvendo] = useState(false);
  const [textoSolucao, setTextoSolucao] = useState("");
  const [atribuir, setAtribuir] = useState("");
  const atende = podeAtender(base, usuario, c);
  const resp = responsavelId(c);
  const ev = c.eventoId ? base.eventos.find((e) => e.id === c.eventoId) : undefined;
  const elegiveis = base.usuarios.filter((u) => u.id !== c.solicitanteId && podeAtender(base, u, c));
  const anterior = vinculadoA(c);
  const sol = solucao(c);

  useEffect(() => { setResolvendo(false); setTextoSolucao(""); setErro(""); setAtribuir(""); }, [c.id]);

  const executar = async (fn: () => Promise<unknown>) => {
    if (ocupado) return;
    setOcupado(true); setErro("");
    try { await fn(); sinalizar(c.id); setResolvendo(false); setTextoSolucao(""); } catch (e) { setErro(e instanceof Error ? e.message : "Falha."); } finally { setOcupado(false); }
  };
  const acao = (a: AcaoStatus, d?: string) => executar(() => alterarStatusChamado(c.id, a, d));

  return (
    <aside aria-label="Detalhes do chamado" className="absolute inset-y-0 right-0 z-10 w-[min(18rem,100%)] overflow-y-auto border-l border-border bg-card p-4 text-sm shadow-xl lg:static lg:w-72 lg:shrink-0 lg:shadow-none">
      <div className="mb-2 flex justify-end lg:hidden"><Botao type="button" variante="fantasma" className="!px-2 !py-1 text-xs" onClick={onFechar}>Fechar detalhes</Botao></div>
      <dl className="space-y-2">
        <div><dt className="text-xs text-muted-foreground">Protocolo</dt><dd className="font-mono text-xs">{protocolo(c)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Tipo</dt><dd>{tipoDoChamado(c) === "evento" ? "Suporte do evento" : "Suporte da plataforma"}</dd></div>
        {ev && <div><dt className="text-xs text-muted-foreground">Evento</dt><dd>{ev.nome}</dd></div>}
        <div><dt className="text-xs text-muted-foreground">Categoria</dt><dd>{c.categoria}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Aberto em</dt><dd>{formatarDataHoraBR(c.criadoEm)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Responsável</dt><dd>{resp ? nome(base.usuarios.find((u) => u.id === resp)) : "Ninguém assumiu ainda"}</dd></div>
        {anterior && <div><dt className="text-xs text-muted-foreground">Continuação de</dt><dd className="font-mono text-xs">{(() => { const a = base.chamados.find((x) => x.id === anterior); return a ? protocolo(a) : "—"; })()}</dd></div>}
        {sol && <div><dt className="text-xs text-muted-foreground">Solução</dt><dd className="whitespace-pre-wrap">{sol}</dd></div>}
      </dl>

      {erro && <p role="alert" className="mt-3 text-xs text-destructive">{erro}</p>}

      <div className="mt-4 space-y-2">
        {modo === "equipe" && atende && ativo(c) && (
          <>
            {resp !== usuario.id && <Botao type="button" className="w-full" disabled={ocupado} onClick={() => executar(() => assumirChamado(c.id))}>Assumir atendimento</Botao>}
            {usuario.perfil === "admin" && (
              <div className="flex gap-2">
                <Selecao aria-label="Atribuir a" value={atribuir} onChange={(e) => setAtribuir(e.target.value)}>
                  <option value="">Atribuir a…</option>
                  {elegiveis.filter((u) => u.id !== resp).map((u) => <option key={u.id} value={u.id}>{nome(u)}{u.perfil === "admin" ? " (admin)" : " (organização)"}</option>)}
                </Selecao>
                <Botao type="button" variante="contorno" className="!px-3" disabled={!atribuir || ocupado} onClick={() => executar(() => assumirChamado(c.id, atribuir))}>OK</Botao>
              </div>
            )}
            {c.status !== "aguardando_participante" && <Botao type="button" variante="contorno" className="w-full" disabled={ocupado} onClick={() => acao("aguardar")}>Aguardar participante</Botao>}
            {resolvendo ? (
              <div className="space-y-2 rounded-md border border-border p-2">
                <label htmlFor="sol" className="text-xs font-medium">Descrição da solução</label>
                <AreaTexto id="sol" rows={3} maxLength={500} value={textoSolucao} onChange={(e) => setTextoSolucao(e.target.value)} />
                <div className="flex gap-2">
                  <Botao type="button" variante="contorno" className="flex-1 !py-1" onClick={() => setResolvendo(false)}>Cancelar</Botao>
                  <Botao type="button" className="flex-1 !py-1" disabled={ocupado || !textoSolucao.trim()} onClick={() => acao("resolver", textoSolucao)}>Resolver</Botao>
                </div>
              </div>
            ) : <Botao type="button" variante="secundario" className="w-full" disabled={ocupado} onClick={() => setResolvendo(true)}>Marcar como resolvido</Botao>}
          </>
        )}
        {c.status === "resolvido" && <Botao type="button" variante="contorno" className="w-full" disabled={ocupado} onClick={() => acao("reabrir")}>Reabrir chamado</Botao>}
        {c.status === "resolvido" && <Botao type="button" variante="fantasma" className="w-full" disabled={ocupado} onClick={() => acao("fechar")}>Fechar chamado</Botao>}
        {c.status === "fechado" && modo === "participante" && <Botao type="button" variante="contorno" className="w-full" onClick={onNovoVinculado}>Abrir nova solicitação vinculada</Botao>}
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">Dados cadastrais (CPF, endereço) não aparecem no atendimento. "Enviada" não significa lida.</p>
    </aside>
  );
}
