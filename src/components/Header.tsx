import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { Botao } from "./ui";
import { SeletorCidade } from "./SeletorCidade";

function Aparencia({ onEscolher }: { onEscolher?: () => void }) {
  const { tema, podeAlterar, definirTema } = useTheme();
  if (!podeAlterar) return null;
  const opcoes = [
    { v: "dark" as const, r: "Escuro — Verde-oliva" },
    { v: "light" as const, r: "Claro — TAN" },
  ];
  return (
    <div role="group" aria-label="Aparência" className="border-t border-border px-1 pt-1">
      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Aparência</p>
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          role="menuitemradio"
          aria-checked={tema === o.v}
          onClick={() => { definirTema(o.v); onEscolher?.(); }}
          className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-secondary"
        >
          {o.r}
          {tema === o.v && <span className="text-accent" aria-hidden="true">✓</span>}
        </button>
      ))}
    </div>
  );
}

export function Header() {
  const { usuario, logout } = useAuth();
  const { naoLidas } = useNotifications();
  const navigate = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);
  // A sessão vem do armazenamento local: só é lida após a montagem para evitar
  // divergência entre a renderização do servidor e a do navegador.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const usuarioVisivel = montado ? usuario : null;

  const aoSair = async () => {
    setMenuAberto(false);
    // Sai da área restrita antes de encerrar a sessão: senão o layout dela
    // percebe a sessão encerrada e redireciona para o login.
    await navigate({ to: "/" });
    await logout();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">
            MS
          </span>
          <span className="font-display text-lg font-semibold tracking-wide text-foreground">
            MILSIM OPS
          </span>
        </Link>

        <nav className="flex items-center gap-2" aria-label="Navegação principal">
          <Link
            to="/"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground sm:block"
          >
            Eventos
          </Link>
          <SeletorCidade compacto className="hidden md:block" />
          {usuarioVisivel ? (
            <>
              <Link
                to="/app/comunidades"
                className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground sm:block"
              >
                Comunidades
              </Link>
              <Link
                to="/app/notificacoes"
                className="relative rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label={`Notificações, ${naoLidas} não lidas`}
              >
                🔔
                {naoLidas > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {naoLidas}
                  </span>
                )}
              </Link>
              <div className="relative">
                <Botao variante="secundario" onClick={() => setMenuAberto((v) => !v)} aria-expanded={menuAberto}>
                  {usuarioVisivel.nomeCompleto.split(" ")[0]} ▾
                </Botao>
                {menuAberto && (
                  <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-lg" role="menu">
                    <Link to="/app" className="block rounded px-3 py-2 text-sm hover:bg-secondary" onClick={() => setMenuAberto(false)}>
                      Minha área
                    </Link>
                    {usuarioVisivel.perfil === "organizador" && (
                      <Link to="/organizacao" className="block rounded px-3 py-2 text-sm hover:bg-secondary" onClick={() => setMenuAberto(false)}>
                        Minha organização
                      </Link>
                    )}
                    {usuarioVisivel.perfil === "admin" && (
                      <Link to="/admin" className="block rounded px-3 py-2 text-sm hover:bg-secondary" onClick={() => setMenuAberto(false)}>
                        Administração
                      </Link>
                    )}
                    {usuarioVisivel.perfil === "participante" && (
                      <Link to="/app/organizador" className="block rounded px-3 py-2 text-sm text-muted-foreground hover:bg-secondary" onClick={() => setMenuAberto(false)}>
                        Quero ser organizador
                      </Link>
                    )}
                    <Link to="/app/perfil" className="block rounded px-3 py-2 text-sm hover:bg-secondary" onClick={() => setMenuAberto(false)}>
                      Configurações da conta
                    </Link>
                    <Aparencia />
                    <button className="block w-full rounded border-t border-border px-3 py-2 text-left text-sm text-destructive hover:bg-secondary" onClick={aoSair}>
                      Sair
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" search={{ redirect: undefined }} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
                Entrar
              </Link>
              <Link to="/cadastro" search={{ redirect: undefined }}>
                <Botao>Criar conta</Botao>
              </Link>
            </>
          )}
        </nav>
      </div>
      <div className="border-t border-border px-4 py-2 md:hidden">
        <SeletorCidade compacto />
      </div>
    </header>
  );
}
