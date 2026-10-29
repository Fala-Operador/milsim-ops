import { useMemo } from "react";
import { useEventoOrganizacao } from "@/contexts/OrganizationEventContext";
import { carregarBase } from "@/services/db";
import { disponibilidadeNaBase, resumoFinanceiro } from "@/services/inscricoes";
import { TEXTO_MOTIVO } from "@/lib/vendas";
import { resumoRepasse, taxaDaPlataforma } from "@/lib/repasses";
import { disputaEmAberto, ROTULO_DISPUTA } from "@/lib/stripe";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { Preco } from "@/components/Preco";
import { mascararCpf } from "@/lib/domain/validators";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusInscricao } from "@/components/StatusInscricao";
import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import type { Evento } from "@/lib/domain/types";
import { Movimentacoes } from "@/components/financeiro/Movimentacoes";
import { linhasDeMovimentacao } from "@/lib/movimentacoes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { tr } from "@/i18n/components/organizacao";
import { localeAtual } from "@/i18n/dicionario";

/** Eventos visíveis para o organizador logado (admin vê todos). */
export function useEventosOrg() {
  const { usuario } = useAuth();
  const versao = useVersaoBase();
  return useMemo(() => {
    const base = carregarBase();
    // O admin com organização vê só a dele; o admin sem organização vê todas.
    const orgId = usuario?.organizacaoId;
    const eventos = base.eventos.filter((e) => !orgId || e.organizacaoId === orgId);
    return { base, eventos, orgId };
  }, [usuario, versao]);
}

