import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bell, ChevronDown, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { usePreferencias } from "@/contexts/PreferenciasContext";
import { Botao } from "./ui";
import { SeletorCidade } from "./SeletorCidade";

const itemMenu = "flex w-full items-center rounded px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";
const foco = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function Aparencia({ onEscolher }: { onEscolher?: () => void }) {
  const { tema, podeAlterar, definirTema } = useTheme();
  if (!podeAlterar) return null;
  const opcoes = [
    { v: "dark" as const, r: "Escuro — Verde-oliva" },
    { v: "light" as const, r: "Claro — TAN" },
  ];
  return (
    <div role="group" aria-label="Aparência">
      <p className="px-3 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">Aparência</p>
      {opcoes.map((o) => (
        <button key={o.v} type="button" role="menuitemradio" aria-checked={tema === o.v}
          onClick={() => { definirTema(o.v); onEscolher?.(); }}
          className={`${itemMenu} justify-between`}>
          {o.r}
          {tema === o.v && <span className="text-accent" aria-hidden="true">✓</span>}
        </button>
      ))}
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={titulo} className="border-t border-border py-1 first:border-t-0">
      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>
      {children}
    </div>
  );
}

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1]![0] : "")).toUpperCase();
}

/** Itens do menu da conta, compartilhados pelo menu do desktop e pelo painel do celular. */
function ItensConta({ fechar, aoSair }: { fechar: () => void; aoSair: () => void }) {
  const { usuario } = useAuth();
  const { abrirEditor } = usePreferencias();
  if (!usuario) return null;
  const gestao = true;
  return (
    <>
      <Grupo titulo="Conta">
        <Link to="/app" activeOptions={{ exact: true }} className={itemMenu} onClick={fechar}>Minha área</Link>
        <Link to="/app/ingressos" className={itemMenu} onClick={fechar}>Meus ingressos</Link>
        <Link to="/operador/$usuarioId" params={{ usuarioId: usuario.id }} search={{ aba: undefined }} className={itemMenu} onClick={fechar}>Perfil do operador</Link>
        <Link to="/operador/$usuarioId" params={{ usuarioId: usuario.id }} search={{ aba: "recompensas" }} className={itemMenu} onClick={fechar}>Minhas recompensas</Link>
        <Link to="/app/perfil" search={{ aba: undefined }} className={itemMenu} onClick={fechar}>Meu perfil</Link>
        <button type="button" className={itemMenu} onClick={() => { fechar(); abrirEditor(); }}>Preferências de eventos</button>
        <Aparencia onEscolher={fechar} />
      </Grupo>
      {gestao && (
        <Grupo titulo="Gestão">
          {usuario.perfil === "organizador" && <Link to="/organizacao" className={itemMenu} onClick={fechar}>Minha organização</Link>}
          {usuario.perfil === "admin" && <Link to="/admin" className={itemMenu} onClick={fechar}>Administração</Link>}
          {usuario.perfil === "participante" && <Link to="/app/organizador" className={itemMenu} onClick={fechar}>Quero ser organizador</Link>}
        </Grupo>
      )}
      <Grupo titulo="Sessão">
        <button type="button" className={`${itemMenu} gap-2 text-destructive`} onClick={aoSair}>
          <LogOut className="h-4 w-4" aria-hidden="true" /> Sair
        </button>
      </Grupo>
    </>
  );
}

function Avatar({ nome, foto }: { nome: string; foto?: string | undefined }) {
  return foto ? (
    <img src={foto} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
  ) : (
    <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[11px] font-bold text-primary-foreground">
      {iniciais(nome)}
    </span>
  );
}

function Sino({ naoLidas }: { naoLidas: number }) {
  const rotulo = naoLidas > 99 ? "99+" : String(naoLidas);
  return (
    <Link to="/app/notificacoes"
      className={`relative flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground ${foco}`}
      aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : "Notificações, nenhuma não lida"}>
      <Bell className={`h-5 w-5 ${naoLidas > 0 ? "text-warning" : ""}`} aria-hidden="true" />
      {naoLidas > 0 && (
        <span aria-hidden="true" className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold leading-none text-warning-foreground">
          {rotulo}
        </span>
      )}
    </Link>
  );
}

