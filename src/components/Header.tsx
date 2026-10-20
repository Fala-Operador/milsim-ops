import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, ChevronDown, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { usePreferencias } from "@/contexts/PreferenciasContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SeletorCidade } from "./SeletorCidade";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const itemMenu = "flex w-full items-center rounded px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";
const foco = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// No menu da conta (desktop) cada entrada é um DropdownMenuItem; no painel do celular, o próprio link/botão.
function Item({ menu, children }: { menu: boolean; children: ReactNode }) {
  return menu ? <DropdownMenuItem asChild>{children}</DropdownMenuItem> : <>{children}</>;
}

function Aparencia({ onEscolher, menu }: { onEscolher?: () => void; menu: boolean }) {
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
        <Item key={o.v} menu={menu}>
          <Button variant="plain" size="none" type="button" role="menuitemradio" aria-checked={tema === o.v}
            onClick={() => { definirTema(o.v); onEscolher?.(); }}
            className={`${itemMenu} justify-between`}>
            {o.r}
            {tema === o.v && <span className="text-accent" aria-hidden="true">✓</span>}
          </Button>
        </Item>
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
function ItensConta({ fechar, aoSair, menu = false }: { fechar: () => void; aoSair: () => void; menu?: boolean }) {
  const { usuario } = useAuth();
  const { abrirEditor } = usePreferencias();
  if (!usuario) return null;
  const gestao = true;
  return (
    <>
      <Grupo titulo="Conta">
        <Item menu={menu}><Link to="/app" activeOptions={{ exact: true }} className={itemMenu} onClick={fechar}>Minha área</Link></Item>
        <Item menu={menu}><Link to="/app/ingressos" className={itemMenu} onClick={fechar}>Meus ingressos</Link></Item>
        <Item menu={menu}><Link to="/operador/$usuarioId" params={{ usuarioId: usuario.id }} search={{ aba: undefined }} className={itemMenu} onClick={fechar}>Perfil do operador</Link></Item>
        <Item menu={menu}><Link to="/operador/$usuarioId" params={{ usuarioId: usuario.id }} search={{ aba: "recompensas" }} className={itemMenu} onClick={fechar}>Minhas recompensas</Link></Item>
        <Item menu={menu}><Link to="/app/perfil" search={{ aba: undefined }} className={itemMenu} onClick={fechar}>Meu perfil</Link></Item>
        <Item menu={menu}><Button variant="plain" size="none" type="button" className={itemMenu} onClick={() => { fechar(); abrirEditor(); }}>Preferências de eventos</Button></Item>
        <Aparencia onEscolher={fechar} menu={menu} />
      </Grupo>
      {gestao && (
        <Grupo titulo="Gestão">
          {usuario.perfil === "organizador" && <Item menu={menu}><Link to="/organizacao" className={itemMenu} onClick={fechar}>Minha organização</Link></Item>}
          {usuario.perfil === "admin" && <Item menu={menu}><Link to="/admin" className={itemMenu} onClick={fechar}>Administração</Link></Item>}
          {usuario.perfil === "participante" && <Item menu={menu}><Link to="/app/organizador" className={itemMenu} onClick={fechar}>Quero ser organizador</Link></Item>}
        </Grupo>
      )}
      <Grupo titulo="Sessão">
        <Item menu={menu}>
          <Button variant="plain" size="none" type="button" className={`${itemMenu} gap-2 text-destructive`} onClick={aoSair}>
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sair
          </Button>
        </Item>
      </Grupo>
    </>
  );
}

function AvatarConta({ nome, foto }: { nome: string; foto?: string | undefined }) {
  return (
    <Avatar className="h-7 w-7">
      {foto && <AvatarImage src={foto} alt="" className="object-cover" />}
      <AvatarFallback aria-hidden="true" className="bg-primary font-mono text-[11px] font-bold text-primary-foreground">
        {iniciais(nome)}
      </AvatarFallback>
    </Avatar>
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

  // Esc, clique fora, foco preso e devolução do foco ficam com DropdownMenu e Sheet (Radix).
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
      <div className="mx-auto flex h-[60px] max-w-6xl items-center gap-3 px-4 lg:grid lg:h-[72px] lg:grid-cols-[1fr_auto_1fr]">
        {/* Esquerda: marca */}
        <Link to="/" aria-label="MILSIM OPS — página inicial" className={`flex min-w-0 items-center gap-2.5 justify-self-start rounded-md ${foco}`}>
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">MS</span>
          <span aria-hidden="true" className="truncate font-display text-lg font-semibold tracking-wide text-foreground">MILSIM OPS</span>
        </Link>

        {/* Centro: navegação (desktop) */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
          <Navegacao logado={!!usuarioVisivel} />
        </nav>

        {/* Direita: ações */}
        <div className="ml-auto flex items-center gap-1.5 justify-self-end lg:ml-0">
          <SeletorCidade compacto className="hidden lg:block" />
          {usuarioVisivel && <Sino naoLidas={naoLidas} />}
          {usuarioVisivel ? (
            <div className="relative hidden lg:block">
              <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto} modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="plain" size="none" type="button" aria-label={`Menu da conta de ${usuarioVisivel.nomeCompleto}`}
                    className={`flex h-11 max-w-[12rem] items-center gap-2 rounded-md border border-border bg-secondary/40 pl-1.5 pr-2 text-sm hover:bg-secondary ${foco}`}>
                    <AvatarConta nome={usuarioVisivel.nomeCompleto} foto={usuarioVisivel.fotoUrl} />
                    <span className="truncate font-medium">{primeiroNome}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${menuAberto ? "rotate-180" : ""}`} aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-64 border-border shadow-lg">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <AvatarConta nome={usuarioVisivel.nomeCompleto} foto={usuarioVisivel.fotoUrl} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{usuarioVisivel.nomeCompleto}</p>
                      <p className="truncate text-xs text-muted-foreground">{usuarioVisivel.email}</p>
                    </div>
                  </div>
                  <ItensConta fechar={() => setMenuAberto(false)} aoSair={aoSair} menu />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="hidden items-center gap-1.5 lg:flex">
              <Link to="/login" search={{ redirect: undefined }} className={`flex h-10 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground ${foco}`}>Entrar</Link>
              <Button asChild><Link to="/cadastro" search={{ redirect: undefined }}>Criar conta</Link></Button>
            </div>
          )}
          <Sheet open={painelAberto} onOpenChange={setPainelAberto}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="none" aria-label="Abrir menu" className={`h-11 w-11 lg:hidden ${foco}`}>
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" showCloseButton={false} aria-describedby={undefined}
              className="z-[60] flex w-[min(20rem,88vw)] flex-col gap-0 overflow-y-auto border-border p-3 shadow-2xl sm:max-w-none">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex items-center justify-between pb-2">
                {usuarioVisivel ? (
                  <div className="flex min-w-0 items-center gap-2">
                    <AvatarConta nome={usuarioVisivel.nomeCompleto} foto={usuarioVisivel.fotoUrl} />
                    <span className="truncate text-sm font-medium">{usuarioVisivel.nomeCompleto}</span>
                  </div>
                ) : <span className="font-display text-base font-semibold tracking-wide">Menu</span>}
                <SheetClose asChild>
                  <Button variant="ghost" size="none" aria-label="Fechar menu" className={`h-11 w-11 shrink-0 ${foco}`}>
                    <X className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </SheetClose>
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
                  <Button asChild className={`h-11 ${foco}`}>
                    <Link to="/cadastro" search={{ redirect: undefined }} onClick={() => setPainelAberto(false)}>Criar conta</Link>
                  </Button>
                  <Button asChild variant="outline" className={`h-11 font-normal ${foco}`}>
                    <Link to="/login" search={{ redirect: undefined }} onClick={() => setPainelAberto(false)}>Entrar</Link>
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Faixa de localização no celular */}
      <div className="border-t border-border px-4 py-1.5 lg:hidden">
        <SeletorCidade compacto />
      </div>
    </header>
  );
}