/** Seletor de evento usado nas páginas Inscritos, Comunidade e Financeiro. */
export function SeletorEvento({
  eventos,
  valor,
  onChange,
}: {
  eventos: Evento[];
  valor: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor="sel-evento" className="text-sm text-muted-foreground font-normal">{tr("evento")}</Label>
      <NativeSelect id="sel-evento" value={valor} onChange={(e) => onChange(e.target.value)} className="min-w-56">
        {eventos.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome || tr("sem_nome")} — {formatarDataBR(e.inicioEm)}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

export function TabelaInscritos({ eventoId }: { eventoId: string }) {
  const base = carregarBase();
  const evento = base.eventos.find((e) => e.id === eventoId)!;
  const inscricoes = base.inscricoes.filter((i) => i.eventoId === eventoId);
  const confirmadas = inscricoes.filter((i) => i.status === "confirmada").length;
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {tr("confirmadas_confirmadas_de_length_inscri", { confirmadas, length: inscricoes.length, capacidadeTotal: evento.capacidadeTotal })}
      </p>
      <div className="mt-3 overflow-x-auto">
        <Table className="w-full text-sm">
          <TableHeader>
            <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <TableHead className="py-2 pr-3">{tr("participante")}</TableHead>
              <TableHead className="py-2 pr-3">{tr("cpf")}</TableHead>
              <TableHead className="py-2 pr-3">{tr("tipo")}</TableHead>
              <TableHead className="py-2 pr-3">{tr("exercito")}</TableHead>
              <TableHead className="py-2 pr-3">{tr("origem")}</TableHead>
              <TableHead className="py-2">{tr("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inscricoes.map((i) => {
              const u = base.usuarios.find((x) => x.id === i.usuarioId);
              return (
                <TableRow key={i.id} className="border-b border-border/50">
                  <TableCell className="py-2 pr-3">{u?.nomeCompleto ?? tr("participante")}</TableCell>
                  <TableCell className="py-2 pr-3 font-mono text-xs">{u ? mascararCpf(u.cpf) : "***"}</TableCell>
                  <TableCell className="py-2 pr-3">{evento.tipos.find((t) => t.id === i.tipoId)?.nome}</TableCell>
                  <TableCell className="py-2 pr-3">{evento.exercitos.find((e) => e.id === i.exercitoId)?.nome}</TableCell>
                  <TableCell className="py-2 pr-3">{i.origem}</TableCell>
                  <TableCell className="py-2">
                    <StatusInscricao status={i.status} />
                  </TableCell>
                </TableRow>
              );
            })}
            {inscricoes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">{tr("nenhuma_inscricao_neste_evento")}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Button
        variant="outline"
        className="mt-3"
        onClick={() => {
          const linhas = inscricoes.map((i) => {
            const u = base.usuarios.find((x) => x.id === i.usuarioId);
            return [u?.nomeCompleto ?? tr("participante"), i.codigo, i.status, i.origem].join(";");
          });
          const csv = "nome;codigo;status;origem\n" + linhas.join("\n");
          const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = "inscritos.csv";
          a.click();
          URL.revokeObjectURL(url);
        }}
      >{tr("exportar_relatorio_csv")}</Button>
    </div>
  );
}

export function Financeiro({ eventoId }: { eventoId: string }) {
  const r = resumoFinanceiro(eventoId);
  const itens: Array<[string, string]> = [
    [tr("inscritos_ativos"), String(r.inscritosAtivos)],
    [tr("valor_bruto"), formatarBRL(r.bruto)],
    [tr("descontos_concedidos"), formatarBRL(r.descontos)],
    [tr("ajustes"), formatarBRL(r.ajustes)],
    [tr("estornos"), formatarBRL(r.estornos)],
    [tr("total_liquido"), formatarBRL(r.liquido)],
    [tr("cortesias_emitidas_resgatadas"), `${r.cortesiasEmitidas} / ${r.cortesiasResgatadas}`],
    [tr("cupons_utilizados"), String(r.cuponsUtilizados)],
    [tr("integralmente_descontadas"), String(r.integralmenteDescontadas)],
    [tr("reservas_aguardando_pagamento"), String(r.reservasAguardando)],
    // Taxa vigente (definida pela administração); cada venda guarda a do momento em que foi feita.
    [tr("taxa_da_plataforma"), `${taxaDaPlataforma(carregarBase()).toLocaleString(localeAtual(), { maximumFractionDigits: 2 })}%`],
  ];
  // Vendas pagas online: quanto foi cobrado, a taxa retida e para onde foi o dinheiro.
  const rep = resumoRepasse(carregarBase(), eventoId);
  if (rep.cobrado > 0) {
    itens.push(
      [tr("pago_online_stripe"), formatarBRL(rep.cobrado)],
      [tr("taxa_da_plataforma"), formatarBRL(rep.taxas)],
      [tr("repassado_a_organizacao"), formatarBRL(rep.repassado)],
    );
    if (rep.naPlataforma > 0) itens.push([tr("com_a_plataforma_repasse_a_parte"), formatarBRL(rep.naPlataforma)]);
    if (rep.taxasComprador > 0) itens.push([tr("taxa_de_servico_paga_pelos_compradores"), formatarBRL(rep.taxasComprador)]);
  }
  return (
    <div>
      <p className="text-xs text-muted-foreground">{tr("valores_derivados_das_inscricoes_confirm")}</p>
      {r.reembolsosPendentes.length > 0 && (
        <div role="status" className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <p className="font-medium">{tr("length_reembolso_s_em_andamento_no", { length: r.reembolsosPendentes.length })}</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {r.reembolsosPendentes.map((i) => (
              <li key={i.id} className="break-words">
                {i.codigo}: {i.pagamento?.erro ? tr("falha_erro_nova_tentativa_automatica", { erro: i.pagamento.erro }) : tr("aguardando_confirmacao_do_stripe")}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.disputas.length > 0 && (
        <div role="status" className={`mt-3 rounded-md border px-3 py-2 text-sm ${r.disputas.some((i) => disputaEmAberto(i.pagamento?.disputa)) ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-elevated"}`}>
          <p className="font-medium">{tr("length_pagamento_s_contestado_s_no", { length: r.disputas.length })}</p>
          <p className="mt-0.5 text-xs">{tr("a_resposta_a_contestacao_e_feita")}</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {r.disputas.map((i) => (
              <li key={i.id} className="break-words">
                {tr("codigo_valorcentavos_valor_desde_abertae", { codigo: i.codigo, valorCentavos: formatarBRL(i.pagamento!.disputa!.valorCentavos), valor: ROTULO_DISPUTA[i.pagamento!.disputa!.status], abertaEm: formatarDataBR(i.pagamento!.disputa!.abertaEm) })}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-border">
          <div className="flex items-end justify-between gap-3 border-b border-border p-5">
            <div>
              <p className="rotulo-tecnico">{tr("total_liquido")}</p>
              <p className="mt-1 font-display text-5xl font-bold leading-none tabular-nums">{formatarBRL(r.liquido)}</p>
            </div>
            <p className="text-right text-xs text-muted-foreground">{tr("inscritosativos_inscritos_ativos", { inscritosAtivos: r.inscritosAtivos })}<br />{tr("reservasaguardando_reservas_aguardando", { reservasAguardando: r.reservasAguardando })}</p>
          </div>
          <dl className="divide-y divide-border/70 font-mono text-sm tabular-nums">
            {([
              [tr("valor_bruto"), r.bruto, ""], [tr("descontos_de_cupom"), -r.descontos, "−"], [tr("estornos"), -r.estornos, "−"], [tr("ajustes"), r.ajustes, r.ajustes < 0 ? "−" : "+"],
            ] as const).map(([rot, v]) => (
              <div key={rot} className="flex justify-between gap-3 px-5 py-2.5">
                <dt className="font-sans text-muted-foreground">{rot}</dt>
                <dd className={v < 0 ? "text-destructive" : ""}>{formatarBRL(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <dl className="grid content-start grid-cols-2 gap-x-6 gap-y-4 self-start">
          {itens.filter(([rot]) => ![tr("inscritos_ativos"), tr("valor_bruto"), tr("descontos_concedidos"), tr("ajustes"), tr("estornos"), tr("total_liquido"), tr("reservas_aguardando_pagamento")].includes(rot)).map(([rotulo, valor]) => (
            <div key={rotulo} className="min-w-0 border-t border-border pt-2">
              <dt className="text-xs leading-tight text-muted-foreground">{rotulo}</dt>
              <dd className="mt-1 break-words font-display text-2xl font-bold tabular-nums">{valor}</dd>
            </div>
          ))}
        </dl>
      </div>
      {/* key: trocar de evento recomeça abas e filtros */}
      <Movimentacoes
        key={eventoId}
        linhas={linhasDeMovimentacao(r.movimentacoes, carregarBase().inscricoes.filter((i) => i.eventoId === eventoId))}
      />
    </div>
  );
}

/** Evento selecionado compartilhado entre as páginas da organização. */
export function useEventoSelecionado(eventos: Evento[]) {
  return useEventoOrganizacao(eventos);
}

/**
 * Tipos de ingresso com e sem venda aberta. Mostra o motivo de cada bloqueio e
 * o atalho para configurar os lotes do evento correto.
 */
export function AvisoLotes({ evento, compacto = false, onConfigurar }: { evento: Evento; compacto?: boolean; onConfigurar: () => void }) {
  const base = carregarBase();
  const tipos = evento.tipos.filter((t) => !t.arquivado).map((t) => ({ t, d: disponibilidadeNaBase(base, evento, t.id) }));
  const bloqueados = tipos.filter((x) => !x.d.disponivel);
  if (compacto) {
    if (bloqueados.length === 0) return null;
    return (
      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-warning">
        {bloqueados.length === tipos.length ? tr("inscricoes_indisponiveis") : tr("length_ingresso_s_sem_venda_aberta", { length: bloqueados.length })}
        <Button variant="plain" size="none" type="button" onClick={onConfigurar} className="underline underline-offset-2 hover:text-foreground">{tr("configurar_lotes")}</Button>
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold uppercase">{tr("disponibilidade_dos_ingressos")}</h3>
        <Button variant="outline" onClick={onConfigurar}>{tr("configurar_lotes")}</Button>
      </div>
      <ul className="space-y-1 text-sm">
        {tipos.map(({ t, d }) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-elevated px-3 py-2">
            <span>{t.nome}</span>
            {d.disponivel ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                {d.lote.nome} · <Preco centavos={d.precoCentavos} />{" "}{tr("restantes_vagas", { restantes: d.restantes })}<Badge variant="success">{tr("disponivel")}</Badge>
              </span>
            ) : (
              <span className="flex items-center gap-2 text-muted-foreground">
                {TEXTO_MOTIVO[d.motivo]}
                {d.motivo === "agendado" && d.inicioVendas ? ` ${tr("a_partir_de_iniciovendas", { inicioVendas: formatarDataBR(d.inicioVendas) })}` : ""}
                <Badge variant="warning">{tr("indisponivel")}</Badge>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
