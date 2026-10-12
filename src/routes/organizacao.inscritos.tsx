import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, CalendarDays, Check, ChevronDown, Download, MapPin, Search, SlidersHorizontal, Ticket, Users, UserCheck, X, Eye } from "lucide-react";
import { Badge, Botao, Cartao, Entrada, EstadoVazio, Modal, Selecao, Skeleton } from "@/components/ui";
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

const ROTULO_STATUS_EVENTO: Record<string, string> = {
  rascunho: "Rascunho", publicado: "Publicado", inscricoes_encerradas: "Inscrições encerradas",
  cancelado: "Cancelado", concluido: "Concluído",
};
const tomStatusEvento = (s: string) =>
  s === "publicado" ? "sucesso" : s === "cancelado" ? "perigo" : s === "rascunho" ? "padrao" : "aviso";

function Miniatura({ evento, tamanho = "h-16 w-16" }: { evento: Evento; tamanho?: string }) {
  return evento.imagemUrl ? (
    <img src={evento.imagemUrl} alt="" className={`${tamanho} shrink-0 rounded-md object-cover`} />
  ) : (
    <div className={`${tamanho} topo-bg grid shrink-0 place-items-center rounded-md bg-secondary font-display text-lg font-bold uppercase text-secondary-foreground`}>
      {evento.nome.slice(0, 2) || "?"}
    </div>
  );
}

function PaginaInscritos() {
  const { base, eventos } = useEventosOrg();
  const ordenados = useMemo(() => ordenarEventos(eventos), [eventos]);
  const [eventoId, setEventoId] = useEventoSelecionado(ordenados);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const botaoTroca = useRef<HTMLButtonElement>(null);
  const evento = ordenados.find((e) => e.id === eventoId);

  function selecionar(id: string) {
    setSeletorAberto(false);
    botaoTroca.current?.focus();
    if (id === eventoId) return;
    setTrocando(true);
    setEventoId(id);
    setTimeout(() => setTrocando(false), 250);
  }

  return (
    <div className="min-h-[70vh] space-y-6">
      <header>
        <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">Inscritos por evento</h2>
        <p className="mt-1 text-sm text-muted-foreground">Selecione uma operação para consultar e gerenciar seus participantes.</p>
      </header>

      {ordenados.length === 0 ? (
        <EstadoVazio titulo="Sua organização ainda não tem eventos" descricao="Crie um evento no Painel para começar a receber inscrições." />
      ) : !evento ? (
        <EstadoVazio titulo="Nenhum evento selecionado" />
      ) : (
        <>
          <section
            aria-label="Operação selecionada"
            className="topo-bg relative flex flex-col gap-4 overflow-hidden rounded-lg border border-border border-l-4 border-l-primary bg-elevated p-4 shadow-sm sm:flex-row sm:items-center"
          >
            <Miniatura evento={evento} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Operação selecionada</p>
              <p className="truncate font-display text-xl font-bold uppercase">{evento.nome || "Sem nome"}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{formatarDataBR(evento.inicioEm)}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{evento.cidade}/{evento.uf}</span>
                <Badge tom={tomStatusEvento(evento.status)}>{ROTULO_STATUS_EVENTO[evento.status] ?? evento.status}</Badge>
              </p>
            </div>
            <Botao
              ref={botaoTroca}
              variante="contorno"
              className="w-full border-primary bg-background sm:w-auto"
              aria-haspopup="dialog"
              aria-expanded={seletorAberto}
              onClick={() => setSeletorAberto(true)}
            >
              <ArrowLeftRight className="h-4 w-4" /> Trocar evento <ChevronDown className="h-4 w-4" />
            </Botao>
          </section>

          {trocando ? (
            <div role="status" aria-label="Carregando evento" className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <ConteudoEvento key={evento.id} evento={evento} inscricoes={base.inscricoes.filter((i) => i.eventoId === evento.id)} usuarios={base.usuarios} />
          )}

          <SeletorEventos
            aberto={seletorAberto}
            eventos={ordenados}
            atual={evento.id}
            onFechar={() => { setSeletorAberto(false); botaoTroca.current?.focus(); }}
            onSelecionar={selecionar}
          />
        </>
      )}
    </div>
  );
}

