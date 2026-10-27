// Menu das áreas de gestão (Administração e Organização): seções em grupos, com ícone e
// contador. Em telas largas fica fixo à esquerda; abaixo disso as mesmas seções entram no
// menu ☰ do cabeçalho (um único menu no celular) e a página mostra só onde a pessoa está.
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { FileRoutesByTo } from "@/routeTree.gen";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface ItemMenuLateral {
  to: keyof FileRoutesByTo;
  rotulo: string;
  icone: LucideIcon;
  /** Só a rota exata fica ativa (ex.: a página inicial da área). */
  exato?: boolean;
  /** Pendências da seção (aparece quando > 0). */
  contador?: number;
  /** Texto para leitores de tela, ex.: "3 chamados exigem atenção". */
  rotuloContador?: string;
}

export interface GrupoMenuLateral {
  titulo: string;
  itens: ItemMenuLateral[];
}

export interface MenuArea {
  titulo: string;
  grupos: GrupoMenuLateral[];
}

// Menu da área aberta, lido pelo cabeçalho (que fica fora do layout da área).
let menuAtual: MenuArea | null = null;
const ouvintes = new Set<() => void>();
const inscrever = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};
function definirMenuArea(m: MenuArea | null) {
  menuAtual = m;
  ouvintes.forEach((f) => f());
}
/** Menu da área de gestão aberta (ou null fora delas). */
export const useMenuArea = () => useSyncExternalStore(inscrever, () => menuAtual, () => null);

export const totalPendencias = (grupos: GrupoMenuLateral[]) =>
  grupos.reduce((n, g) => n + g.itens.reduce((m, i) => m + (i.contador ?? 0), 0), 0);

/**
 * Seções agrupadas em accordion (menu lateral e painel do cabeçalho): só o grupo da seção
 * atual abre sozinho; os outros abrem ao toque. Grupo fechado mostra as pendências no título.
 */
export function ItensMenuArea({ grupos, aoNavegar }: { grupos: GrupoMenuLateral[]; aoNavegar?: () => void }) {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const grupoAtual = grupos.find((g) => g.itens.some((i) => ativo(caminho, i)))?.titulo ?? grupos[0]?.titulo ?? "";
  const [aberto, setAberto] = useState(grupoAtual);
  useEffect(() => setAberto(grupoAtual), [grupoAtual]);

  void aberto; void setAberto;
  return (
    <div className="space-y-5">
      {grupos.map((g) => (
        <div key={g.titulo}>
          <p className="rotulo-tecnico px-3 pb-1.5">{g.titulo}</p>
          <GrupoItens itens={g.itens} aoNavegar={aoNavegar} />
        </div>
      ))}
    </div>
  );
}

function GrupoItens({ itens, aoNavegar }: { itens: ItemMenuLateral[]; aoNavegar?: (() => void) | undefined }) {
  return (
          <ul className="space-y-0.5">
            {itens.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: !!item.exato }}
                  onClick={aoNavegar}
                  className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  activeProps={{ className: "bg-secondary !text-foreground font-medium [&>svg]:text-accent", "aria-current": "page" }}
                >
                  <item.icone className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
                  {!!item.contador && item.contador > 0 && (
                    <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground" aria-label={item.rotuloContador ?? `${item.contador} pendentes`}>
                      {item.contador}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
  );
}

const ativo = (caminho: string, item: ItemMenuLateral) =>
  item.exato ? caminho === item.to || caminho === `${item.to}/` : caminho === item.to || caminho.startsWith(`${item.to}/`);

export function LayoutMenuLateral({ titulo, rotuloNav, grupos, children }: {
  titulo: string;
  /** Nome da navegação para leitores de tela, ex.: "Seções da administração". */
  rotuloNav: string;
  grupos: GrupoMenuLateral[];
  children: ReactNode;
}) {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const todos = grupos.flatMap((g) => g.itens);
  const atual = todos.find((i) => ativo(caminho, i)) ?? todos[0];

  // Publica o menu para o cabeçalho; a chave muda só quando seções ou contadores mudam.
  const chave = todos.map((i) => `${i.to}:${i.contador ?? 0}`).join("|");
  useEffect(() => {
    definirMenuArea({ titulo, grupos });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, chave]);
  useEffect(() => () => definirMenuArea(null), []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:py-8">
      <div className="lg:flex lg:gap-8">
        <aside className="vt-menu-area hidden w-56 shrink-0 border-r border-border pr-4 lg:block">
          <div className="sticky top-[88px] max-h-[calc(100dvh-104px)] overflow-y-auto pb-4">
            <h1 className="sticky top-0 z-10 bg-background px-3 pb-4 font-display text-2xl font-bold uppercase">{titulo}</h1>
            <nav aria-label={rotuloNav}>
              <ItensMenuArea grupos={grupos} />
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Telas menores: só onde a pessoa está; trocar de seção é pelo ☰ do cabeçalho. */}
          <div className="mb-4 flex min-w-0 items-center gap-1.5 lg:hidden">
            <h1 className="shrink-0 font-display text-sm font-semibold uppercase text-muted-foreground">{titulo}</h1>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {atual && (
              <p className="flex min-w-0 items-center gap-1.5 font-display text-lg font-semibold uppercase" aria-current="page">
                <atual.icone className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{atual.rotulo}</span>
              </p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
