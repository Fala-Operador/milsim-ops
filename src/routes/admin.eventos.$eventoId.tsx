import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { cancelamentosDoEvento, visaoGeralEvento } from "@/lib/visaoGeralEvento";
import { nomeModalidade } from "@/lib/modalidades";
import { protocolo, ROTULO_STATUS_EXIBIDO, statusExibido } from "@/lib/suporte";
import { ROTULO_ORIGEM } from "@/lib/inscritos";
import { formatarDataBR, formatarDataHoraBR } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EstadoVazio } from "@/components/ui";
import { StatusInscricao } from "@/components/StatusInscricao";
import { Financeiro, TabelaInscritos } from "@/components/organizacao";
import { IncluirParticipante } from "@/components/IncluirParticipante";

export const Route = createFileRoute("/admin/eventos/$eventoId")({
  head: () => ({
    meta: [
      { title: "Visão geral do evento — Admin MilSim Ops" },
      { name: "description", content: "Ingressos, estornos, financeiro, suporte e engajamento de um evento." },
    ],
  }),
  component: VisaoGeral,
});

type Aba = "resumo" | "financeiro" | "inscricoes" | "suporte";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "resumo", rotulo: "Resumo" },
  { id: "financeiro", rotulo: "Financeiro" },
  { id: "inscricoes", rotulo: "Inscrições" },
  { id: "suporte", rotulo: "Suporte" },
];

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string | number; detalhe?: string | undefined }) {
  return (
    <Card>
      <p className="text-xs uppercase text-muted-foreground">{rotulo}</p>
      <p className="font-display text-2xl font-semibold">{valor}</p>
      {detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}
    </Card>
  );
}

