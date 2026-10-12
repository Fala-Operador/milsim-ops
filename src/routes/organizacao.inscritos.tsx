import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, Search, SlidersHorizontal, Ticket, Users, UserCheck, X, Eye } from "lucide-react";
import { OperacaoSelecionada } from "@/components/OperacaoSelecionada";
import { entradaAtiva, ROTULO_ORIGEM_ENTRADA, type RegistroCheckin } from "@/lib/checkin";
import { registrosReferencia } from "@/services/checkin";
import { Badge, Botao, Cartao, EstadoVazio, Selecao, Skeleton } from "@/components/ui";
import { useEventoSelecionado, useEventosOrg } from "@/components/organizacao";
import { formatarDataBR } from "@/lib/domain/money";
import { mascararCpf } from "@/lib/domain/validators";
import {
  FILTROS_VAZIOS, ROTULO_ORIGEM, ROTULO_STATUS_INSCRICAO, contarFiltrosAtivos, filtrarInscritos,
  indicadoresInscritos, ordenarEventos, type FiltrosInscritos,
} from "@/lib/inscritos";
import type { Evento, Inscricao } from "@/lib/domain/types";

export const Route = createFileRoute("/organizacao/inscritos")({
  head: () => ({
    meta: [
      { title: "Inscritos por evento — Minha organização — MilSim Ops" },
      { name: "description", content: "Selecione uma operação para consultar e gerenciar seus participantes." },
      { property: "og:title", content: "Inscritos por evento — MilSim Ops" },
      { property: "og:description", content: "Consulte e gerencie os participantes de cada operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaInscritos,
});

function PaginaInscritos() {
  const { base, eventos } = useEventosOrg();
  const ordenados = useMemo(() => ordenarEventos(eventos), [eventos]);
  const [eventoId, setEventoId, invalido] = useEventoSelecionado(ordenados);
  const [trocando, setTrocando] = useState(false);
  const evento = ordenados.find((e) => e.id === eventoId);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(temporizador.current), []);

  function selecionar(id: string) {
    setTrocando(true);
    setEventoId(id);
    // Só o temporizador mais recente encerra o carregamento (troca rápida não mostra dado antigo).
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setTrocando(false), 250);
  }

  return (
    <div className="min-h-[70vh] min-w-0 space-y-6">
      <header>
        <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">Inscritos por evento</h2>
        <p className="mt-1 text-sm text-muted-foreground">Selecione uma operação para consultar e gerenciar seus participantes.</p>
      </header>

      {ordenados.length === 0 ? (
        <EstadoVazio titulo="Sua organização ainda não tem eventos" descricao="Crie um evento no Painel para começar a receber inscrições." />
      ) : (
        <>
          <OperacaoSelecionada eventos={ordenados} evento={evento} invalido={invalido} onSelecionar={selecionar} />
          {evento && (trocando ? (
            <div role="status" aria-label="Carregando evento" className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <ConteudoEvento key={evento.id} evento={evento} inscricoes={base.inscricoes.filter((i) => i.eventoId === evento.id)} usuarios={base.usuarios} />
          ))}
        </>
      )}
    </div>
  );
}

function Indicador({ icone: Icone, rotulo, valor }: { icone: typeof Users; rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg border border-border bg-elevated p-4 shadow-sm">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icone className="h-4 w-4" />{rotulo}</p>
      <p className="mt-1 font-mono text-2xl font-semibold">{valor}</p>
    </div>
  );
}

function ConteudoEvento({ evento, inscricoes, usuarios }: {
  evento: Evento; inscricoes: Inscricao[]; usuarios: { id: string; nomeCompleto: string; cpf: string }[];
}) {
  const [filtros, setFiltros] = useState<FiltrosInscritos>(FILTROS_VAZIOS);
  const [filtrosMobile, setFiltrosMobile] = useState(false);
  const [detalhe, setDetalhe] = useState<Inscricao | null>(null);
  const origemFoco = useRef<HTMLElement | null>(null);
  const abrirDetalhe = (i: Inscricao, el: HTMLElement) => { origemFoco.current = el; setDetalhe(i); };
  const fecharDetalhe = () => { setDetalhe(null); requestAnimationFrame(() => origemFoco.current?.focus()); };
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 10;
  const nomeDe = (i: Inscricao) => usuarios.find((u) => u.id === i.usuarioId)?.nomeCompleto ?? "Participante fictício";
  const ind = indicadoresInscritos(evento, inscricoes);
  const filtradas = filtrarInscritos(inscricoes, filtros, nomeDe);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);
  const ativos = contarFiltrosAtivos(filtros);
  const extras = [filtros.status, filtros.exercito, filtros.tipo].filter(Boolean).length;
  const mudar = (p: Partial<FiltrosInscritos>) => { setFiltros((f) => ({ ...f, ...p })); setPagina(1); };
  const nomeTipo = (id: string) => evento.tipos.find((t) => t.id === id)?.nome ?? "—";
  const nomeEx = (id: string) => evento.exercitos.find((x) => x.id === id)?.nome ?? "—";

  function exportar() {
    const linhas = filtradas.map((i) =>
      [nomeDe(i), i.codigo, nomeTipo(i.tipoId), nomeEx(i.exercitoId), ROTULO_ORIGEM[i.origem], ROTULO_STATUS_INSCRICAO[i.status]].join(";"),
    );
    const csv = "\uFEFF" + `evento;${evento.nome}\nfiltros ativos;${ativos}\n\nnome;codigo;tipo;exercito;origem;status\n` + linhas.join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscritos-${evento.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtrosSelect = (
    <>
      <Selecao aria-label="Filtrar por status" value={filtros.status} onChange={(e) => mudar({ status: e.target.value })}>
        <option value="">Todos os status</option>
        {Object.entries(ROTULO_STATUS_INSCRICAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </Selecao>
      <Selecao aria-label="Filtrar por exército" value={filtros.exercito} onChange={(e) => mudar({ exercito: e.target.value })}>
        <option value="">Todos os exércitos</option>
        {evento.exercitos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
      </Selecao>
      <Selecao aria-label="Filtrar por tipo de ingresso" value={filtros.tipo} onChange={(e) => mudar({ tipo: e.target.value })}>
        <option value="">Todos os ingressos</option>
        {evento.tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </Selecao>
    </>
  );

  return (
    <>
      <section aria-label="Indicadores de inscrições" className="space-y-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Indicador icone={UserCheck} rotulo="Inscrições ativas" valor={ind.ativas} />
          <Indicador icone={Ticket} rotulo="Vagas disponíveis" valor={ind.disponiveis} />
          <Indicador icone={Users} rotulo="Capacidade total" valor={ind.capacidade} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{ind.ativas} de {ind.capacidade} vagas ocupadas</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={ind.ocupacao} aria-valuemin={0} aria-valuemax={100} aria-label="Ocupação">
            <div className="h-full rounded-full bg-primary" style={{ width: `${ind.ocupacao}%` }} />
          </div>
        </div>
      </section>

      <Cartao className="bg-elevated p-0">
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  aria-label="Buscar por nome ou código"
                  placeholder="Buscar por nome ou código da inscrição"
                  value={filtros.busca}
                  onChange={(e) => mudar({ busca: e.target.value })}
                  className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:border-ring focus:outline-none"
                />
              </div>
              <Botao variante="contorno" className="shrink-0 lg:hidden" onClick={() => setFiltrosMobile((v) => !v)} aria-expanded={filtrosMobile}>
                <SlidersHorizontal className="h-4 w-4" /> Filtros{extras > 0 && ` (${extras})`}
              </Botao>
            </div>
            <div className="hidden gap-2 lg:flex">{filtrosSelect}</div>
            <Botao variante="contorno" className="shrink-0" onClick={exportar}><Download className="h-4 w-4" /> Exportar CSV</Botao>
          </div>
          {filtrosMobile && <div className="grid gap-2 sm:grid-cols-3 lg:hidden">{filtrosSelect}</div>}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>{filtradas.length} {filtradas.length === 1 ? "participante encontrado" : "participantes encontrados"} · a exportação usa este evento e os filtros aplicados</span>
            {ativos > 0 && (
              <Botao variante="fantasma" className="px-2 py-1" onClick={() => { setFiltros(FILTROS_VAZIOS); setPagina(1); }}>
                <X className="h-4 w-4" /> Limpar filtros
              </Botao>
            )}
          </div>
        </div>

        {inscricoes.length === 0 ? (
          <div className="p-4"><EstadoVazio titulo="Este evento ainda não tem inscritos" /></div>
        ) : filtradas.length === 0 ? (
          <div className="p-4"><EstadoVazio titulo="Nenhum participante encontrado" descricao="Ajuste a busca ou limpe os filtros." /></div>
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Participante</th>
                  <th className="px-4 py-3">Tipo de ingresso</th>
                  <th className="px-4 py-3">Exército</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">Status da inscrição</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((i) => (
                  <tr key={i.id} className="border-t border-border/60 hover:bg-secondary/40">
                    <td className="px-4 py-3"><Participante nome={nomeDe(i)} codigo={i.codigo} /></td>
                    <td className="px-4 py-3">{nomeTipo(i.tipoId)}</td>
                    <td className="px-4 py-3">{nomeEx(i.exercitoId)}</td>
                    <td className="px-4 py-3">{ROTULO_ORIGEM[i.origem]}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><StatusInscricao status={i.status} /><StatusCheckin presenca={presencaDe(i.id)} /></div></td>
                    <td className="px-4 py-3 text-right">
                      <Botao variante="fantasma" className="px-2 py-1" onClick={(e) => abrirDetalhe(i, e.currentTarget)} aria-label={`Ver detalhes de ${nomeDe(i)}`}>
                        <Eye className="h-4 w-4" /> Detalhes
                      </Botao>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-border md:hidden">
              {visiveis.map((i) => (
                <li key={i.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Participante nome={nomeDe(i)} codigo={i.codigo} />
                    <div className="flex flex-col items-end gap-1"><StatusInscricao status={i.status} /><StatusCheckin presenca={presencaDe(i.id)} /></div>
                  </div>
                  <p className="text-xs text-muted-foreground">{nomeTipo(i.tipoId)} · {nomeEx(i.exercitoId)} · {ROTULO_ORIGEM[i.origem]}</p>
                  <Botao variante="contorno" className="w-full py-1.5" onClick={(e) => abrirDetalhe(i, e.currentTarget)} aria-label={`Ver detalhes de ${nomeDe(i)}`}><Eye className="h-4 w-4" /> Detalhes</Botao>
                </li>
              ))}
            </ul>
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between border-t border-border p-3 text-sm">
                <Botao variante="contorno" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</Botao>
                <span className="text-muted-foreground">Página {paginaAtual} de {totalPaginas}</span>
                <Botao variante="contorno" disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)}>Próxima</Botao>
              </div>
            )}
          </>
        )}
      </Cartao>

      {detalhe && (
        <PainelDetalhes
          inscricao={detalhe}
          evento={evento}
          nome={nomeDe(detalhe)}
          cpf={(() => { const u = usuarios.find((x) => x.id === detalhe.usuarioId); return u ? mascararCpf(u.cpf) : "***"; })()}
          presenca={presencaDe(detalhe.id)}
          onFechar={fecharDetalhe}
        />
      )}
    </>
  );
}

function Participante({ nome, codigo }: { nome: string; codigo: string }) {
  const iniciais = nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground" aria-hidden="true">{iniciais}</span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{nome}</span>
        <span className="block font-mono text-xs text-muted-foreground">{codigo}</span>
      </span>
    </div>
  );
}

function StatusInscricao({ status }: { status: Inscricao["status"] }) {
  return <Badge tom={status === "confirmada" ? "sucesso" : "perigo"}>{status === "confirmada" ? "✓ " : "✕ "}{ROTULO_STATUS_INSCRICAO[status]}</Badge>;
}

function StatusCheckin({ presenca }: { presenca: RegistroCheckin | undefined }) {
  return presenca
    ? <Badge tom="destaque">⛳ Check-in {new Date(presenca.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Badge>
    : <Badge>○ Sem check-in</Badge>;
}

function PainelDetalhes({ inscricao, evento, nome, cpf, presenca, onFechar }: {
  inscricao: Inscricao; evento: Evento; nome: string; cpf: string; presenca: RegistroCheckin | undefined; onFechar: () => void;
}) {
  const fechar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    fechar.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);
  const tipo = evento.tipos.find((t) => t.id === inscricao.tipoId)?.nome ?? "—";
  const lote = inscricao.loteId ? evento.lotes.find((l) => l.id === inscricao.loteId)?.nome ?? "—" : "Sem lote (cortesia)";
  const exercito = evento.exercitos.find((x) => x.id === inscricao.exercitoId)?.nome ?? "—";
  const Linha = ({ r, children }: { r: string; children: ReactNode }) => (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-2"><dt className="text-muted-foreground">{r}</dt><dd className="min-w-0 break-words">{children}</dd></div>
  );
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onFechar}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-detalhe"
        onClick={(e) => e.stopPropagation()}
        className="flex h-[100dvh] w-full flex-col border-l border-border bg-popover text-popover-foreground shadow-2xl md:max-w-md"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h2 id="titulo-detalhe" className="font-display text-lg font-semibold uppercase">Detalhes da inscrição</h2>
          <Botao ref={fechar} variante="fantasma" onClick={onFechar} aria-label="Fechar detalhes"><X className="h-5 w-5" /></Botao>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-sm">
          <div className="flex items-center justify-between gap-3">
            <Participante nome={nome} codigo={inscricao.codigo} />
            <StatusInscricao status={inscricao.status} />
          </div>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inscrição</h3>
            <dl className="mt-1 divide-y divide-border/60">
              <Linha r="Ingresso">{tipo}</Linha>
              <Linha r="Lote">{lote}</Linha>
              <Linha r="Exército">{exercito}</Linha>
              <Linha r="Origem">{ROTULO_ORIGEM[inscricao.origem]}</Linha>
              <Linha r="Inscrito em">{formatarDataBR(inscricao.criadoEm)}</Linha>
              {inscricao.motivoCancelamento && <Linha r="Motivo">{inscricao.motivoCancelamento}</Linha>}
            </dl>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Check-in (presença)</h3>
            <dl className="mt-1 divide-y divide-border/60">
              <Linha r="Situação">{presenca ? "Check-in realizado" : "Ainda não credenciado"}</Linha>
              {presenca && <Linha r="Horário">{new Date(presenca.em).toLocaleString("pt-BR")}</Linha>}
              {presenca && <Linha r="Validação">{ROTULO_ORIGEM_ENTRADA[presenca.origem]} · {presenca.operadorNome}</Linha>}
            </dl>
            <p className="mt-1 text-xs text-muted-foreground">Mostra entradas já sincronizadas. A inscrição confirmada não significa presença.</p>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados pessoais</h3>
            <dl className="mt-1 divide-y divide-border/60">
              <Linha r="Nome">{nome}</Linha>
              <Linha r="CPF"><span className="font-mono">{cpf}</span></Linha>
            </dl>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</h3>
            <p className="mt-2 text-muted-foreground">Para registrar ou desfazer a presença, use a página Check-in.</p>
          </section>
        </div>
      </aside>
    </div>
  );
}
