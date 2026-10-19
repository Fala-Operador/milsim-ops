// Movimentações do evento no financeiro: abas por tipo (com quantidade e total), filtros
// por busca, período e meio de pagamento, ordenação e tabela (cartões no celular).
// Regras em src/lib/movimentacoes.ts.
import { useMemo, useState, type KeyboardEvent } from "react";
import { ArrowDownLeft, SlidersHorizontal, Tag, Undo2, type LucideIcon } from "lucide-react";
import { Badge, Botao, Entrada, Selecao } from "@/components/ui";
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

const POR_PAGINA = 25;

const VISUAL: Record<TipoMovimentacao, { tom: "sucesso" | "perigo" | "padrao" | "aviso"; Icone: LucideIcon }> = {
  inscricao: { tom: "sucesso", Icone: ArrowDownLeft },
  desconto_cupom: { tom: "padrao", Icone: Tag },
  estorno: { tom: "perigo", Icone: Undo2 },
  ajuste: { tom: "aviso", Icone: SlidersHorizontal },
};

function TipoBadge({ tipo }: { tipo: TipoMovimentacao }) {
  const { tom, Icone } = VISUAL[tipo];
  return <Badge tom={tom}><Icone aria-hidden="true" />{ROTULO_TIPO_MOVIMENTACAO[tipo]}</Badge>;
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
  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = ABAS_MOVIMENTACAO.findIndex((a) => a.id === f.aba);
    const prox = ABAS_MOVIMENTACAO[(i + (e.key === "ArrowRight" ? 1 : -1) + ABAS_MOVIMENTACAO.length) % ABAS_MOVIMENTACAO.length]!;
    mudar({ aba: prox.id });
    e.currentTarget.querySelector<HTMLButtonElement>(`#aba-mov-${prox.id}`)?.focus();
  };

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

      <div role="tablist" aria-label="Tipo de movimentação" onKeyDown={aoTeclar} className="abas-rolaveis mt-3 flex border-b border-border">
        {ABAS_MOVIMENTACAO.map((a) => {
          const ativa = f.aba === a.id;
          return (
            <button
              key={a.id}
              id={`aba-mov-${a.id}`}
              type="button"
              role="tab"
              aria-selected={ativa}
              aria-controls="painel-movimentacoes"
              tabIndex={ativa ? 0 : -1}
              onClick={() => mudar({ aba: a.id })}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${ativa ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {a.rotulo}
              <span className={`rounded-full px-1.5 py-0.5 font-mono text-[11px] leading-none ${ativa ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                {resumo[a.id].quantidade}
              </span>
            </button>
          );
        })}
      </div>

      <div id="painel-movimentacoes" role="tabpanel" aria-labelledby={`aba-mov-${f.aba}`}>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <label className="col-span-2 lg:col-span-1 lg:self-end">
            <span className="sr-only">Buscar por descrição ou código da inscrição</span>
            <Entrada type="search" placeholder="Buscar descrição ou código (OP-…)" value={f.busca} onChange={(e) => mudar({ busca: e.target.value })} />
          </label>
          <label>
            <span className="mb-1 block text-xs text-muted-foreground">De</span>
            <Entrada type="date" value={f.de} max={f.ate || undefined} onChange={(e) => mudar({ de: e.target.value })} />
          </label>
          <label>
            <span className="mb-1 block text-xs text-muted-foreground">Até</span>
            <Entrada type="date" value={f.ate} min={f.de || undefined} onChange={(e) => mudar({ ate: e.target.value })} />
          </label>
          {temOnline ? (
            <label>
              <span className="mb-1 block text-xs text-muted-foreground">Pagamento</span>
              <Selecao value={f.meio} onChange={(e) => mudar({ meio: e.target.value as FiltrosMovimentacao["meio"] })}>
                <option value="todos">Todos</option>
                <option value="online">Online (Stripe)</option>
                <option value="manual">Sem pagamento online</option>
              </Selecao>
            </label>
          ) : <span className="hidden lg:block" />}
          <label>
            <span className="mb-1 block text-xs text-muted-foreground">Ordenar</span>
            <Selecao value={f.ordem} onChange={(e) => mudar({ ordem: e.target.value as FiltrosMovimentacao["ordem"] })}>
              <option value="recentes">Mais recentes</option>
              <option value="antigas">Mais antigas</option>
              <option value="maior_valor">Maior valor</option>
            </Selecao>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p role="status" className="text-muted-foreground">
            {totalAba.quantidade} {totalAba.quantidade === 1 ? "movimentação" : "movimentações"}
            {f.aba === "desconto_cupom"
              ? <> · <span className="font-mono text-foreground">{formatarBRL(totalAba.totalCentavos)}</span> concedidos</>
              : <> · saldo <span className={`font-mono ${totalAba.totalCentavos < 0 ? "text-destructive" : "text-foreground"}`}>{formatarBRL(totalAba.totalCentavos)}</span></>}
          </p>
          {ativos > 0 && (
            <button type="button" className="text-sm text-accent hover:underline" onClick={() => mudar({ busca: "", de: "", ate: "", meio: "todos" })}>
              Limpar filtros ({ativos})
            </button>
          )}
        </div>

        {visiveis.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhuma movimentação com esses filtros.
          </p>
        ) : (
          <table className="tabela-cards mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">Data</th>
                <th scope="col" className="py-2 pr-3 font-medium">Tipo</th>
                <th scope="col" className="py-2 pr-3 font-medium">Descrição</th>
                <th scope="col" className="py-2 pr-3 font-medium">Inscrição</th>
                <th scope="col" className="py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.slice(0, limite).map((l) => (
                <tr key={l.id} className="md:border-b md:border-border/50">
                  <td data-rotulo="Data" className="py-2 pr-3 whitespace-nowrap text-muted-foreground md:align-top">{formatarDataHoraBR(l.criadoEm)}</td>
                  <td data-rotulo="Tipo" className="py-2 pr-3 md:align-top"><TipoBadge tipo={l.tipo} /></td>
                  <td className="py-2 pr-3 break-words md:align-top">
                    {l.descricao}
                    {l.online && !/stripe/i.test(l.descricao) && <span className="ml-2 text-xs text-muted-foreground">· Stripe</span>}
                  </td>
                  <td data-rotulo="Inscrição" className="py-2 pr-3 font-mono text-xs md:align-top">{l.codigoInscricao ?? "—"}</td>
                  <td data-rotulo="Valor" className="py-2 md:text-right md:align-top"><Valor l={l} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {visiveis.length > limite && (
          <div className="mt-3 text-center">
            <Botao variante="contorno" onClick={() => setLimite((n) => n + POR_PAGINA)}>
              Mostrar mais ({visiveis.length - limite} restantes)
            </Botao>
          </div>
        )}
      </div>
    </section>
  );
}
