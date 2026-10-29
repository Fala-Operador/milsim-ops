// Movimentações do evento no financeiro: abas por tipo (com quantidade e total), filtros
// por busca, período e meio de pagamento, ordenação e tabela (cartões no celular).
// Regras em src/lib/movimentacoes.ts.
import { useMemo, useState } from "react";
import { ArrowDownLeft, SlidersHorizontal, Tag, Undo2, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatarBRL, formatarDataHoraBR } from "@/lib/domain/money";
import {
  ABAS_MOVIMENTACAO,
  FILTROS_INICIAIS,
  ROTULO_TIPO_MOVIMENTACAO,
  filtrarMovimentacoes,
  filtrosAtivos,
  resumoPorAba,
  type FiltrosMovimentacao,
  type LinhaMovimentacao,
} from "@/lib/movimentacoes";
import type { TipoMovimentacao } from "@/lib/domain/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { tr } from "@/i18n/components/financeiro/Movimentacoes";

const POR_PAGINA = 25;

const VISUAL: Record<TipoMovimentacao, { tom: "success" | "destructive" | "secondary" | "warning"; Icone: LucideIcon }> = {
  inscricao: { tom: "success", Icone: ArrowDownLeft },
  desconto_cupom: { tom: "secondary", Icone: Tag },
  estorno: { tom: "destructive", Icone: Undo2 },
  ajuste: { tom: "warning", Icone: SlidersHorizontal },
};

function TipoBadge({ tipo }: { tipo: TipoMovimentacao }) {
  const { tom, Icone } = VISUAL[tipo];
  return <Badge variant={tom}><Icone aria-hidden="true" />{ROTULO_TIPO_MOVIMENTACAO[tipo]}</Badge>;
}

function Valor({ l }: { l: LinhaMovimentacao }) {
  if (l.tipo === "desconto_cupom") {
    if (!l.descontoCentavos) return <span className="font-mono text-muted-foreground">—</span>;
    // Desconto não move dinheiro: é o valor abatido do ingresso (já descontado da entrada).
    return (
      <span className="font-mono whitespace-nowrap text-muted-foreground" title={tr("abatido_do_valor_do_ingresso_nao")}>
        −{formatarBRL(l.descontoCentavos)}<span className="sr-only">{" "}{tr("abatidos_do_ingresso")}</span>
      </span>
    );
  }
  return (
    <span className={`font-mono font-medium whitespace-nowrap ${l.valorCentavos < 0 ? "text-destructive" : "text-success"}`}>
      {formatarBRL(l.valorCentavos)}
    </span>
  );
}

