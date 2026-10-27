import { FaixaIndicadores } from "@/components/FaixaIndicadores";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, Search, SlidersHorizontal, Ticket, Users, UserCheck, X, Eye } from "lucide-react";
import { OperacaoSelecionada } from "@/components/OperacaoSelecionada";
import { IncluirParticipante } from "@/components/IncluirParticipante";
import { entradaAtiva, ROTULO_ORIGEM_ENTRADA, type RegistroCheckin } from "@/lib/checkin";
import { registrosReferencia } from "@/services/checkin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoVazio } from "@/components/ui";
import { StatusInscricao, StatusCheckin } from "@/components/StatusInscricao";
import { useEventoSelecionado, useEventosOrg } from "@/components/organizacao";
import { formatarDataBR } from "@/lib/domain/money";
import { mascararCpf } from "@/lib/domain/validators";
import {
  FILTROS_VAZIOS, ROTULO_ORIGEM, ROTULO_STATUS_INSCRICAO, contarFiltrosAtivos, filtrarInscritos,
  indicadoresInscritos, ordenarEventos, type FiltrosInscritos,
} from "@/lib/inscritos";
import type { Evento, FichaEmergencia, Inscricao } from "@/lib/domain/types";
import { ResumoFichaEmergencia } from "@/components/perfil/FichaEmergencia";
import { DIAS_ANTES_DO_EVENTO } from "@/lib/fichaEmergencia";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";

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
        <h2 className="titulo-pagina">Inscritos por evento</h2>
        <p className="subtitulo-pagina">Selecione uma operação para consultar e gerenciar seus participantes.</p>
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
  evento: Evento; inscricoes: Inscricao[]; usuarios: { id: string; nomeCompleto: string; cpf: string; fichaEmergencia?: FichaEmergencia | undefined }[];
}) {
  const [filtros, setFiltros] = useState<FiltrosInscritos>(FILTROS_VAZIOS);
  const [filtrosMobile, setFiltrosMobile] = useState(false);
  const [detalhe, setDetalhe] = useState<Inscricao | null>(null);
  const origemFoco = useRef<HTMLElement | null>(null);
  const regsCheckin = registrosReferencia(evento.id);
  const presencaDe = (id: string) => entradaAtiva(regsCheckin, id);
  const abrirDetalhe = (i: Inscricao, el: HTMLElement) => { origemFoco.current = el; setDetalhe(i); };
  const fecharDetalhe = () => { setDetalhe(null); requestAnimationFrame(() => origemFoco.current?.focus()); };
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 10;
  const nomeDe = (i: Inscricao) => usuarios.find((u) => u.id === i.usuarioId)?.nomeCompleto ?? "Participante";
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
      <NativeSelect aria-label="Filtrar por status" value={filtros.status} onChange={(e) => mudar({ status: e.target.value })}>
        <option value="">Todos os status</option>
        {Object.entries(ROTULO_STATUS_INSCRICAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </NativeSelect>
      <NativeSelect aria-label="Filtrar por exército" value={filtros.exercito} onChange={(e) => mudar({ exercito: e.target.value })}>
        <option value="">Todos os exércitos</option>
        {evento.exercitos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
      </NativeSelect>
      <NativeSelect aria-label="Filtrar por tipo de ingresso" value={filtros.tipo} onChange={(e) => mudar({ tipo: e.target.value })}>
        <option value="">Todos os ingressos</option>
        {evento.tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </NativeSelect>
    </>
  );

  return (
    <>
      <section aria-label="Indicadores de inscrições" className="space-y-3">
        <div className="rounded-lg border border-border">
          <FaixaIndicadores className="rounded-none border-0 lg:grid-cols-3" itens={[
            { rotulo: "Inscrições ativas", valor: String(ind.ativas) },
            { rotulo: "Vagas disponíveis", valor: String(ind.disponiveis) },
            { rotulo: "Capacidade total", valor: String(ind.capacidade) },
          ]} />
          <div className="border-t border-border px-4 py-3">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Ocupação</span><span className="font-mono">{Math.round(ind.ocupacao)}%</span></div>
            <Progress className="mt-1.5 h-1.5" value={Math.min(ind.ocupacao, 100)} aria-label="Ocupação" indicatorClassName="rounded-full" />
          </div>
        </div>
      </section>

      <Card className="overflow-hidden bg-transparent p-0">
        <div className="space-y-3 border-b border-border p-4">
          <div className="grid min-w-0 grid-cols-2 items-center gap-2 lg:grid-cols-[minmax(240px,1fr)_auto]">
              <div className="relative col-span-2 min-w-0 lg:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  aria-label="Buscar por nome ou código"
                  placeholder="Buscar por nome ou código"
                  value={filtros.busca}
                  onChange={(e) => mudar({ busca: e.target.value })}
                  className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:border-ring focus:outline-none"
                />
              </div>
              <Button variant="outline" className="shrink-0 whitespace-nowrap lg:hidden" onClick={() => setFiltrosMobile((v) => !v)} aria-expanded={filtrosMobile}>
                <SlidersHorizontal className="h-4 w-4" /> Filtros{extras > 0 && ` (${extras})`}
              </Button>
            <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
              <IncluirParticipante evento={evento} className="shrink-0 whitespace-nowrap" />
              <Button variant="outline" className="shrink-0 whitespace-nowrap" onClick={exportar}><Download className="h-4 w-4 shrink-0" /> Exportar CSV</Button>
            </div>
            <div className="col-span-2 hidden min-w-0 grid-cols-3 gap-2 lg:grid">{filtrosSelect}</div>
          </div>
          {filtrosMobile && <div className="grid gap-2 sm:grid-cols-3 lg:hidden">{filtrosSelect}</div>}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>{filtradas.length} {filtradas.length === 1 ? "participante encontrado" : "participantes encontrados"} · a exportação usa este evento e os filtros aplicados</span>
            {ativos > 0 && (
              <Button variant="ghost" className="" onClick={() => { setFiltros(FILTROS_VAZIOS); setPagina(1); }}>
                <X className="h-4 w-4" /> Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {inscricoes.length === 0 ? (
          <div className="p-4"><EstadoVazio titulo="Este evento ainda não tem inscritos" /></div>
        ) : filtradas.length === 0 ? (
          <div className="p-4"><EstadoVazio titulo="Nenhum participante encontrado" descricao="Ajuste a busca ou limpe os filtros." /></div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
            <Table className="w-full min-w-[760px] text-[13px]">
              <TableHeader className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <TableRow>
                  <TableHead className="px-4 py-3">Participante</TableHead>
                  <TableHead className="px-4 py-3">Tipo de ingresso</TableHead>
                  <TableHead className="px-4 py-3">Exército</TableHead>
                  <TableHead className="px-4 py-3">Origem</TableHead>
                  <TableHead className="min-w-[168px] px-4 py-3">Situação</TableHead>
                  <TableHead className="px-4 py-3 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((i) => (
                  <TableRow key={i.id} className="border-t border-border/60 hover:bg-secondary/40">
                    <TableCell className="px-4 py-3"><Participante nome={nomeDe(i)} codigo={i.codigo} /></TableCell>
                    <TableCell className="px-4 py-3">{nomeTipo(i.tipoId)}</TableCell>
                    <TableCell className="px-4 py-3">{nomeEx(i.exercitoId)}</TableCell>
                    <TableCell className="px-4 py-3">{ROTULO_ORIGEM[i.origem]}</TableCell>
                    <TableCell className="min-w-[168px] px-4 py-3"><div className="flex flex-col items-start gap-1.5"><StatusInscricao status={i.status} /><StatusCheckin presenca={presencaDe(i.id)} /></div></TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Button variant="ghost" className="whitespace-nowrap" onClick={(e) => abrirDetalhe(i, e.currentTarget)} aria-label={`Ver detalhes de ${nomeDe(i)}`}>
                        <Eye className="h-4 w-4" /> Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            <ul className="divide-y divide-border md:hidden">
              {visiveis.map((i) => (
                <li key={i.id} className="space-y-2 p-4">
                  <div className="space-y-2">
                    <Participante nome={nomeDe(i)} codigo={i.codigo} />
                    <div className="flex flex-wrap items-center gap-1.5"><StatusInscricao status={i.status} /><StatusCheckin presenca={presencaDe(i.id)} /></div>
                  </div>
                  <p className="text-xs text-muted-foreground">{nomeTipo(i.tipoId)} · {nomeEx(i.exercitoId)} · {ROTULO_ORIGEM[i.origem]}</p>
                  <Button variant="outline" className="w-full" onClick={(e) => abrirDetalhe(i, e.currentTarget)} aria-label={`Ver detalhes de ${nomeDe(i)}`}><Eye className="h-4 w-4" /> Detalhes</Button>
                </li>
              ))}
            </ul>
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between border-t border-border p-3 text-sm">
                <Button variant="outline" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</Button>
                <span className="text-muted-foreground">Página {paginaAtual} de {totalPaginas}</span>
                <Button variant="outline" disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)}>Próxima</Button>
              </div>
            )}
          </>
        )}
      </Card>

      {detalhe && (
        <PainelDetalhes
          inscricao={detalhe}
          evento={evento}
          nome={nomeDe(detalhe)}
          cpf={(() => { const u = usuarios.find((x) => x.id === detalhe.usuarioId); return u ? mascararCpf(u.cpf) : "***"; })()}
          presenca={presencaDe(detalhe.id)}
          ficha={usuarios.find((x) => x.id === detalhe.usuarioId)?.fichaEmergencia}
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
        <span className="block font-medium">{nome}</span>
        <span className="block font-mono text-xs text-muted-foreground">{codigo}</span>
      </span>
    </div>
  );
}

function PainelDetalhes({ inscricao, evento, nome, cpf, presenca, ficha, onFechar }: {
  inscricao: Inscricao; evento: Evento; nome: string; cpf: string; presenca: RegistroCheckin | undefined;
  ficha: FichaEmergencia | undefined; onFechar: () => void;
}) {
  const tipo = evento.tipos.find((t) => t.id === inscricao.tipoId)?.nome ?? "—";
  const lote = inscricao.loteId ? evento.lotes.find((l) => l.id === inscricao.loteId)?.nome ?? "—" : "Sem lote (cortesia)";
  const exercito = evento.exercitos.find((x) => x.id === inscricao.exercitoId)?.nome ?? "—";
  const Linha = ({ r, children }: { r: string; children: ReactNode }) => (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-2"><dt className="text-muted-foreground">{r}</dt><dd className="min-w-0 break-words">{children}</dd></div>
  );
  return (
    <Sheet open onOpenChange={(aberto) => !aberto && onFechar()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        overlayClassName="bg-black/50"
        className="flex h-[100dvh] w-full flex-col gap-0 p-0 shadow-2xl sm:max-w-none md:max-w-md"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <SheetTitle className="uppercase">Detalhes da inscrição</SheetTitle>
          <Button variant="ghost" onClick={onFechar} aria-label="Fechar detalhes"><X className="h-5 w-5" /></Button>
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
          {inscricao.status === "confirmada" && (
            <section>
              {/* Só chega aqui com autorização do participante e na semana do evento (visão). */}
              <ResumoFichaEmergencia ficha={ficha} />
              {!ficha && (
                <p className="mt-1 text-xs text-muted-foreground">
                  A ficha aparece de {DIAS_ANTES_DO_EVENTO} dias antes até o fim do evento, se o participante autorizou.
                </p>
              )}
            </section>
          )}
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
      </SheetContent>
    </Sheet>
  );
}
