// Widget do Cloudflare Turnstile. O token gerado vai para o servidor, que o repassa ao Supabase
// Auth (CAPTCHA). Cada token vale para uma única tentativa: chame `resetar` depois de cada envio.
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { obterConfigTurnstile } from "@/api/sessao.functions";
import { tr } from "@/i18n/components/Turnstile";

interface ApiTurnstile {
  render: (el: HTMLElement, opcoes: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: ApiTurnstile;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let carregando: Promise<ApiTurnstile> | null = null;

function carregarScript(): Promise<ApiTurnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  carregando ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile indisponível")));
    s.onerror = () => {
      carregando = null;
      reject(new Error("Turnstile indisponível"));
    };
    document.head.appendChild(s);
  });
  return carregando;
}

/**
 * Turnstile do formulário. `pronto` fica verdadeiro quando há token (ou quando o site não tem a
 * chave configurada; aí o envio segue sem token e o Supabase decide).
 */
export function useTurnstile(acao: string) {
  const config = useQuery({ queryKey: ["config-turnstile"], queryFn: obterConfigTurnstile, staleTime: Infinity });
  const chave = config.data?.chaveSite ?? null;
  // Ref por estado: em formulários por etapas a caixa só aparece depois, e o widget precisa nascer nela.
  const [caixa, setCaixa] = useState<HTMLDivElement | null>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!chave || !caixa) return;
    let ativo = true;
    carregarScript()
      .then((api) => {
        if (!ativo) return;
        widget.current = api.render(caixa, {
          sitekey: chave,
          action: acao,
          language: "pt-br",
          theme: "auto",
          size: "flexible",
          callback: (t: string) => {
            setFalhou(false);
            setToken(t);
          },
          "expired-callback": () => setToken(null),
          "error-callback": () => {
            setToken(null);
            setFalhou(true);
          },
        });
      })
      .catch(() => ativo && setFalhou(true));
    return () => {
      ativo = false;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
      setToken(null);
    };
  }, [chave, acao, caixa]);

  const resetar = useCallback(() => {
    setToken(null);
    if (widget.current) window.turnstile?.reset(widget.current);
  }, []);

  const ativo = !!chave;
  const elemento = ativo ? (
    <div className="space-y-1">
      <div ref={setCaixa} className="min-h-[65px]" />
      {falhou && (
        <p role="alert" className="text-xs text-destructive">
          {tr("a_verificacao_anti_robo_nao_carregou")}</p>
      )}
    </div>
  ) : null;

  return {
    elemento,
    token: token ?? undefined,
    pronto: !config.isPending && (!ativo || !!token),
    resetar,
  };
}
