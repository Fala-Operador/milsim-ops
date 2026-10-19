// Componentes embutidos do Stripe Connect (saques e pagamentos) dentro de Financeiro.
// O connect.js vem direto do Stripe (sem pacote npm); o servidor só cria a Account Session.
// Reembolso e disputa ficam desligados na sessão: o estorno passa pelo cancelamento da inscrição.
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { sessaoComponentesStripeOrg } from "@/api/repasses.functions";
import { Botao } from "@/components/ui";
import { useTheme } from "@/contexts/ThemeContext";
import type { Tema } from "@/lib/localizacao";

const SCRIPT_CONNECT = "https://connect-js.stripe.com/v1.0/connect.js";

type Componente = "payouts" | "payments";
const ABAS: { id: Componente; rotulo: string }[] = [
  { id: "payouts", rotulo: "Saques" },
  { id: "payments", rotulo: "Pagamentos" },
];

interface InstanciaConnect {
  create(componente: Componente): HTMLElement;
  update(opcoes: { appearance?: unknown; locale?: string }): void;
  logout?(): Promise<void>;
}
interface StripeConnectGlobal {
  init?(opcoes: { publishableKey: string; fetchClientSecret: () => Promise<string>; locale?: string; appearance?: unknown }): InstanciaConnect;
  onLoad?: () => void;
}
declare global {
  interface Window { StripeConnect?: StripeConnectGlobal }
}

let carregamento: Promise<StripeConnectGlobal> | null = null;

/** Carrega o connect.js uma única vez por página. */
function carregarConnect(): Promise<StripeConnectGlobal> {
  if (carregamento) return carregamento;
  carregamento = new Promise((resolve, reject) => {
    const sc = (window.StripeConnect = window.StripeConnect ?? {});
    if (sc.init) return resolve(sc);
    sc.onLoad = () => resolve(window.StripeConnect!);
    const tag = document.createElement("script");
    tag.src = SCRIPT_CONNECT;
    tag.async = true;
    tag.onerror = () => {
      carregamento = null;
      tag.remove();
      reject(new Error("Não foi possível carregar os painéis do Stripe."));
    };
    document.head.appendChild(tag);
  });
  return carregamento;
}

/** Cores do site em hex (o Stripe não aceita oklch). */
function aparencia(tema: Tema) {
  const escuro = tema === "dark";
  return {
    variables: {
      colorPrimary: escuro ? "#a6bf6e" : "#5a6b3e",
      colorBackground: escuro ? "#1a231c" : "#f3eddf",
      colorText: escuro ? "#eef2e6" : "#3a352c",
      colorDanger: escuro ? "#f07067" : "#b3261e",
      fontFamily: "inherit",
      borderRadius: "6px",
    },
  };
}

export function PaineisStripe({ organizacaoId }: { organizacaoId: string }) {
  const { tema } = useTheme();
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<Componente>("payouts");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const instancia = useRef<InstanciaConnect | null>(null);
  const area = useRef<HTMLDivElement | null>(null);

  // Cria a instância ao abrir; a sessão é pedida ao servidor sempre que o Stripe precisar.
  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    setErro("");
    setCarregando(true);
    carregarConnect()
      .then((sc) => {
        if (!ativo || !sc.init) return;
        let chave = "";
        const buscarSegredo = async () => {
          const s = await sessaoComponentesStripeOrg(organizacaoId);
          chave = s.chavePublicavel;
          return s.clientSecret;
        };
        // A chave publicável vem junto da primeira sessão.
        return buscarSegredo().then((primeiro) => {
          if (!ativo) return;
          let usado = false;
          instancia.current = sc.init!({
            publishableKey: chave,
            fetchClientSecret: () => (usado ? buscarSegredo() : ((usado = true), Promise.resolve(primeiro))),
            locale: "pt-BR",
            appearance: aparencia(tema),
          });
          setCarregando(false);
        });
      })
      .catch((err) => {
        if (!ativo) return;
        setErro(err instanceof Error ? err.message : "Não foi possível abrir os painéis do Stripe.");
        setCarregando(false);
      });
    return () => {
      ativo = false;
      void instancia.current?.logout?.().catch(() => undefined);
      instancia.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, organizacaoId]);

  // Monta o componente da aba escolhida.
  useEffect(() => {
    const alvo = area.current;
    if (!aberto || carregando || !alvo || !instancia.current) return;
    alvo.replaceChildren(instancia.current.create(aba));
    return () => alvo.replaceChildren();
  }, [aberto, carregando, aba]);

  useEffect(() => {
    instancia.current?.update({ appearance: aparencia(tema) });
  }, [tema]);

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-medium"><LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />Painéis do Stripe</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Saques e pagamentos direto do Stripe. Em alguns casos o Stripe pede para entrar na conta numa janela própria.
            Reembolsos são feitos pelo cancelamento da inscrição, aqui no site.
          </p>
        </div>
        {!aberto && (
          <Botao type="button" variante="contorno" className="w-full shrink-0 sm:w-auto" onClick={() => setAberto(true)}>Abrir painéis</Botao>
        )}
      </div>
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
      {aberto && !erro && (
        <>
          <div role="tablist" aria-label="Painéis do Stripe" className="mt-3 flex gap-1 overflow-x-auto">
            {ABAS.map((a) => (
              <Botao
                key={a.id}
                type="button"
                role="tab"
                aria-selected={aba === a.id}
                variante={aba === a.id ? "primario" : "fantasma"}
                onClick={() => setAba(a.id)}
              >
                {a.rotulo}
              </Botao>
            ))}
          </div>
          {carregando && <p className="mt-2 text-sm text-muted-foreground">Carregando o Stripe...</p>}
          <div ref={area} role="tabpanel" className="mt-3 min-h-24 w-full min-w-0 overflow-x-auto" />
        </>
      )}
    </div>
  );
}