function VisaoGeral() {
  const { eventoId } = Route.useParams();
  useVersaoBase();
  const [aba, setAba] = useState<Aba>("resumo");
  const base = carregarBase();
  const evento = base.eventos.find((e) => e.id === eventoId);
  const v = visaoGeralEvento(base, eventoId);

  if (!evento || !v) {
    return (
      <div className="space-y-4">
        <Link to="/admin"><Button variant="outline"><ArrowLeft aria-hidden="true" /> Voltar ao dashboard</Button></Link>
        <EstadoVazio titulo="Evento não encontrado" descricao="O evento pode ter sido removido ou o endereço está incorreto." />
      </div>
    );
  }

  const org = base.organizacoes.find((o) => o.id === evento.organizacaoId);
  const tom =
    evento.status === "publicado" ? "success" : evento.status === "cancelado" ? "destructive" : evento.status === "rascunho" ? "warning" : "secondary";
  const { ingressos, pagamentos, checkin, suporte } = v;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" aria-hidden="true" /> Dashboard
          </Link>
          <h2 className="mt-1 break-words font-display text-xl font-semibold uppercase">{evento.nome}</h2>
          <p className="text-sm text-muted-foreground">
            {org?.nome ?? "—"} · {formatarDataBR(evento.inicioEm)} · {evento.cidade}/{evento.uf} · {nomeModalidade(evento.modalidade)}
          </p>
          <Badge variant={tom} className="mt-2">{evento.status.replace("_", " ")}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/eventos/$eventoId" params={{ eventoId }}>
            <Button variant="outline">Página pública</Button>
          </Link>
          {evento.status === "publicado" && (
            <Link to="/admin/divulgacao" search={{ aba: "impulsionamentos", evento: eventoId }}>
              <Button variant="outline">Impulsionar operação</Button>
            </Link>
          )}
        </div>
      </div>

      <section aria-label="Indicadores do evento" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Indicador rotulo="Vendidos" valor={`${ingressos.confirmados}/${ingressos.capacidade}`} detalhe={`${ingressos.ocupacao}% de ocupação`} />
        <Indicador rotulo="Aguardando pagamento" valor={ingressos.aguardandoPagamento} />
        <Indicador rotulo="Estornados" valor={ingressos.estornados} detalhe={pagamentos.reembolsosPendentes ? `${pagamentos.reembolsosPendentes} reembolso(s) pendente(s)` : undefined} />
        <Indicador rotulo="Cancelados" valor={ingressos.cancelados} />
        <Indicador rotulo="Check-in" valor={`${checkin.presentes}/${checkin.confirmados}`} detalhe={`${checkin.percentual}% presentes`} />
        <Indicador rotulo="Suporte" valor={suporte.total} detalhe={`${suporte.emAberto} em aberto`} />
      </section>

      <Tabs value={aba} onValueChange={(x) => setAba(x as Aba)}>
        <TabsList className="flex-wrap gap-2">
          {ABAS.map((a) => (
            <TabsTrigger key={a.id} value={a.id} asChild>
              <Button variant={aba === a.id ? "default" : "outline"}>{a.rotulo}</Button>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {aba === "resumo" && <Resumo eventoId={eventoId} v={v} />}
      {aba === "financeiro" && <Financeiro eventoId={eventoId} />}
      {aba === "inscricoes" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <IncluirParticipante evento={evento} />
          </div>
          <TabelaInscritos eventoId={eventoId} />
        </div>
      )}
      {aba === "suporte" && <Suporte v={v} />}
    </div>
  );
}

function Resumo({ eventoId, v }: { eventoId: string; v: NonNullable<ReturnType<typeof visaoGeralEvento>> }) {
  const base = carregarBase();
  const cancelamentos = cancelamentosDoEvento(base, eventoId);
  const e = v.engajamento;
  const origens = (Object.keys(v.porOrigem) as (keyof typeof v.porOrigem)[]).filter((o) => v.porOrigem[o] > 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="font-display text-base font-semibold uppercase">Por tipo de ingresso</h3>
          <Table className="tabela-cards mt-2 w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <TableHead className="py-2 pr-3">Tipo</TableHead>
                <TableHead className="py-2">Vendidos / limite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {v.porTipo.map((t) => (
                <TableRow key={t.id} className="border-b border-border/50">
                  <TableCell className="py-2 pr-3">
                    {t.nome} {t.arquivado && <Badge variant="secondary">arquivado</Badge>}
                  </TableCell>
                  <TableCell data-rotulo="Vendidos / limite" className="py-2 font-mono">{t.vendidos}/{t.limite}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {origens.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Origem dos confirmados: {origens.map((o) => `${ROTULO_ORIGEM[o]} ${v.porOrigem[o]}`).join(" · ")}
            </p>
          )}
        </section>

        <section>
          <h3 className="font-display text-base font-semibold uppercase">Por exército</h3>
          <Table className="tabela-cards mt-2 w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <TableHead className="py-2 pr-3">Exército</TableHead>
                <TableHead className="py-2 pr-3">Confirmados</TableHead>
                <TableHead className="py-2">Check-in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {v.porExercito.map((x) => (
                <TableRow key={x.id} className="border-b border-border/50">
                  <TableCell className="py-2 pr-3">{x.nome}</TableCell>
                  <TableCell data-rotulo="Confirmados" className="py-2 pr-3 font-mono">{x.confirmados}/{x.capacidade}</TableCell>
                  <TableCell data-rotulo="Check-in" className="py-2 font-mono">{x.presentes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>

      <section>
        <h3 className="font-display text-base font-semibold uppercase">Pagamentos online</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {v.pagamentos.pagosOnline} pago(s) · {v.pagamentos.reembolsados} reembolsado(s) · {v.pagamentos.reembolsosPendentes} reembolso(s) pendente(s) ·{" "}
          <span className={v.pagamentos.contestacoesAbertas ? "font-medium text-destructive" : undefined}>
            {v.pagamentos.contestacoesAbertas} contestação(ões) em aberto
          </span>
        </p>
      </section>

      <section>
        <h3 className="font-display text-base font-semibold uppercase">Cancelamentos e estornos</h3>
        {cancelamentos.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Nenhum cancelamento ou estorno.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <Table className="tabela-cards w-full text-sm">
              <TableHeader>
                <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <TableHead className="py-2 pr-3">Participante</TableHead>
                  <TableHead className="py-2 pr-3">Quando</TableHead>
                  <TableHead className="py-2 pr-3">Motivo</TableHead>
                  <TableHead className="py-2">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cancelamentos.map((i) => (
                  <TableRow key={i.id} className="border-b border-border/50">
                    <TableCell className="py-2 pr-3">
                      <p>{base.usuarios.find((u) => u.id === i.usuarioId)?.nomeCompleto ?? "Participante"}</p>
                      <p className="font-mono text-xs text-muted-foreground">{i.codigo}</p>
                    </TableCell>
                    <TableCell data-rotulo="Quando" className="py-2 pr-3">{i.canceladoEm ? formatarDataHoraBR(i.canceladoEm) : "—"}</TableCell>
                    <TableCell data-rotulo="Motivo" className="py-2 pr-3 break-words">{i.motivoCancelamento ?? "—"}</TableCell>
                    <TableCell data-rotulo="Status" className="py-2"><StatusInscricao status={i.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Engajamento: {e.missoes} missão(ões), {e.entregas} entrega(s)
        {e.entregasAguardandoAvaliacao ? ` (${e.entregasAguardandoAvaliacao} aguardando avaliação)` : ""},{" "}
        {e.publicacoes} publicação(ões) na comunidade, {e.denunciasPendentes} denúncia(s) pendente(s),{" "}
        {e.impulsionamentosAtivos} impulsionamento(s) ativo(s).
      </p>
    </div>
  );
}

function Suporte({ v }: { v: NonNullable<ReturnType<typeof visaoGeralEvento>> }) {
  const base = carregarBase();
  const status = Object.entries(v.suporte.porStatus) as [keyof typeof ROTULO_STATUS_EXIBIDO, number][];
  if (v.suporte.total === 0) return <EstadoVazio titulo="Nenhum chamado" descricao="Nenhum chamado de suporte foi aberto sobre este evento." />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status.map(([s, n]) => (
          <Badge key={s} variant="secondary">{ROTULO_STATUS_EXIBIDO[s]}: {n}</Badge>
        ))}
      </div>
      <div className="overflow-x-auto">
        <Table className="tabela-cards w-full text-sm">
          <TableHeader>
            <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <TableHead className="py-2 pr-3">Chamado</TableHead>
              <TableHead className="py-2 pr-3">Categoria</TableHead>
              <TableHead className="py-2 pr-3">Status</TableHead>
              <TableHead className="py-2">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {v.suporte.chamados.map((c) => (
              <TableRow key={c.id} className="border-b border-border/50">
                <TableCell className="py-2 pr-3">
                  <p className="break-words font-medium">{c.assunto}</p>
                  <p className="text-xs text-muted-foreground">
                    {protocolo(c)} · {base.usuarios.find((u) => u.id === c.solicitanteId)?.nomeCompleto ?? "Participante"} · {formatarDataBR(c.criadoEm)}
                  </p>
                </TableCell>
                <TableCell data-rotulo="Categoria" className="py-2 pr-3">{c.categoria}</TableCell>
                <TableCell data-rotulo="Status" className="py-2 pr-3">
                  <Badge variant="secondary">{ROTULO_STATUS_EXIBIDO[statusExibido(base, c)]}</Badge>
                </TableCell>
                <TableCell className="celula-acoes py-2">
                  <Link to="/admin/suporte" search={{ c: c.id }}>
                    <Button variant="outline">Abrir</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
