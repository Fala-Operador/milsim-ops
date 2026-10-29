import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Award, Building2, ChevronDown, ChevronRight, Crosshair, IdCard, Layers, LayoutDashboard, LogOut, Menu, MessagesSquare, ShieldCheck, SlidersHorizontal, Ticket, UserRound, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { SinoNotificacoes } from "./SinoNotificacoes";
import { usePreferencias } from "@/contexts/PreferenciasContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SeletorCidade } from "./SeletorCidade";
import { ItensMenuArea, totalPendencias, useMenuArea } from "./MenuLateral";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIdioma } from "@/contexts/IdiomaContext";
import { tr } from "@/i18n/components/Header";

const foco = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const linha = `flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-secondary/70 ${foco}`;
const iconeLinha = "h-4 w-4 shrink-0 text-muted-foreground";

// No menu da conta (desktop) cada entrada é um DropdownMenuItem; no painel do celular, o próprio link/botão.
function Item({ menu, children }: { menu: boolean; children: ReactNode }) {
  return menu ? <DropdownMenuItem asChild className="p-0 focus:bg-secondary/70 focus:text-foreground">{children}</DropdownMenuItem> : <>{children}</>;
}

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="rotulo-tecnico px-3 pb-1.5 pt-3">{children}</p>;
}

