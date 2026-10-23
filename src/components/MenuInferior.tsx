// Menu inferior do celular para quem está logado: atalhos para eventos, ingressos, comunidades e
// o próprio perfil (onde fica o "Compartilhar perfil").
// Some a partir de md (o cabeçalho cobre a navegação) e reserva o espaço no fim da página.
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Crosshair, MessagesSquare, Ticket, UserRound, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const CLASSE_RAIZ = "com-menu-inferior";

const ITENS: { to: "/" | "/app/ingressos" | "/comunidades" | "/app/perfil"; rotulo: string; icone: LucideIcon; exato?: boolean }[] = [
  { to: "/", rotulo: "Eventos", icone: Crosshair, exato: true },
  { to: "/app/ingressos", rotulo: "Ingressos", icone: Ticket },
  { to: "/comunidades", rotulo: "Comunidades", icone: MessagesSquare },
  { to: "/app/perfil", rotulo: "Meu perfil", icone: UserRound },
];

const item =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] font-medium text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

export function MenuInferior() {
  const { usuario } = useAuth();

  // A classe na raiz reserva o espaço (styles.css) e sobe barras fixas como a de inscrição.
  useEffect(() => {
    if (!usuario) return;
    document.documentElement.classList.add(CLASSE_RAIZ);
    return () => document.documentElement.classList.remove(CLASSE_RAIZ);
  }, [usuario]);

  if (!usuario) return null;

  return (
    <nav
      aria-label="Atalhos"
      className="vt-menu-inferior fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-md items-stretch gap-1 px-2 py-1.5">
        {ITENS.map(({ to, rotulo, icone: Icone, exato }) => (
          <li key={to} className="flex flex-1">
            <Link
              to={to}
              activeOptions={{ exact: !!exato }}
              className={item}
              activeProps={{ className: "bg-secondary text-foreground", "aria-current": "page" }}
            >
              <Icone className="size-5 shrink-0" aria-hidden="true" />
              <span className="truncate">{rotulo}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
