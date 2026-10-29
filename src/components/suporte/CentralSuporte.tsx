// Central de Suporte compartilhada: "participante" (Meus chamados) e "equipe"
// (administração / organização).
// Layout: lista (300 px) + conversa (todo o resto). A adaptação usa a largura do PRÓPRIO
// container (container queries), não a da janela: abaixo de 760 px mostra um painel por
// vez (lista → conversa, com "Voltar aos chamados"). Detalhes abrem sob demanda num painel
// sobreposto à conversa (tela inteira no celular), sem comprimi-la.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Info, LifeBuoy, MessageSquareText, Plus, Search, SlidersHorizontal, WifiOff, X } from "lucide-react";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { useSuporte } from "@/contexts/SuporteContext";
import { alterarStatusChamado, assumirChamado } from "@/api/suporte.functions";
import { PainelEncaminhamento } from "./PainelEncaminhamento";
import {
  ROTULO_STATUS,
  ROTULO_STATUS_EXIBIDO,
  statusExibido,
  retornoRecebido,
  encaminhamentos,
  canalDe,
  type StatusExibido,
  CATEGORIAS_SUPORTE,
  rotuloCategoria,
  acoesPermitidas,
  ativo,
  estadoCompositor,
  naoLidas,
  ordenarParaAtendimento,
  pendenteDeResposta,
  podeAtender,
  protocolo,
  responsavelId,
  solucao,
  tipoDoChamado,
  ultimaAtividade,
  ultimaMensagem,
  vinculadoA,
  type AcaoStatus,
} from "@/lib/suporte";
import { formatarDataHoraBR } from "@/lib/domain/money";
import type { BaseDados, Chamado, StatusChamado, Usuario } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { EstadoVazio } from "@/components/ui";
import { Conversa } from "./Conversa";
import { NovoChamado } from "./NovoChamado";
import { useAlturaDisponivel } from "./useAlturaDisponivel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { Label } from "@/components/ui/label";
import { useConfirmacao } from "@/contexts/ConfirmacaoContext";
import { tr } from "@/i18n/components/suporte/CentralSuporte";

const TOM: Record<StatusExibido, "secondary" | "success" | "warning" | "accent"> = {
  aberto: "accent",
  em_atendimento: "warning",
  aguardando_participante: "secondary",
  aguardando_organizador: "secondary",
  resolvido: "success",
  fechado: "secondary",
};
const nome = (u: Usuario | undefined) => (u ? u.nomeExibicao || u.nomeCompleto : "—");
/** Chamado de evento cujo evento não está mais visível (ex.: voltou a rascunho) não vira "Plataforma". */
const nomeEvento = (c: Chamado, ev: { nome: string } | undefined) =>
  c.eventoId ? (ev?.nome ?? tr("evento_indisponivel")) : tr("plataforma");

export function StatusChamadoBadge({ s }: { s: StatusExibido }) {
  return <Badge variant={TOM[s]}>{ROTULO_STATUS_EXIBIDO[s]}</Badge>;
}

