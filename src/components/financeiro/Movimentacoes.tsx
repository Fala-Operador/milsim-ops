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
      <span className="font-mono whitespace-nowrap text-muted-foreground" title="Abatido do valor do ingresso; não é saída de caixa">
        −{formatarBRL(l.descontoCentavos)}<span className="sr-only"> abatidos do ingresso</span>
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
        <h3 id="titulo-movimentacoes" className="font-display text-base font-semibold uppercase">Movimentações</h3>
        <p className="mt-2 rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
      </section>
    );
  }

  const totalAba = resumo[f.aba];
  return (
    <section aria-labelledby="titulo-movimentacoes" className="mt-6">
      <h3 id="titulo-movimentacoes" className="font-display text-base font-semibold uppercase">Movimentações</h3>

      <Tabs value={f.aba} onValueChange={(v) => mudar({ aba: v as typeof f.aba })}>
      <TabsList aria-label="Tipo de movimentação" className="abas-rolaveis mt-3 border-b border-border">
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
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <Label className="col-span-2 lg:col-span-1 lg:self-end text-[length:inherit] font-normal text-inherit">
            <span className="sr-only">Buscar por descrição ou código da inscrição</span>
            <Input type="search" placeholder="Buscar descrição ou código (OP-…)" value={f.busca} onChange={(e) => mudar({ busca: e.target.value })} />
          </Label>
          <Label className="text-[length:inherit] font-normal text-inherit">
            <span className="mb-1 block text-xs text-muted-foreground">De</span>
            <Input type="date" value={f.de} max={f.ate || undefined} onChange={(e) => mudar({ de: e.target.value })} />
          </Label>
          <Label className="text-[length:inherit] font-normal text-inherit">
            <span className="mb-1 block text-xs text-muted-foreground">Até</span>
            <Input type="date" value={f.ate} min={f.de || undefined} onChange={(e) => mudar({ ate: e.target.value })} />
          </Label>
          {temOnline ? (
            <Label className="text-[length:inherit] font-normal text-inherit">
              <span className="mb-1 block text-xs text-muted-foreground">Pagamento</span>
              <NativeSelect value={f.meio} onChange={(e) => mudar({ meio: e.target.value as FiltrosMovimentacao["meio"] })}>
                <option value="todos">Todos</option>
                <option value="online">Online (Stripe)</option>
                <option value="manual">Sem pagamento online</option>
              </NativeSelect>
            </Label>
          ) : <span className="hidden lg:block" />}
          <Label className="text-[length:inherit] font-normal text-inherit">
            <span className="mb-1 block text-xs text-muted-foreground">Ordenar</span>
            <NativeSelect value={f.ordem} onChange={(e) => mudar({ ordem: e.target.value as FiltrosMovimentacao["ordem"] })}>
              <option value="recentes">Mais recentes</option>
              <option value="antigas">Mais antigas</option>
              <option value="maior_valor">Maior valor</option>
            </NativeSelect>
          </Label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p role="status" className="text-muted-foreground">
            {totalAba.quantidade} {totalAba.quantidade === 1 ? "movimentação" : "movimentações"}
            {f.aba === "desconto_cupom"
              ? <> · <span className="font-mono text-foreground">{formatarBRL(totalAba.totalCentavos)}</span> concedidos</>
              : <> · saldo <span className={`font-mono ${totalAba.totalCentavos < 0 ? "text-destructive" : "text-foreground"}`}>{formatarBRL(totalAba.totalCentavos)}</span></>}
          </p>
          {ativos > 0 && (
            <Button variant="plain" size="none" type="button" className="text-sm text-accent hover:underline" onClick={() => mudar({ busca: "", de: "", ate: "", meio: "todos" })}>
              Limpar filtros ({ativos})
            </Button>
          )}
        </div>

        {visiveis.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhuma movimentação com esses filtros.
          </p>
        ) : (
          <Table className="tabela-cards mt-3 w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <TableHead scope="col" className="py-2 pr-3 font-medium">Data</TableHead>
                <TableHead scope="col" className="py-2 pr-3 font-medium">Tipo</TableHead>
                <TableHead scope="col" className="py-2 pr-3 font-medium">Descrição</TableHead>
                <TableHead scope="col" className="py-2 pr-3 font-medium">Inscrição</TableHead>
                <TableHead scope="col" className="py-2 text-right font-medium">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.slice(0, limite).map((l) => (
                <TableRow key={l.id} className="md:border-b md:border-border/50">
                  <TableCell data-rotulo="Data" className="py-2 pr-3 whitespace-nowrap text-muted-foreground md:align-top">{formatarDataHoraBR(l.criadoEm)}</TableCell>
                  <TableCell data-rotulo="Tipo" className="py-2 pr-3 md:align-top"><TipoBadge tipo={l.tipo} /></TableCell>
                  <TableCell className="py-2 pr-3 break-words md:align-top">
                    {l.descricao}
                    {l.online && !/stripe/i.test(l.descricao) && <span className="ml-2 text-xs text-muted-foreground">· Stripe</span>}
                  </TableCell>
                  <TableCell data-rotulo="Inscrição" className="py-2 pr-3 font-mono text-xs md:align-top">{l.codigoInscricao ?? "—"}</TableCell>
                  <TableCell data-rotulo="Valor" className="py-2 md:text-right md:align-top"><Valor l={l} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {visiveis.length > limite && (
          <div className="mt-3 text-center">
            <Button variant="outline" onClick={() => setLimite((n) => n + POR_PAGINA)}>
              Mostrar mais ({visiveis.length - limite} restantes)
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
