import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { Botao } from "./ui";

function ControleTema() {
  const { preferencia, definirPreferencia } = useTheme();
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="sr-only">Tema</span>
      <select
        aria-label="Selecionar tema"
        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
        value={preferencia}
        onChange={(e) => definirPreferencia(e.target.value as "dark" | "light" | "system")}
      >
        <option value="dark">Escuro</option>
        <option value="light">Claro</option>
        <option value="system">Sistema</option>
      </select>
    </label>
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

  const aoSair = () => {
    logout();
    setMenuAberto(false);
    navigate({ to: "/" });
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
          <ControleTema />
          {usuario ? (
            <>
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
                  {usuario.nomeCompleto.split(" ")[0]} ▾
                </Botao>
                {menuAberto && (
                  <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-lg" role="menu">
                    <Link to="/app" className="block rounded px-3 py-2 text-sm hover:bg-secondary" onClick={() => setMenuAberto(false)}>
                      Minha área
                    </Link>
                    {usuario.perfil === "organizador" && (
                      <Link to="/organizacao" className="block rounded px-3 py-2 text-sm hover:bg-secondary" onClick={() => setMenuAberto(false)}>
                        Minha organização
                      </Link>
                    )}
                    {usuario.perfil === "admin" && (
                      <Link to="/admin" className="block rounded px-3 py-2 text-sm hover:bg-secondary" onClick={() => setMenuAberto(false)}>
                        Administração
                      </Link>
                    )}
                    {usuario.perfil === "participante" && (
                      <Link to="/app/organizador" className="block rounded px-3 py-2 text-sm text-muted-foreground hover:bg-secondary" onClick={() => setMenuAberto(false)}>
                        Quero ser organizador
                      </Link>
                    )}
                    <button className="block w-full rounded px-3 py-2 text-left text-sm text-destructive hover:bg-secondary" onClick={aoSair}>
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
                <Botao>Cadastrar</Botao>
              </Link>
            </>
          )}
        </nav>
      </div>
      <p className="border-t border-border bg-secondary/50 py-1 text-center text-[11px] text-muted-foreground">
        Ambiente de demonstração — utilize apenas dados fictícios.
      </p>
    </header>
  );
}