/** Dois quadros com as cores de cada tema, lado a lado. */
function Aparencia({ onEscolher, menu }: { onEscolher?: () => void; menu: boolean }) {
  const { tema, podeAlterar, definirTema } = useTheme();
  if (!podeAlterar) return null;
  const opcoes = [
    { v: "dark" as const, r: tr("escuro"), sub: tr("verde_oliva"), classe: "dark" },
    { v: "light" as const, r: tr("claro"), sub: "TAN", classe: "tema-claro" },
  ];
  return (
    <div role="group" aria-label={tr("aparencia")}>
      <Rotulo>{tr("aparencia")}</Rotulo>
      <div className="grid grid-cols-2 gap-2 px-1">
        {opcoes.map((o) => (
          <Item key={o.v} menu={menu}>
            <Button variant="plain" size="none" type="button" role="menuitemradio" aria-checked={tema === o.v}
              onClick={() => { definirTema(o.v); onEscolher?.(); }}
              className={`flex items-center gap-2 rounded-md border p-1.5 text-left text-sm ${tema === o.v ? "border-accent ring-1 ring-accent" : "border-border hover:border-muted-foreground/60"} ${foco}`}>
              <span aria-hidden="true" className={`${o.classe} grid h-8 w-8 shrink-0 grid-cols-2 overflow-hidden rounded border border-border bg-background`}>
                <span className="bg-primary" /><span className="bg-accent" />
                <span className="bg-card" /><span className="bg-background" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block font-medium">{o.r}</span>
                <span className="block text-[11px] text-muted-foreground">{o.sub}</span>
              </span>
            </Button>
          </Item>
        ))}
      </div>
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
  const atalhos = [
    { to: "/app" as const, rotulo: tr("minha_area"), icone: LayoutDashboard, exato: true },
    { to: "/app/ingressos" as const, rotulo: tr("ingressos"), icone: Ticket },
  ];
  return (
    <>
      {/* Atalhos mais usados em dois blocos grandes. */}
      <div className="grid grid-cols-2 gap-2 px-1 pt-2">
        {atalhos.map(({ to, rotulo, icone: Icone, exato }) => (
          <Item key={to} menu={menu}>
            <Link to={to} activeOptions={{ exact: !!exato }} onClick={fechar}
              className={`flex flex-col items-start gap-2 rounded-md border border-border bg-secondary/30 p-3 text-sm font-medium hover:border-muted-foreground/60 hover:bg-secondary/60 ${foco}`}
              activeProps={{ className: "!border-accent", "aria-current": "page" }}>
              <Icone className="h-5 w-5 text-accent" aria-hidden="true" />
              {rotulo}
            </Link>
          </Item>
        ))}
      </div>
      <Rotulo>{tr("conta")}</Rotulo>
      <Item menu={menu}><Link to="/operador/$usuarioId" params={{ usuarioId: usuario.id }} search={{ aba: "recompensas" }} className={linha} onClick={fechar}><Award className={iconeLinha} aria-hidden="true" />{tr("minhas_recompensas")}</Link></Item>
      <Item menu={menu}><Link to="/app/perfil" search={{ aba: undefined }} className={linha} onClick={fechar}><UserRound className={iconeLinha} aria-hidden="true" />{tr("meu_perfil")}</Link></Item>
      <Item menu={menu}><Button variant="plain" size="none" type="button" className={linha} onClick={() => { fechar(); abrirEditor(); }}><SlidersHorizontal className={iconeLinha} aria-hidden="true" />{tr("preferencias_de_eventos")}</Button></Item>
      <Aparencia onEscolher={fechar} menu={menu} />
      {/* Gestão em destaque: é a porta de entrada do organizador e do admin (o admin com organização vê as duas). */}
      <div className="px-1 pt-3">
        {(usuario.perfil === "organizador" || (usuario.perfil === "admin" && !!usuario.organizacaoId)) && <Item menu={menu}><Link to="/organizacao" onClick={fechar} className={`flex items-center gap-3 rounded-md border border-border p-3 hover:bg-secondary/60 ${foco}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-primary text-primary-foreground"><Building2 className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{tr("minha_organizacao")}</span><span className="block text-xs text-muted-foreground">{tr("operacoes_inscritos_e_financeiro")}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" /></Link></Item>}
        {usuario.perfil === "admin" && <Item menu={menu}><Link to="/admin" onClick={fechar} className={`flex items-center gap-3 rounded-md border border-border p-3 hover:bg-secondary/60 ${foco}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-primary text-primary-foreground"><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{tr("administracao")}</span><span className="block text-xs text-muted-foreground">{tr("usuarios_pagamentos_e_moderacao")}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" /></Link></Item>}
        {usuario.perfil === "participante" && <Item menu={menu}><Link to="/app/organizador" onClick={fechar} className={`flex items-center gap-3 rounded-md border border-dashed border-border p-3 hover:bg-secondary/60 ${foco}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded border border-border text-accent"><Building2 className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{tr("quero_ser_organizador")}</span><span className="block text-xs text-muted-foreground">{tr("publique_suas_proprias_operacoes")}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" /></Link></Item>}
      </div>
      {menu && (
        <div className="mt-2 border-t border-border px-1 pt-1">
          <Item menu><Button variant="plain" size="none" type="button" className={`${linha} text-destructive`} onClick={aoSair}><LogOut className="h-4 w-4" aria-hidden="true" />{tr("sair")}</Button></Item>
        </div>
      )}
    </>
  );
}

function AvatarConta({ nome, foto, grande = false }: { nome: string; foto?: string | undefined; grande?: boolean }) {
  return (
    <Avatar className={grande ? "h-11 w-11" : "h-8 w-8"}>
      {foto && <AvatarImage src={foto} alt="" className="object-cover" />}
      <AvatarFallback aria-hidden="true" className={`bg-primary font-mono font-bold text-primary-foreground ${grande ? "text-sm" : "text-[11px]"}`}>
        {iniciais(nome)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Cartão do topo do menu: quem está logado e o atalho para o perfil público. */
function CartaoConta({ fechar }: { fechar: () => void }) {
  const { usuario } = useAuth();
  if (!usuario) return null;
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <AvatarConta nome={usuario.nomeCompleto} foto={usuario.fotoUrl} grande />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{usuario.nomeCompleto}</p>
        <p className="truncate text-xs text-muted-foreground">{usuario.email}</p>
        <Link to="/operador/$usuarioId" params={{ usuarioId: usuario.id }} search={{ aba: undefined }} onClick={fechar}
          className={`mt-1 inline-flex items-center gap-1 rounded text-xs font-medium text-accent hover:underline ${foco}`}>
          <IdCard className="h-3.5 w-3.5" aria-hidden="true" />{tr("ver_perfil_do_operador")}</Link>
      </div>
    </div>
  );
}

const NAVEGACAO = [
  { to: "/" as const, rotulo: "nav.eventos", icone: Crosshair, exato: true },
  // Modalidades é público: explica o que existe, logado ou não.
  { to: "/modalidades" as const, rotulo: "nav.modalidades", icone: Layers },
  // Comunidades é vitrine pública; o conteúdo continua só para inscritos (decidido ao entrar).
  { to: "/comunidades" as const, rotulo: "nav.comunidades", icone: MessagesSquare },
];

/** Desktop: controle segmentado, a página atual fica em relevo. */
function NavegacaoTopo() {
  const { t } = useIdioma();
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-secondary/30 p-1">
      {NAVEGACAO.map(({ to, rotulo, icone: Icone, exato }) => (
        <Link key={to} to={to} activeOptions={{ exact: !!exato }}
          className={`flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-medium text-muted-foreground hover:text-foreground ${foco}`}
          activeProps={{ className: "bg-background !text-foreground shadow-sm ring-1 ring-border [&>svg]:text-accent", "aria-current": "page" }}>
          <Icone className="h-4 w-4" aria-hidden="true" />{t(rotulo)}
        </Link>
      ))}
    </div>
  );
}

/** Celular: linhas grandes com ícone; a atual ganha a barra de destaque à esquerda. */
function NavegacaoPainel({ aoNavegar }: { aoNavegar: () => void }) {
  const { t } = useIdioma();
  return (
    <>
      {NAVEGACAO.map(({ to, rotulo, icone: Icone, exato }) => (
        <Link key={to} to={to} activeOptions={{ exact: !!exato }} onClick={aoNavegar}
          className={`${linha} relative font-medium`}
          activeProps={{ className: "bg-secondary before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-accent [&>svg]:!text-accent", "aria-current": "page" }}>
          <Icone className={iconeLinha} aria-hidden="true" />{t(rotulo)}
        </Link>
      ))}
    </>
  );
}

function Marca() {
  const { t } = useIdioma();
  return (
    <Link to="/" aria-label={t("cabecalho.marca_aria")} className={`flex min-w-0 shrink-0 items-center gap-2 justify-self-start rounded-md ${foco}`}>
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-8 w-8 shrink-0 text-primary">
        <path d="M4 3h24v17.5L16 29 4 20.5Z" fill="currentColor" />
        <path d="m9 12 7-4.5 7 4.5M9 18l7-4.5 7 4.5" fill="none" stroke="var(--background)" strokeWidth="2.6" strokeLinejoin="miter" />
      </svg>
      <span aria-hidden="true" className="font-display text-lg font-bold uppercase leading-none tracking-[0.04em] text-foreground lg:text-[22px]">
        Milsim<span className="text-accent">Ops</span>
      </span>
    </Link>
  );
}

export function Header() {
  const { usuario, logout } = useAuth();
  const { t } = useIdioma();
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
  const menuArea = useMenuArea();
  const pendenciasArea = menuArea ? totalPendencias(menuArea.grupos) : 0;

  return (
    <header className={`vt-cabecalho sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md transition-shadow motion-reduce:transition-none ${rolado ? "shadow-md" : ""}`}>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 lg:grid lg:h-[68px] lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
        <Marca />

        {/* Centro: navegação (desktop) */}
        <nav className="hidden lg:block" aria-label={t("cabecalho.navegacao_aria")}>
          <NavegacaoTopo />
        </nav>

        {/* Direita: região, avisos e conta */}
        <div className="ml-auto flex min-w-0 items-center gap-0.5 justify-self-end lg:ml-0 lg:min-w-max lg:gap-1">
          <SeletorCidade compacto variante="cabecalho" className="min-w-0" />
          <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-border lg:block" />
          {usuarioVisivel && <SinoNotificacoes />}
          {usuarioVisivel ? (
            <div className="relative hidden lg:block">
              <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto} modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="plain" size="none" type="button" aria-label={tr("menu_da_conta_de_nomecompleto", { nomeCompleto: usuarioVisivel.nomeCompleto })}
                    className={`flex h-11 max-w-[13rem] items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-sm hover:bg-secondary/70 data-[state=open]:bg-secondary ${foco}`}>
                    <AvatarConta nome={usuarioVisivel.nomeCompleto} foto={usuarioVisivel.fotoUrl} />
                    <span className="truncate font-medium">{primeiroNome}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${menuAberto ? "rotate-180" : ""}`} aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10} className="w-80 border-border p-1.5 pb-1 shadow-xl">
                  <CartaoConta fechar={() => setMenuAberto(false)} />
                  <DropdownMenuSeparator className="mx-1" />
                  <ItensConta fechar={() => setMenuAberto(false)} aoSair={aoSair} menu />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
              <Link to="/login" search={{ redirect: undefined }} className={`flex h-10 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground ${foco}`}>{t("cabecalho.entrar")}</Link>
              <Button asChild className="h-10"><Link to="/cadastro" search={{ redirect: undefined }}>{t("cabecalho.criar_conta")}</Link></Button>
            </div>
          )}
          <Sheet open={painelAberto} onOpenChange={setPainelAberto}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="none" aria-label={pendenciasArea > 0 ? tr("abrir_menu_pendenciasarea_pendencias", { pendenciasArea }) : t("cabecalho.abrir_menu")} className={`relative h-11 w-11 shrink-0 lg:hidden ${foco}`}>
                {usuarioVisivel ? <AvatarConta nome={usuarioVisivel.nomeCompleto} foto={usuarioVisivel.fotoUrl} /> : <Menu className="h-5 w-5" aria-hidden="true" />}
                {pendenciasArea > 0 && (
                  <span aria-hidden="true" className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-4 text-accent-foreground">{pendenciasArea}</span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" showCloseButton={false} aria-describedby={undefined}
              className="z-[60] flex h-dvh w-[min(22rem,92vw)] flex-col gap-0 overflow-hidden border-border p-0 shadow-2xl sm:max-w-none">
              <SheetTitle className="sr-only">{t("cabecalho.menu")}</SheetTitle>
              {/* Topo fixo: marca e fechar sempre à vista. */}
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-border pl-4 pr-2">
                <Marca />
                <SheetClose asChild>
                  <Button variant="ghost" size="none" aria-label={t("cabecalho.fechar_menu")} className={`h-11 w-11 shrink-0 ${foco}`}>
                    <X className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </SheetClose>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
                {usuarioVisivel ? (
                  <div className="border-b border-border"><CartaoConta fechar={() => setPainelAberto(false)} /></div>
                ) : (
                  <div className="m-1 mt-3 rounded-lg border border-border bg-secondary/30 p-4">
                    <p className="font-display text-lg font-bold uppercase leading-tight">{t("cabecalho.convite_titulo")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t("cabecalho.convite_texto")}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button asChild className={`h-11 ${foco}`}>
                        <Link to="/cadastro" search={{ redirect: undefined }} onClick={() => setPainelAberto(false)}>{t("cabecalho.criar_conta")}</Link>
                      </Button>
                      <Button asChild variant="outline" className={`h-11 ${foco}`}>
                        <Link to="/login" search={{ redirect: undefined }} onClick={() => setPainelAberto(false)}>{t("cabecalho.entrar")}</Link>
                      </Button>
                    </div>
                  </div>
                )}
                {/* Dentro da Administração/Organização, as seções da área vêm primeiro (um único menu). */}
                {menuArea && (
                  <nav aria-label={tr("secoes_titulo", { titulo: menuArea.titulo })} className="border-b border-border pb-3">
                    <Rotulo>{menuArea.titulo}</Rotulo>
                    <ItensMenuArea grupos={menuArea.grupos} aoNavegar={() => setPainelAberto(false)} />
                  </nav>
                )}
                <nav aria-label={t("cabecalho.navegacao_aria")} className="pb-1">
                  <Rotulo>{t("cabecalho.navegar")}</Rotulo>
                  <NavegacaoPainel aoNavegar={() => setPainelAberto(false)} />
                </nav>
                {usuarioVisivel && <ItensConta fechar={() => setPainelAberto(false)} aoSair={aoSair} />}
              </div>
              {usuarioVisivel && (
                <div className="shrink-0 border-t border-border px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                  <Button variant="plain" size="none" type="button" className={`${linha} text-destructive`} onClick={aoSair}>
                    <LogOut className="h-4 w-4" aria-hidden="true" />{tr("sair_da_conta")}</Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