export function Movimentacoes({ linhas }: { linhas: LinhaMovimentacao[] }) {
  const [f, setF] = useState<FiltrosMovimentacao>(FILTROS_INICIAIS);
  const [limite, setLimite] = useState(POR_PAGINA);
  const mudar = (p: Partial<FiltrosMovimentacao>) => { setF((x) => ({ ...x, ...p })); setLimite(POR_PAGINA); };

  const resumo = useMemo(() => resumoPorAba(linhas, f), [linhas, f]);
  const visiveis = useMemo(() => filtrarMovimentacoes(linhas, f), [linhas, f]);
  const temOnline = linhas.some((l) => l.online);
  const ativos = filtrosAtivos(f);

  // Setas esquerda/direita trocam de aba (padrão WAI-ARIA de abas).

  if (linhas.length === 0) {
    return (
      <section aria-labelledby="titulo-movimentacoes" className="mt-6">
        <h3 id="titulo-movimentacoes" className="font-display text-base font-semibold uppercase">{tr("movimentacoes")}</h3>
        <p className="mt-2 rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">{tr("nenhuma_movimentacao_registrada")}</p>
      </section>
    );
  }

  const totalAba = resumo[f.aba];
  return (
    <section aria-labelledby="titulo-movimentacoes" className="mt-6">
      <h3 id="titulo-movimentacoes" className="font-display text-base font-semibold uppercase">{tr("movimentacoes")}</h3>

      <Tabs value={f.aba} onValueChange={(v) => mudar({ aba: v as typeof f.aba })}>
      <TabsList aria-label={tr("tipo_de_movimentacao")} className="abas-rolaveis mt-3 border-b border-border">
        {ABAS_MOVIMENTACAO.map((a) => {
          const ativa = f.aba === a.id;
          return (
            <TabsTrigger
              key={a.id}
              value={a.id}
              id={`aba-mov-${a.id}`}
              aria-controls="painel-movimentacoes"
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${ativa ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {a.rotulo}
              <span className={`rounded-full px-1.5 py-0.5 font-mono text-[11px] leading-none ${ativa ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                {resumo[a.id].quantidade}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      </Tabs>

      <div id="painel-movimentacoes" role="tabpanel" aria-labelledby={`aba-mov-${f.aba}`}>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <Label className="sm:col-span-2 lg:col-span-1 lg:self-end text-[length:inherit] font-normal text-inherit">
            <span className="sr-only">{tr("buscar_por_descricao_ou_codigo_da")}</span>
            <Input type="search" placeholder={tr("buscar_descricao_ou_codigo_op")} value={f.busca} onChange={(e) => mudar({ busca: e.target.value })} />
          </Label>
          <Label className="text-[length:inherit] font-normal text-inherit">
            <span className="mb-1 block text-xs text-muted-foreground">{tr("de")}</span>
            <Input type="date" value={f.de} max={f.ate || undefined} onChange={(e) => mudar({ de: e.target.value })} />
          </Label>
          <Label className="text-[length:inherit] font-normal text-inherit">
            <span className="mb-1 block text-xs text-muted-foreground">{tr("ate")}</span>
            <Input type="date" value={f.ate} min={f.de || undefined} onChange={(e) => mudar({ ate: e.target.value })} />
          </Label>
          {temOnline ? (
            <Label className="text-[length:inherit] font-normal text-inherit">
              <span className="mb-1 block text-xs text-muted-foreground">{tr("pagamento")}</span>
              <NativeSelect value={f.meio} onChange={(e) => mudar({ meio: e.target.value as FiltrosMovimentacao["meio"] })}>
                <option value="todos">{tr("todos")}</option>
                <option value="online">{tr("online_stripe")}</option>
                <option value="manual">{tr("sem_pagamento_online")}</option>
              </NativeSelect>
            </Label>
          ) : <span className="hidden lg:block" />}
          <Label className="text-[length:inherit] font-normal text-inherit">
            <span className="mb-1 block text-xs text-muted-foreground">{tr("ordenar")}</span>
            <NativeSelect value={f.ordem} onChange={(e) => mudar({ ordem: e.target.value as FiltrosMovimentacao["ordem"] })}>
              <option value="recentes">{tr("mais_recentes")}</option>
              <option value="antigas">{tr("mais_antigas")}</option>
              <option value="maior_valor">{tr("maior_valor")}</option>
            </NativeSelect>
          </Label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p role="status" className="text-muted-foreground">
            {totalAba.quantidade} {totalAba.quantidade === 1 ? tr("movimentacao") : tr("movimentacoes_2")}
            {f.aba === "desconto_cupom"
              ? <> · <span className="font-mono text-foreground">{formatarBRL(totalAba.totalCentavos)}</span>{" "}{tr("concedidos")}</>
              : <>{" "}{tr("saldo")}{" "}<span className={`font-mono ${totalAba.totalCentavos < 0 ? "text-destructive" : "text-foreground"}`}>{formatarBRL(totalAba.totalCentavos)}</span></>}
          </p>
          {ativos > 0 && (
            <Button variant="plain" size="none" type="button" className="text-sm text-accent hover:underline" onClick={() => mudar({ busca: "", de: "", ate: "", meio: "todos" })}>{tr("limpar_filtros_ativos", { ativos })}</Button>
          )}
        </div>

        {visiveis.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">{tr("nenhuma_movimentacao_com_esses_filtros")}</p>
        ) : (
          <Table className="tabela-cards mt-3 w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <TableHead scope="col" className="py-2 pr-3 font-medium">{tr("data")}</TableHead>
                <TableHead scope="col" className="py-2 pr-3 font-medium">{tr("tipo")}</TableHead>
                <TableHead scope="col" className="py-2 pr-3 font-medium">{tr("descricao")}</TableHead>
                <TableHead scope="col" className="py-2 pr-3 font-medium">{tr("inscricao")}</TableHead>
                <TableHead scope="col" className="py-2 text-right font-medium">{tr("valor")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.slice(0, limite).map((l) => (
                <TableRow key={l.id} className="lg:border-b lg:border-border/50">
                  <TableCell data-rotulo={tr("data")} className="py-2 pr-3 whitespace-nowrap text-muted-foreground lg:align-top">{formatarDataHoraBR(l.criadoEm)}</TableCell>
                  <TableCell data-rotulo={tr("tipo")} className="py-2 pr-3 lg:align-top"><TipoBadge tipo={l.tipo} /></TableCell>
                  <TableCell className="py-2 pr-3 break-words lg:align-top">
                    {l.descricao}
                    {l.online && !/stripe/i.test(l.descricao) && <span className="ml-2 text-xs text-muted-foreground">{tr("stripe")}</span>}
                  </TableCell>
                  <TableCell data-rotulo={tr("inscricao")} className="py-2 pr-3 font-mono text-xs lg:align-top">{l.codigoInscricao ?? "—"}</TableCell>
                  <TableCell data-rotulo={tr("valor")} className="py-2 lg:text-right lg:align-top"><Valor l={l} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {visiveis.length > limite && (
          <div className="mt-3 text-center">
            <Button variant="outline" onClick={() => setLimite((n) => n + POR_PAGINA)}>{tr("mostrar_mais_valor_restantes", { valor: visiveis.length - limite })}</Button>
          </div>
        )}
      </div>
    </section>
  );
}
