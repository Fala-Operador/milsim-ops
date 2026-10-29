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
import { tr } from "@/i18n/routes/admin.eventos.$eventoId";

export const Route = createFileRoute("/admin/eventos/$eventoId")({
  head: () => ({
    meta: [
      { title: tr("visao_geral_do_evento_admin_milsim") },
      { name: "description", content: tr("ingressos_estornos_financeiro_suporte_e") },
    ],
  }),
  component: VisaoGeral,
});

type Aba = "resumo" | "financeiro" | "inscricoes" | "suporte";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "resumo", get rotulo() { return tr("resumo"); } },
  { id: "financeiro", get rotulo() { return tr("financeiro"); } },
  { id: "inscricoes", get rotulo() { return tr("inscricoes"); } },
  { id: "suporte", get rotulo() { return tr("suporte"); } },
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
        <Link to="/admin"><Button variant="outline"><ArrowLeft aria-hidden="true" />{" "}{tr("voltar_ao_dashboard")}</Button></Link>
        <EstadoVazio titulo={tr("evento_nao_encontrado")} descricao={tr("o_evento_pode_ter_sido_removido")} />
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
            <ArrowLeft className="size-3" aria-hidden="true" />{" "}{tr("dashboard")}</Link>
          <h2 className="mt-1 break-words font-display text-xl font-semibold uppercase">{evento.nome}</h2>
          <p className="text-sm text-muted-foreground">
            {org?.nome ?? "—"} · {formatarDataBR(evento.inicioEm)} · {evento.cidade}/{evento.uf} · {nomeModalidade(evento.modalidade)}
          </p>
          <Badge variant={tom} className="mt-2">{evento.status.replace("_", " ")}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/eventos/$eventoId" params={{ eventoId }}>
            <Button variant="outline">{tr("pagina_publica")}</Button>
          </Link>
          {evento.status === "publicado" && (
            <Link to="/admin/divulgacao" search={{ aba: "impulsionamentos", evento: eventoId }}>
              <Button variant="outline">{tr("impulsionar_operacao")}</Button>
            </Link>
          )}
        </div>
      </div>

      <section aria-label={tr("indicadores_do_evento")} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Indicador rotulo={tr("vendidos")} valor={`${ingressos.confirmados}/${ingressos.capacidade}`} detalhe={tr("ocupacao_de_ocupacao", { ocupacao: ingressos.ocupacao })} />
        <Indicador rotulo={tr("aguardando_pagamento")} valor={ingressos.aguardandoPagamento} />
        <Indicador rotulo={tr("estornados")} valor={ingressos.estornados} detalhe={pagamentos.reembolsosPendentes ? tr("reembolsospendentes_reembolso_s_pendente", { reembolsosPendentes: pagamentos.reembolsosPendentes }) : undefined} />
        <Indicador rotulo={tr("cancelados")} valor={ingressos.cancelados} />
        <Indicador rotulo={tr("check_in")} valor={`${checkin.presentes}/${checkin.confirmados}`} detalhe={tr("percentual_presentes", { percentual: checkin.percentual })} />
        <Indicador rotulo={tr("suporte")} valor={suporte.total} detalhe={tr("emaberto_em_aberto", { emAberto: suporte.emAberto })} />
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
          <h3 className="font-display text-base font-semibold uppercase">{tr("por_tipo_de_ingresso")}</h3>
          <Table className="tabela-cards mt-2 w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <TableHead className="py-2 pr-3">{tr("tipo")}</TableHead>
                <TableHead className="py-2">{tr("vendidos_limite")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {v.porTipo.map((t) => (
                <TableRow key={t.id} className="border-b border-border/50">
                  <TableCell className="py-2 pr-3">
                    {t.nome} {t.arquivado && <Badge variant="secondary">{tr("arquivado")}</Badge>}
                  </TableCell>
                  <TableCell data-rotulo={tr("vendidos_limite")} className="py-2 font-mono">{t.vendidos}/{t.limite}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {origens.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">{tr("origem_dos_confirmados")}{" "}{origens.map((o) => `${ROTULO_ORIGEM[o]} ${v.porOrigem[o]}`).join(" · ")}
            </p>
          )}
        </section>

        <section>
          <h3 className="font-display text-base font-semibold uppercase">{tr("por_exercito")}</h3>
          <Table className="tabela-cards mt-2 w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <TableHead className="py-2 pr-3">{tr("exercito")}</TableHead>
                <TableHead className="py-2 pr-3">{tr("confirmados")}</TableHead>
                <TableHead className="py-2">{tr("check_in")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {v.porExercito.map((x) => (
                <TableRow key={x.id} className="border-b border-border/50">
                  <TableCell className="py-2 pr-3">{x.nome}</TableCell>
                  <TableCell data-rotulo={tr("confirmados")} className="py-2 pr-3 font-mono">{x.confirmados}/{x.capacidade}</TableCell>
                  <TableCell data-rotulo={tr("check_in")} className="py-2 font-mono">{x.presentes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>

      <section>
        <h3 className="font-display text-base font-semibold uppercase">{tr("pagamentos_online")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr("pagosonline_pago_s_reembolsados_reembols", { pagosOnline: v.pagamentos.pagosOnline, reembolsados: v.pagamentos.reembolsados, reembolsosPendentes: v.pagamentos.reembolsosPendentes })}{" "}
          <span className={v.pagamentos.contestacoesAbertas ? "font-medium text-destructive" : undefined}>
            {tr("contestacoesabertas_contestacao_oes_em_a", { contestacoesAbertas: v.pagamentos.contestacoesAbertas })}</span>
        </p>
      </section>

      <section>
        <h3 className="font-display text-base font-semibold uppercase">{tr("cancelamentos_e_estornos")}</h3>
        {cancelamentos.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{tr("nenhum_cancelamento_ou_estorno")}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <Table className="tabela-cards w-full text-sm">
              <TableHeader>
                <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <TableHead className="py-2 pr-3">{tr("participante")}</TableHead>
                  <TableHead className="py-2 pr-3">{tr("quando")}</TableHead>
                  <TableHead className="py-2 pr-3">{tr("motivo")}</TableHead>
                  <TableHead className="py-2">{tr("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cancelamentos.map((i) => (
                  <TableRow key={i.id} className="border-b border-border/50">
                    <TableCell className="py-2 pr-3">
                      <p>{base.usuarios.find((u) => u.id === i.usuarioId)?.nomeCompleto ?? tr("participante")}</p>
                      <p className="font-mono text-xs text-muted-foreground">{i.codigo}</p>
                    </TableCell>
                    <TableCell data-rotulo={tr("quando")} className="py-2 pr-3">{i.canceladoEm ? formatarDataHoraBR(i.canceladoEm) : "—"}</TableCell>
                    <TableCell data-rotulo={tr("motivo")} className="py-2 pr-3 break-words">{i.motivoCancelamento ?? "—"}</TableCell>
                    <TableCell data-rotulo={tr("status")} className="py-2"><StatusInscricao status={i.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">{tr("engajamento_missoes_missao_oes_entregas", { missoes: e.missoes, entregas: e.entregas })}{e.entregasAguardandoAvaliacao ? ` ${tr("entregasaguardandoavaliacao_aguardando_a", { entregasAguardandoAvaliacao: e.entregasAguardandoAvaliacao })}` : ""}{tr("publicacoes_publicacao_oes_na_comunidade", { publicacoes: e.publicacoes, denunciasPendentes: e.denunciasPendentes, impulsionamentosAtivos: e.impulsionamentosAtivos })}</p>
    </div>
  );
}

function Suporte({ v }: { v: NonNullable<ReturnType<typeof visaoGeralEvento>> }) {
  const base = carregarBase();
  const status = Object.entries(v.suporte.porStatus) as [keyof typeof ROTULO_STATUS_EXIBIDO, number][];
  if (v.suporte.total === 0) return <EstadoVazio titulo={tr("nenhum_chamado")} descricao={tr("nenhum_chamado_de_suporte_foi_aberto")} />;
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
              <TableHead className="py-2 pr-3">{tr("chamado")}</TableHead>
              <TableHead className="py-2 pr-3">{tr("categoria")}</TableHead>
              <TableHead className="py-2 pr-3">{tr("status")}</TableHead>
              <TableHead className="py-2">{tr("acoes")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {v.suporte.chamados.map((c) => (
              <TableRow key={c.id} className="border-b border-border/50">
                <TableCell className="py-2 pr-3">
                  <p className="break-words font-medium">{c.assunto}</p>
                  <p className="text-xs text-muted-foreground">
                    {protocolo(c)} · {base.usuarios.find((u) => u.id === c.solicitanteId)?.nomeCompleto ?? tr("participante")} · {formatarDataBR(c.criadoEm)}
                  </p>
                </TableCell>
                <TableCell data-rotulo={tr("categoria")} className="py-2 pr-3">{c.categoria}</TableCell>
                <TableCell data-rotulo={tr("status")} className="py-2 pr-3">
                  <Badge variant="secondary">{ROTULO_STATUS_EXIBIDO[statusExibido(base, c)]}</Badge>
                </TableCell>
                <TableCell className="celula-acoes py-2">
                  <Link to="/admin/suporte" search={{ c: c.id }}>
                    <Button variant="outline">{tr("abrir")}</Button>
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