/** Mesma mensagem para inexistente e sem acesso: não revela nada restrito. */
export function Indisponivel({ onVoltar }: { onVoltar: () => void }) {
  return (
    <div className="space-y-3">
      <EstadoVazio
        titulo={tr("esta_solicitacao_nao_esta_disponivel_par")}
        descricao={tr("ela_pode_ter_sido_removida_ou")}
      />
      <Button type="button" variant="outline" onClick={onVoltar}>{tr("voltar_para_meus_atendimentos")}</Button>
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
  const { lidoAte, acompanhar, semConexao } = useSuporte();
  const [novo, setNovo] = useState<{ anterior?: Chamado } | null>(eventoInicial ? {} : null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState({ evento: "", categoria: "", status: "", responsavel: "" });
  const [detalhes, setDetalhes] = useState(false);
  const [situacao, setSituacao] = useState<"todos" | "andamento" | "encerrados">("todos");
  const [verFiltros, setVerFiltros] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const botaoDetalhes = useRef<HTMLButtonElement>(null);
  const altura = useAlturaDisponivel(area);
  // Altura fixa só faz sentido com lista + conversa lado a lado ou com a conversa aberta;
  // no celular a lista sozinha flui com a página (sem caixa vazia até o fim da tela).
  const [duasColunas, setDuasColunas] = useState(false);
  useEffect(() => {
    const el = area.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(([e]) => setDuasColunas((e?.contentRect.width ?? 0) >= 760));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => acompanhar(), [acompanhar]);
  useEffect(() => setDetalhes(false), [selecionado]);

  const meus = useMemo(
    () =>
      base.chamados.filter((c) =>
        modo === "participante" ? c.solicitanteId === usuario.id : podeAtender(base, usuario, c),
      ),
    [base, modo, usuario],
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return meus.filter((c) => {
      if (situacao === "andamento" && !ativo(c)) return false;
      if (situacao === "encerrados" && ativo(c)) return false;
      if (
        filtro.evento &&
        (filtro.evento === "plataforma" ? !!c.eventoId : c.eventoId !== filtro.evento)
      )
        return false;
      if (filtro.categoria && c.categoria !== filtro.categoria) return false;
      if (filtro.status && statusExibido(base, c) !== filtro.status) return false;
      if (filtro.responsavel) {
        const r = responsavelId(c);
        if (
          filtro.responsavel === "nenhum"
            ? !!r
            : filtro.responsavel === "eu"
              ? r !== usuario.id
              : r !== filtro.responsavel
        )
          return false;
      }
      if (!q) return true;
      const sol = nome(base.usuarios.find((u) => u.id === c.solicitanteId)).toLowerCase();
      return (
        protocolo(c).toLowerCase().includes(q) ||
        c.assunto.toLowerCase().includes(q) ||
        sol.includes(q)
      );
    });
  }, [meus, busca, filtro, base, usuario.id, situacao]);

  // Ordem estável: novos chamados entram no topo, os existentes não pulam enquanto se lê.
  const ordem = useRef<string[]>([]);
  const chaveFiltro = JSON.stringify([busca, filtro, modo, situacao]);
  const ultimaChave = useRef("");
  const ordenados = useMemo(() => {
    const porId = new Map(filtrados.map((c) => [c.id, c]));
    if (ultimaChave.current !== chaveFiltro || ordem.current.length === 0) {
      ultimaChave.current = chaveFiltro;
      ordem.current = (
        modo === "equipe"
          ? ordenarParaAtendimento(filtrados)
          : [...filtrados].sort((a, b) => ultimaAtividade(b).localeCompare(ultimaAtividade(a)))
      ).map((c) => c.id);
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
    return {
      aberto: conta("aberto"),
      em_atendimento: conta("em_atendimento"),
      aguardando_participante: conta("aguardando_participante"),
      aguardando_organizador: conta("aguardando_organizador"),
      resolvido: conta("resolvido"),
    };
  }, [meus, base]);

  const eventosDaLista = [...new Set(meus.map((c) => c.eventoId).filter(Boolean))]
    .map((id) => base.eventos.find((e) => e.id === id))
    .filter(Boolean);
  const equipe = base.usuarios.filter(
    (u) => u.ativo && (u.perfil === "admin" || u.perfil === "organizador"),
  );

  const filtrosAtivos = Object.values(filtro).filter(Boolean).length;
  const emAndamento = meus.filter(ativo).length;

  const abrirNovo = (anterior?: Chamado) => {
    setNovo(anterior ? { anterior } : {});
    onSelecionar(undefined);
  };
  const mostrandoPainel = !!atual || !!novo;
  const fecharDetalhes = () => {
    setDetalhes(false);
    botaoDetalhes.current?.focus();
  };

  return (
    <div className="space-y-4">
      {modo === "equipe" && (
        <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-border sm:grid-cols-5 sm:divide-x sm:divide-border">
          {(Object.keys(indicadores) as (keyof typeof indicadores)[]).map((k) => (
            <Toggle
              key={k}
              pressed={filtro.status === k}
              onPressedChange={() => setFiltro((f) => ({ ...f, status: f.status === k ? "" : k }))}
              className="h-auto min-w-0 flex-col items-start rounded-none border-0 px-4 py-3 text-left data-[state=off]:bg-transparent data-[state=on]:bg-secondary data-[state=on]:shadow-[inset_0_-2px_0_var(--accent)]"
            >
              <dt className="rotulo-tecnico truncate">{ROTULO_STATUS_EXIBIDO[k]}</dt>
              <dd className="mt-1 font-display text-3xl font-bold tabular-nums">{indicadores[k]}</dd>
            </Toggle>
          ))}
        </dl>
      )}

      <div
        ref={area}
        style={altura && (duasColunas || mostrandoPainel) ? { height: altura } : undefined}
        className="@container min-h-[280px] rounded-lg border border-border bg-card"
      >
        <div className="grid h-full min-h-0 grid-cols-1 @min-[760px]:grid-cols-[340px_minmax(0,1fr)]">
          {/* ---------- Lista ---------- */}
          <section
            aria-label={tr("chamados")}
            className={`${mostrandoPainel ? "hidden @min-[760px]:flex" : "flex"} min-h-0 min-w-0 flex-col border-border @min-[760px]:border-r`}
          >
            <div className="space-y-2.5 border-b border-border p-3">
              <div className="flex items-center gap-2">
                <Label className="relative min-w-0 flex-1 text-[length:inherit] font-normal text-inherit">
                  <span className="sr-only">{tr("buscar_por_protocolo_assunto")}{modo === "equipe" ? ` ${tr("ou_solicitante")}` : ""}
                  </span>
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                  />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder={
                      modo === "equipe" ? tr("protocolo_assunto_ou_solicitante") : tr("buscar_chamados")
                    }
                    className="h-9 w-full min-w-0 rounded-md border border-input bg-background pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 py-0"
                  />
                </Label>
                {modo === "participante" ? (
                  <Button type="button" className="h-9 shrink-0 !px-3" onClick={() => abrirNovo()}>
                    <Plus className="h-4 w-4" />{tr("novo")}</Button>
                ) : (
                  <Button type="button" variant="outline" className="relative h-9 shrink-0 !px-3" aria-expanded={verFiltros} onClick={() => setVerFiltros((v) => !v)}>
                    <SlidersHorizontal className="h-4 w-4" />{tr("filtros")}{filtrosAtivos > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold leading-4 text-accent-foreground">{filtrosAtivos}</span>}
                  </Button>
                )}
              </div>
              {modo === "participante" && (
                <div role="group" aria-label={tr("situacao")} className="grid grid-cols-3 gap-0.5 rounded-md bg-secondary/50 p-0.5 text-xs font-medium">
                  {([["todos", tr("todos_length", { length: meus.length })], ["andamento", tr("abertos_emandamento", { emAndamento })], ["encerrados", tr("encerrados_valor", { valor: meus.length - emAndamento })]] as const).map(([v, r]) => (
                    <Button key={v} type="button" variant="plain" size="none" aria-pressed={situacao === v} onClick={() => setSituacao(v)}
                      className={`h-7 truncate rounded px-2 ${situacao === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                      {r}
                    </Button>
                  ))}
                </div>
              )}
              {modo === "equipe" && verFiltros && (
                <div className="grid grid-cols-2 gap-2">
                  <NativeSelect
                    aria-label={tr("filtrar_por_evento")}
                    value={filtro.evento}
                    onChange={(e) => setFiltro({ ...filtro, evento: e.target.value })}
                  >
                    <option value="">{tr("todos_os_eventos")}</option>
                    {usuario.perfil === "admin" && <option value="plataforma">{tr("plataforma")}</option>}
                    {eventosDaLista.map(
                      (e) =>
                        e && (
                          <option key={e.id} value={e.id}>
                            {e.nome}
                          </option>
                        ),
                    )}
                  </NativeSelect>
                  <NativeSelect
                    aria-label={tr("filtrar_por_categoria")}
                    value={filtro.categoria}
                    onChange={(e) => setFiltro({ ...filtro, categoria: e.target.value })}
                  >
                    <option value="">{tr("todas_as_categorias")}</option>
                    {CATEGORIAS_SUPORTE.map((c) => (
                      <option key={c} value={c}>{rotuloCategoria(c)}</option>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    aria-label={tr("filtrar_por_status")}
                    value={filtro.status}
                    onChange={(e) => setFiltro({ ...filtro, status: e.target.value })}
                  >
                    <option value="">{tr("todos_os_status")}</option>
                    {(Object.keys(ROTULO_STATUS_EXIBIDO) as StatusExibido[]).map((s) => (
                      <option key={s} value={s}>
                        {ROTULO_STATUS_EXIBIDO[s]}
                      </option>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    aria-label={tr("filtrar_por_responsavel")}
                    value={filtro.responsavel}
                    onChange={(e) => setFiltro({ ...filtro, responsavel: e.target.value })}
                  >
                    <option value="">{tr("qualquer_responsavel")}</option>
                    <option value="eu">{tr("comigo")}</option>
                    <option value="nenhum">{tr("sem_responsavel")}</option>
                    {usuario.perfil === "admin" &&
                      equipe
                        .filter((u) => u.id !== usuario.id)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {nome(u)}
                          </option>
                        ))}
                  </NativeSelect>
                </div>
              )}
            </div>
            <ul className="rolagem-discreta min-h-0 flex-1">
              {ordenados.length === 0 && (
                <li className="p-4">
                  <EstadoVazio
                    titulo={tr("nenhum_chamado")}
                    descricao={
                      modo === "participante"
                        ? tr("abra_um_chamado_para_falar_com")
                        : tr("nenhum_chamado_com_esses_filtros")
                    }
                  />
                </li>
              )}
              {ordenados.map((c) => {
                const n = naoLidas(c, usuario.id, lidoAte(c.id));
                // Equipe: prévia só da conversa com o participante (nunca do canal interno).
                const ult = modo === "equipe" ? c.mensagens.filter((m) => m.tipo !== "sistema" && canalDe(m) === "participante").at(-1) : ultimaMensagem(c);
                const ev = c.eventoId ? base.eventos.find((e) => e.id === c.eventoId) : undefined;
                const resp = responsavelId(c);
                const sel = c.id === selecionado;
                return (
                  <li key={c.id}>
                    <Button variant="plain" size="none"
                      type="button"
                      onClick={() => {
                        setNovo(null);
                        onSelecionar(c.id);
                      }}
                      aria-current={sel ? "true" : undefined}
                      className={`relative block w-full min-w-0 border-b border-border px-4 py-3 text-left hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${sel ? "bg-secondary before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent" : ""}`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className={`line-clamp-2 min-w-0 break-words text-sm ${n > 0 ? "font-semibold" : "font-medium"}`}>
                          {n > 0 && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent align-middle" aria-hidden="true" />}
                          {c.assunto}
                        </p>
                        <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                          {formatarDataHoraBR(ultimaAtividade(c)).slice(0, 5)}
                        </span>
                      </div>
                      {ult && (
                        <p className="mt-1 line-clamp-1 break-all text-xs text-muted-foreground">
                          {ult.corpo || (ult.anexo ? tr("anexo") : "")}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <StatusChamadoBadge s={statusExibido(base, c)} />
                        {modo === "equipe" && retornoRecebido(base, c) && <Badge variant="accent">{tr("retorno_do_organizador")}</Badge>}
                        {modo === "equipe" && pendenteDeResposta(c) && (
                          <Badge variant="warning">{tr("aguardando_resposta")}</Badge>
                        )}
                        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                          {c.eventoId ? <CalendarDays className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" /> : <LifeBuoy className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />}
                          {nomeEvento(c, ev)}
                          {modo === "equipe" ? ` · ${nome(base.usuarios.find((u) => u.id === c.solicitanteId))}` : ""}
                        </span>
                        {n > 0 && (
                          <span className="ml-auto shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-accent-foreground" aria-label={tr("n_nao_lidas", { n })}>
                            {n}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span className="truncate">{protocolo(c)}</span>
                        {modo === "equipe" && (
                          <span className="shrink-0 normal-case tracking-normal">
                            {resp ? tr("resp_valor", { valor: resp === usuario.id ? tr("voce_minusculo") : nome(base.usuarios.find((u) => u.id === resp)) }) : tr("sem_responsavel")}
                          </span>
                        )}
                      </p>
                    </Button>
                  </li>
                );
              })}
            </ul>
            {semConexao && (
              <p
                role="status"
                className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-xs text-warning"
              >
                <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{tr("sem_conexao_tentando_novamente")}</p>
            )}
          </section>

          {/* ---------- Conversa / novo chamado ---------- */}
          <section
            aria-label={tr("conversa")}
            className={`${mostrandoPainel ? "flex" : "hidden @min-[760px]:flex"} relative min-h-0 min-w-0 flex-col`}
          >
            {novo ? (
              <>
                <BotaoVoltar onClick={() => setNovo(null)} />
                <NovoChamado
                  key={novo.anterior?.id ?? "novo"}
                  base={base}
                  usuarioId={usuario.id}
                  eventoInicial={eventoInicial}
                  anterior={novo.anterior}
                  onCriado={(id) => {
                    setNovo(null);
                    onSelecionar(id);
                  }}
                  onCancelar={() => setNovo(null)}
                />
              </>
            ) : atual ? (
              <>
                <BotaoVoltar onClick={() => onSelecionar(undefined)} />
                <CabecalhoConversa
                  base={base}
                  c={atual}
                  modo={modo}
                  botao={botaoDetalhes}
                  detalhes={detalhes}
                  onDetalhes={() => setDetalhes((d) => !d)}
                />
                {(() => {
                  const rodape =
                    estadoCompositor(atual, atual.solicitanteId === usuario.id) === "livre" ? null : (
                      <RodapeStatus c={atual} usuario={usuario} modo={modo} onNovoVinculado={() => abrirNovo(atual)} />
                    );
                  return modo === "equipe" ? (
                    <AreasAtendimento base={base} c={atual} usuario={usuario} rodape={rodape} />
                  ) : (
                    <Conversa key={atual.id} base={base} chamado={atual} usuarioId={usuario.id} rodape={rodape} />
                  );
                })()}
                {detalhes && (
                  <PainelDetalhes
                    base={base}
                    c={atual}
                    usuario={usuario}
                    modo={modo}
                    onNovoVinculado={() => abrirNovo(atual)}
                    onFechar={fecharDetalhes}
                  />
                )}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-center">
                {naoEncontrado ? (
                  <Indisponivel onVoltar={() => onSelecionar(undefined)} />
                ) : modo === "participante" ? (
                  <ComoFunciona onNovo={() => abrirNovo()} />
                ) : (
                  <ResumoFila
                    semResponsavel={meus.filter((c) => ativo(c) && !responsavelId(c)).length}
                    aguardando={meus.filter((c) => ativo(c) && pendenteDeResposta(c)).length}
                    comigo={meus.filter((c) => ativo(c) && responsavelId(c) === usuario.id).length}
                  />
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Sem chamado aberto (participante): como o atendimento funciona, em três passos. */
function ComoFunciona({ onNovo }: { onNovo: () => void }) {
  const passos = [
    { icone: MessageSquareText, titulo: tr("abra_um_chamado"), texto: tr("escolha_se_e_sobre_uma_operacao") },
    { icone: LifeBuoy, titulo: tr("a_administracao_responde"), texto: tr("quando_o_assunto_e_do_evento") },
    { icone: CheckCircle2, titulo: tr("resolvido"), texto: tr("se_ainda_precisar_de_ajuda_reabra") },
  ];
  return (
    <div className="w-full max-w-md text-left">
      <p className="rotulo-tecnico">{tr("central_de_suporte")}</p>
      <h2 className="mt-1 font-display text-2xl font-bold uppercase leading-tight">{tr("como_funciona_o_atendimento")}</h2>
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
      <Button type="button" className="mt-6" onClick={onNovo}><Plus className="h-4 w-4" />{tr("abrir_um_chamado")}</Button>
    </div>
  );
}

/** Sem chamado aberto (equipe): o que pede atenção na fila agora. */
function ResumoFila({ semResponsavel, aguardando, comigo }: { semResponsavel: number; aguardando: number; comigo: number }) {
  const itens = [
    { rotulo: tr("sem_responsavel"), valor: semResponsavel, texto: tr("assuma_para_comecar_o_atendimento") },
    { rotulo: tr("aguardando_resposta"), valor: aguardando, texto: tr("o_participante_escreveu_por_ultimo") },
    { rotulo: tr("com_voce"), valor: comigo, texto: tr("chamados_ativos_sob_sua_responsabilidade") },
  ];
  return (
    <div className="w-full max-w-md text-left">
      <p className="rotulo-tecnico">{tr("fila_de_atendimento")}</p>
      <h2 className="mt-1 font-display text-2xl font-bold uppercase leading-tight">{tr("escolha_um_chamado_na_lista")}</h2>
      <dl className="mt-5 divide-y divide-border rounded-lg border border-border bg-background/40">
        {itens.map((i) => (
          <div key={i.rotulo} className="flex items-center gap-4 px-4 py-3">
            <dd className="w-10 shrink-0 font-display text-3xl font-bold tabular-nums">{i.valor}</dd>
            <div className="min-w-0">
              <dt className="text-sm font-medium">{i.rotulo}</dt>
              <p className="text-xs text-muted-foreground">{i.texto}</p>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Só aparece quando lista e conversa não cabem lado a lado. */
/**
 * Admin: duas áreas distintas — conversa com o participante e encaminhamento interno ao
 * organizador (o participante nunca vê o canal interno; a visão do servidor já o remove).
 */
function AreasAtendimento({ base, c, usuario, rodape }: { base: BaseDados; c: Chamado; usuario: Usuario; rodape: React.ReactNode }) {
  const [aba, setAba] = useState<"participante" | "interno">("participante");
  useEffect(() => setAba("participante"), [c.id]);
  const encs = encaminhamentos(base, c);
  const retorno = retornoRecebido(base, c);
  const abaCls = (ativa: boolean) =>
    `min-w-0 flex-1 border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${ativa ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
      <TabsList aria-label={tr("area_do_atendimento")} className="min-w-0 border-b border-border">
        <TabsTrigger value="participante" className={abaCls(aba === "participante")}>{tr("conversa_com_o_participante")}</TabsTrigger>
        <TabsTrigger value="interno" className={abaCls(aba === "interno")}>{tr("encaminhamento_ao_organizador")}{encs.length > 0 && ` (${encs.length})`}
          {retorno && <span className="ml-1.5 whitespace-nowrap rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">{tr("retorno")}</span>}
        </TabsTrigger>
      </TabsList>
      </Tabs>
      {aba === "participante" ? (
        <Conversa key={c.id} base={base} chamado={c} usuarioId={usuario.id} rodape={rodape}
          rotuloEnviar={tr("responder_ao_participante")} aviso={tr("visivel_para_o_participante")} />
      ) : (
        <PainelEncaminhamento key={c.id} base={base} c={c} usuario={usuario} />
      )}
    </div>
  );
}

function BotaoVoltar({ onClick }: { onClick: () => void }) {
  return (
    <div className="border-b border-border px-2 py-1.5 @min-[760px]:hidden">
      <Button type="button" variant="ghost" className="!px-2 !py-1 text-sm" onClick={onClick}>
        <ArrowLeft className="h-4 w-4" />{tr("voltar_aos_chamados")}</Button>
    </div>
  );
}

function CabecalhoConversa({
  base,
  c,
  modo,
  botao,
  detalhes,
  onDetalhes,
}: {
  base: BaseDados;
  c: Chamado;
  modo: Props["modo"];
  botao: React.RefObject<HTMLButtonElement | null>;
  detalhes: boolean;
  onDetalhes: () => void;
}) {
  const solicitante =
    modo === "equipe" ? nome(base.usuarios.find((u) => u.id === c.solicitanteId)) : null;
  return (
    <header className="flex items-start gap-3 border-b border-border px-3 py-3 sm:px-4">
      <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-md bg-secondary text-accent @min-[480px]:grid" aria-hidden="true">
        {c.eventoId ? <CalendarDays className="h-5 w-5" /> : <LifeBuoy className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="line-clamp-2 break-words font-display text-lg font-bold uppercase leading-tight">
          {c.assunto}
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <StatusChamadoBadge s={statusExibido(base, c)} />
          <span className="font-mono">{protocolo(c)}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{nomeEvento(c, c.eventoId ? base.eventos.find((e) => e.id === c.eventoId) : undefined)}</span>
          <span aria-hidden="true">·</span>
          <span>{rotuloCategoria(c.categoria)}</span>
          {solicitante && <><span aria-hidden="true">·</span><span className="truncate">{solicitante}</span></>}
        </div>
      </div>
      <Button
        ref={botao}
        type="button"
        variant={detalhes ? "secondary" : "ghost"}
        aria-label={tr("detalhes_do_chamado")}
        className="shrink-0 !px-2.5"
        onClick={onDetalhes}
        aria-expanded={detalhes}
        aria-controls="detalhes-chamado"
        aria-haspopup="dialog"
      >
        <Info className="h-4 w-4" />
        <span className="hidden @min-[480px]:inline">{tr("detalhes")}</span>
      </Button>
    </header>
  );
}

/** Área inferior quando o chamado não aceita mensagens do solicitante. */
function RodapeStatus({
  c,
  usuario,
  modo,
  onNovoVinculado,
}: {
  c: Chamado;
  usuario: Usuario;
  modo: Props["modo"];
  onNovoVinculado: () => void;
}) {
  const { sinalizar } = useSuporte();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const estado = estadoCompositor(c, c.solicitanteId === usuario.id);
  if (estado === "livre") return null;
  const reabrir = async () => {
    setOcupado(true);
    setErro("");
    try {
      await alterarStatusChamado(c.id, "reabrir");
      sinalizar(c.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : tr("falha_ao_reabrir"));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="border-t border-border bg-card px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-muted-foreground">
          {estado === "resolvido"
            ? tr("este_chamado_foi_resolvido")
            : tr("este_chamado_foi_fechado_e_esta")}
        </p>
        {estado === "resolvido" && (
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={ocupado}
            onClick={reabrir}
          >
            {ocupado ? tr("reabrindo") : tr("reabrir_chamado")}
          </Button>
        )}
        {estado === "fechado" && modo === "participante" && (
          <Button type="button" variant="outline" className="shrink-0" onClick={onNovoVinculado}>{tr("abrir_novo_chamado")}</Button>
        )}
      </div>
      {erro && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}

function PainelDetalhes({
  base,
  c,
  usuario,
  modo,
  onNovoVinculado,
  onFechar,
}: {
  base: BaseDados;
  c: Chamado;
  usuario: Usuario;
  modo: Props["modo"];
  onNovoVinculado: () => void;
  onFechar: () => void;
}) {
  const { sinalizar } = useSuporte();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [resolvendo, setResolvendo] = useState(false);
  const [textoSolucao, setTextoSolucao] = useState("");
  const [atribuir, setAtribuir] = useState("");
  const { confirmar } = useConfirmacao();
  const fechar = useRef<HTMLButtonElement>(null);
  const atende = podeAtender(base, usuario, c);
  const solicitante = c.solicitanteId === usuario.id;
  const permitidas = acoesPermitidas(c, atende, solicitante);
  const resp = responsavelId(c);
  const ev = c.eventoId ? base.eventos.find((e) => e.id === c.eventoId) : undefined;
  const elegiveis = base.usuarios.filter(
    (u) => u.id !== c.solicitanteId && podeAtender(base, u, c),
  );
  const anterior = vinculadoA(c);
  const sol = solucao(c);

  useEffect(() => {
    setResolvendo(false);
    setTextoSolucao("");
    setErro("");
    setAtribuir("");
  }, [c.id]);
  // Foco no botão de fechar ao abrir; Escape fecha (o foco volta para "Detalhes").
  const aoFechar = useRef(onFechar);
  aoFechar.current = onFechar;
  useEffect(() => {
    fechar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        aoFechar.current();
      }
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, []);

  const executar = async (fn: () => Promise<unknown>) => {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      await fn();
      sinalizar(c.id);
      setResolvendo(false);
      setTextoSolucao("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : tr("falha"));
    } finally {
      setOcupado(false);
    }
  };
  const acao = (a: AcaoStatus, d?: string) => executar(() => alterarStatusChamado(c.id, a, d));
  const pode = (a: AcaoStatus) => permitidas.includes(a);

  const campo = (rotulo: string, valor: React.ReactNode, mono = false) => (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className={`mt-0.5 break-words ${mono ? "break-all font-mono text-xs" : ""}`}>{valor}</dd>
    </div>
  );

  return (
    <aside
      id="detalhes-chamado"
      role="dialog"
      aria-modal="false"
      aria-labelledby="detalhes-titulo"
      className="absolute inset-y-0 right-0 z-20 flex w-[min(22rem,100%)] flex-col border-l border-border bg-card text-sm shadow-2xl max-sm:fixed max-sm:inset-0 max-sm:z-50 max-sm:w-full max-sm:border-l-0"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 id="detalhes-titulo" className="font-display text-base font-semibold">{tr("detalhes_do_chamado")}</h3>
        <Button
          ref={fechar}
          type="button"
          variant="ghost"
          className="shrink-0 !px-2 !py-1"
          onClick={onFechar}
          aria-label={tr("fechar_detalhes")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="rolagem-discreta min-h-0 flex-1 px-4 py-4">
        <dl className="space-y-3">
          {campo(tr("assunto"), c.assunto)}
          {campo(tr("protocolo"), protocolo(c), true)}
          {campo(tr("status"), <StatusChamadoBadge s={statusExibido(base, c)} />)}
          {campo(
            tr("tipo"),
            tipoDoChamado(c) === "evento" ? tr("suporte_do_evento") : tr("suporte_da_plataforma"),
          )}
          {campo(tr("evento"), nomeEvento(c, ev))}
          {campo(tr("categoria"), rotuloCategoria(c.categoria))}
          {modo === "equipe" &&
            campo(tr("solicitante"), nome(base.usuarios.find((u) => u.id === c.solicitanteId)))}
          {campo(tr("aberto_em"), formatarDataHoraBR(c.criadoEm))}
          {campo(tr("ultima_atualizacao"), formatarDataHoraBR(ultimaAtividade(c)))}
          {campo(
            tr("responsavel"),
            resp ? nome(base.usuarios.find((u) => u.id === resp)) : tr("aguardando_a_equipe_assumir"),
          )}
          {anterior &&
            campo(
              tr("continuacao_de"),
              (() => {
                const a = base.chamados.find((x) => x.id === anterior);
                return a ? protocolo(a) : "—";
              })(),
              true,
            )}
          {sol && campo(tr("solucao"), <span className="whitespace-pre-wrap">{sol}</span>)}
        </dl>

        {erro && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {erro}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {modo === "equipe" && atende && ativo(c) && (
            <>
              {resp !== usuario.id && (
                <Button
                  type="button"
                  className="w-full"
                  disabled={ocupado}
                  onClick={() => executar(() => assumirChamado(c.id))}
                >{tr("assumir_atendimento")}</Button>
              )}
              {usuario.perfil === "admin" && (
                <div className="flex min-w-0 flex-wrap gap-2">
                  <div className="min-w-0 flex-1">
                    <NativeSelect
                      aria-label={tr("atribuir_a")}
                      value={atribuir}
                      onChange={(e) => setAtribuir(e.target.value)}
                    >
                      <option value="">{tr("atribuir_a_2")}</option>
                      {elegiveis
                        .filter((u) => u.id !== resp)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {nome(u)}
                            {u.perfil === "admin" ? ` ${tr("admin")}` : ` ${tr("organizacao")}`}
                          </option>
                        ))}
                    </NativeSelect>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 !px-3"
                    disabled={!atribuir || ocupado}
                    onClick={() => executar(() => assumirChamado(c.id, atribuir))}
                  >{tr("atribuir")}</Button>
                </div>
              )}
              {pode("aguardar") && c.status !== "aguardando_participante" && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={ocupado}
                  onClick={() => acao("aguardar")}
                >{tr("aguardar_participante")}</Button>
              )}
              {resolvendo ? (
                <div className="space-y-2 rounded-md border border-border p-2">
                  <Label htmlFor="sol" className="text-xs font-medium text-inherit">{tr("descricao_da_solucao")}</Label>
                  <Textarea
                    id="sol"
                    rows={3}
                    maxLength={500}
                    value={textoSolucao}
                    onChange={(e) => setTextoSolucao(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 !py-1"
                      onClick={() => setResolvendo(false)}
                    >{tr("cancelar")}</Button>
                    <Button
                      type="button"
                      className="flex-1 !py-1"
                      disabled={ocupado || !textoSolucao.trim()}
                      onClick={() => acao("resolver", textoSolucao)}
                    >{tr("resolver")}</Button>
                  </div>
                </div>
              ) : (
                pode("resolver") && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={ocupado}
                    onClick={() => setResolvendo(true)}
                  >{tr("marcar_como_resolvido")}</Button>
                )
              )}
            </>
          )}
          {pode("reabrir") && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={ocupado}
              onClick={() => acao("reabrir")}
            >{tr("reabrir_chamado")}</Button>
          )}
          {/* Fechar: só quando a regra permite; para a equipe, como antes, após resolver. */}
          {pode("fechar") && (modo === "participante" || c.status === "resolvido") && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={ocupado}
              onClick={async () => {
                if (await confirmar({ titulo: tr("fechar_este_chamado"), descricao: tr("depois_de_fechado_ele_fica_somente"), confirmar: tr("fechar_chamado") }))
                  void acao("fechar");
              }}
            >{tr("fechar_chamado")}</Button>
          )}
          {c.status === "fechado" && modo === "participante" && (
            <Button type="button" variant="outline" className="w-full" onClick={onNovoVinculado}>{tr("abrir_novo_chamado")}</Button>
          )}
        </div>
      </div>
    </aside>
  );
}