function SeletorEventos({ aberto, eventos, atual, onFechar, onSelecionar }: {
  aberto: boolean; eventos: Evento[]; atual: string; onFechar: () => void; onSelecionar: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, onFechar]);
  const lista = eventos.filter(
    (e) => (!status || e.status === status) && e.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );
  return (
    <Modal aberto={aberto} titulo="Selecionar evento" onFechar={onFechar}>
      <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            aria-label="Buscar evento por nome"
            placeholder="Buscar por nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:border-ring focus:outline-none"
          />
        </div>
        <Selecao aria-label="Filtrar por status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(ROTULO_STATUS_EVENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </Selecao>
      </div>
      <ul className="mt-4 space-y-2" role="listbox" aria-label="Eventos autorizados">
        {lista.map((e) => {
          const sel = e.id === atual;
          return (
            <li key={e.id}>
              <button
                role="option"
                aria-selected={sel}
                onClick={() => onSelecionar(e.id)}
                className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors hover:bg-secondary ${sel ? "border-primary bg-secondary" : "border-border"}`}
              >
                <Miniatura evento={e} tamanho="h-12 w-12" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.nome || "Sem nome"}</span>
                  <span className="block text-xs text-muted-foreground">{formatarDataBR(e.inicioEm)} · {e.cidade}/{e.uf} · {ROTULO_STATUS_EVENTO[e.status] ?? e.status}</span>
                </span>
                {sel && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary"><Check className="h-4 w-4" />Atual</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {lista.length === 0 && <div className="mt-4"><EstadoVazio titulo="Nenhum evento encontrado" descricao="Tente outro nome ou status." /></div>}
    </Modal>
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
                    <td className="px-4 py-3"><StatusInscricao status={i.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Botao variante="fantasma" className="px-2 py-1" onClick={() => setDetalhe(i)} aria-label={`Ver detalhes de ${nomeDe(i)}`}>
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
                    <StatusInscricao status={i.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{nomeTipo(i.tipoId)} · {nomeEx(i.exercitoId)} · {ROTULO_ORIGEM[i.origem]}</p>
                  <Botao variante="contorno" className="w-full py-1.5" onClick={() => setDetalhe(i)}><Eye className="h-4 w-4" /> Detalhes</Botao>
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

      <Modal aberto={!!detalhe} titulo="Detalhes da inscrição" onFechar={() => setDetalhe(null)}>
        {detalhe && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Participante</dt><dd>{nomeDe(detalhe)}</dd>
            <dt className="text-muted-foreground">CPF</dt>
            <dd className="font-mono">{(() => { const u = usuarios.find((x) => x.id === detalhe.usuarioId); return u ? mascararCpf(u.cpf) : "***"; })()}</dd>
            <dt className="text-muted-foreground">Código</dt><dd className="font-mono">{detalhe.codigo}</dd>
            <dt className="text-muted-foreground">Ingresso</dt><dd>{nomeTipo(detalhe.tipoId)}</dd>
            <dt className="text-muted-foreground">Exército</dt><dd>{nomeEx(detalhe.exercitoId)}</dd>
            <dt className="text-muted-foreground">Origem</dt><dd>{ROTULO_ORIGEM[detalhe.origem]}</dd>
            <dt className="text-muted-foreground">Status</dt><dd><StatusInscricao status={detalhe.status} /></dd>
            <dt className="text-muted-foreground">Inscrito em</dt><dd>{formatarDataBR(detalhe.criadoEm)}</dd>
            {detalhe.motivoCancelamento && (<><dt className="text-muted-foreground">Motivo</dt><dd>{detalhe.motivoCancelamento}</dd></>)}
          </dl>
        )}
      </Modal>
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