const linkNav = `rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground ${foco}`;
const linkNavAtivo = "bg-secondary text-foreground font-medium shadow-[inset_0_-2px_0_var(--accent)]";

function Navegacao({ logado, aoNavegar, vertical = false }: { logado: boolean; aoNavegar?: () => void; vertical?: boolean }) {
  const cls = vertical ? `${linkNav} block py-3` : linkNav;
  return (
    <>
      <Link to="/" activeOptions={{ exact: true }} className={cls} activeProps={{ className: linkNavAtivo }} onClick={aoNavegar}>Eventos</Link>
      {/* Modalidades é público: explica o que existe, logado ou não. */}
      <Link to="/modalidades" className={cls} activeProps={{ className: linkNavAtivo }} onClick={aoNavegar}>Modalidades</Link>
      {logado && (
        <Link to="/app/comunidades" className={cls} activeProps={{ className: linkNavAtivo }} onClick={aoNavegar}>Comunidades</Link>
      )}
    </>
  );
}

export function Header() {
  const { usuario, logout } = useAuth();
  const { naoLidas } = useNotifications();
  const navigate = useNavigate();
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const [menuAberto, setMenuAberto] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const [rolado, setRolado] = useState(false);
  const [montado, setMontado] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const botaoMenuRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const botaoPainelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setMontado(true), []);
  // A sessão só é considerada após a montagem para evitar divergência com o servidor.
  const usuarioVisivel = montado ? usuario : null;

  useEffect(() => {
    const f = () => setRolado(window.scrollY > 4);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);

  // Fecha menus ao navegar.
  useEffect(() => { setMenuAberto(false); setPainelAberto(false); }, [caminho]);

  const fecharMenu = (devolverFoco = true) => {
    setMenuAberto(false);
    if (devolverFoco) requestAnimationFrame(() => botaoMenuRef.current?.focus());
  };
  const fecharPainel = () => {
    setPainelAberto(false);
    requestAnimationFrame(() => botaoPainelRef.current?.focus());
  };

  useEffect(() => {
    if (!menuAberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") fecharMenu(); };
    const fora = (e: MouseEvent) => {
      const a = e.target as Node;
      if (!menuRef.current?.contains(a) && !botaoMenuRef.current?.contains(a)) fecharMenu(false);
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("mousedown", fora);
    return () => { document.removeEventListener("keydown", tecla); document.removeEventListener("mousedown", fora); };
  }, [menuAberto]);

  useEffect(() => {
    if (!painelAberto) return;
    const painel = painelRef.current;
    painel?.querySelector<HTMLElement>("button, a")?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); fecharPainel(); return; }
      if (e.key !== "Tab" || !painel) return;
      const focaveis = [...painel.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      if (!focaveis.length) return;
      const prim = focaveis[0]!, ult = focaveis[focaveis.length - 1]!;
      if (e.shiftKey && document.activeElement === prim) { e.preventDefault(); ult.focus(); }
      else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); prim.focus(); }
    };
    document.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", tecla); document.body.style.overflow = overflow; };
  }, [painelAberto]);

  const aoSair = async () => {
    setMenuAberto(false);
    setPainelAberto(false);
    // Sai da área restrita antes de encerrar a sessão, evitando o redirecionamento ao login.
    await navigate({ to: "/" });
    await logout();
  };

  const primeiroNome = usuarioVisivel?.nomeCompleto.split(" ")[0] ?? "";

  return (
    <header className={`sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur transition-shadow motion-reduce:transition-none ${rolado ? "shadow-md" : ""}`}>
      <div className="mx-auto flex h-[60px] max-w-6xl items-center gap-3 px-4 md:grid md:h-[72px] md:grid-cols-[1fr_auto_1fr]">
        {/* Esquerda: marca */}
        <Link to="/" aria-label="MILSIM OPS — página inicial" className={`flex min-w-0 items-center gap-2.5 justify-self-start rounded-md ${foco}`}>
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">MS</span>
          <span aria-hidden="true" className="truncate font-display text-lg font-semibold tracking-wide text-foreground">MILSIM OPS</span>
        </Link>

        {/* Centro: navegação (desktop) */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
          <Navegacao logado={!!usuarioVisivel} />
        </nav>

        {/* Direita: ações */}
        <div className="ml-auto flex items-center gap-1.5 justify-self-end md:ml-0">
          <SeletorCidade compacto className="hidden md:block" />
          {usuarioVisivel && <Sino naoLidas={naoLidas} />}
          {usuarioVisivel ? (
            <div className="relative hidden md:block">
              <button ref={botaoMenuRef} type="button" onClick={() => (menuAberto ? fecharMenu() : setMenuAberto(true))}
                aria-expanded={menuAberto} aria-haspopup="menu" aria-label={`Menu da conta de ${usuarioVisivel.nomeCompleto}`}
                className={`flex h-11 max-w-[12rem] items-center gap-2 rounded-md border border-border bg-secondary/40 pl-1.5 pr-2 text-sm hover:bg-secondary ${foco}`}>
                <Avatar nome={usuarioVisivel.nomeCompleto} foto={usuarioVisivel.fotoUrl} />
                <span className="truncate font-medium">{primeiroNome}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${menuAberto ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {menuAberto && (
                <div ref={menuRef} role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Avatar nome={usuarioVisivel.nomeCompleto} foto={usuarioVisivel.fotoUrl} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{usuarioVisivel.nomeCompleto}</p>
                      <p className="truncate text-xs text-muted-foreground">{usuarioVisivel.email}</p>
                    </div>
                  </div>
                  <ItensConta fechar={() => fecharMenu(false)} aoSair={aoSair} />
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-1.5 md:flex">
              <Link to="/login" search={{ redirect: undefined }} className={`flex h-10 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground ${foco}`}>Entrar</Link>
              <Link to="/cadastro" search={{ redirect: undefined }} tabIndex={-1}><Botao>Criar conta</Botao></Link>
            </div>
          )}
          <button ref={botaoPainelRef} type="button" onClick={() => setPainelAberto(true)} aria-label="Abrir menu" aria-expanded={painelAberto}
            className={`flex h-11 w-11 items-center justify-center rounded-md text-foreground hover:bg-secondary md:hidden ${foco}`}>
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Faixa de localização no celular */}
      <div className="border-t border-border px-4 py-1.5 md:hidden">
        <SeletorCidade compacto />
      </div>

      {painelAberto && montado && createPortal(
        <>
          <div className="fixed inset-0 z-[55] bg-black/60" onClick={fecharPainel} aria-hidden="true" />
          <div ref={painelRef} role="dialog" aria-modal="true" aria-label="Menu"
            className="fixed inset-y-0 right-0 z-[60] flex w-[min(20rem,88vw)] flex-col overflow-y-auto border-l border-border bg-popover p-3 text-popover-foreground shadow-2xl">
            <div className="flex items-center justify-between pb-2">
              {usuarioVisivel ? (
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar nome={usuarioVisivel.nomeCompleto} foto={usuarioVisivel.fotoUrl} />
                  <span className="truncate text-sm font-medium">{usuarioVisivel.nomeCompleto}</span>
                </div>
              ) : <span className="font-display text-base font-semibold tracking-wide">Menu</span>}
              <button type="button" onClick={fecharPainel} aria-label="Fechar menu" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-secondary ${foco}`}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Navegação principal" className="flex flex-col gap-1 border-t border-border py-2">
              <Navegacao logado={!!usuarioVisivel} vertical aoNavegar={() => setPainelAberto(false)} />
            </nav>
            {usuarioVisivel ? (
              <div className="border-t border-border">
                <ItensConta fechar={() => setPainelAberto(false)} aoSair={aoSair} />
              </div>
            ) : (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <Link to="/cadastro" search={{ redirect: undefined }} onClick={() => setPainelAberto(false)}
                  className={`flex h-11 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground ${foco}`}>Criar conta</Link>
                <Link to="/login" search={{ redirect: undefined }} onClick={() => setPainelAberto(false)}
                  className={`flex h-11 items-center justify-center rounded-md border border-border text-sm ${foco}`}>Entrar</Link>
              </div>
            )}
          </div>
        </>,
        document.body,
      )}
    </header>
  );
}
