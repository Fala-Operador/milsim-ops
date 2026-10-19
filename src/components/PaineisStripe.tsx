// Componentes embutidos do Stripe Connect dentro de Financeiro: cadastro da conta, avisos de
// pendência, dados da conta, saques e pagamentos. A organização não sai do site; o Stripe só
// abre uma janela própria para confirmar quem é (código por e-mail ou SMS), exigência dele para
// contas Express, e o navegador só deixa essa janela abrir depois de um clique; por isso nada do
// Stripe é montado sozinho ao carregar a página. O connect.js vem direto do Stripe (sem pacote
// npm); o servidor só cria a Account Session. Reembolso e disputa ficam desligados: o estorno passa pelo cancelamento.
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { sessaoComponentesStripeOrg } from "@/api/repasses.functions";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import type { Tema } from "@/lib/localizacao";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SCRIPT_CONNECT = "https://connect-js.stripe.com/v1.0/connect.js";

type Componente = "payouts" | "payments" | "account-management" | "account-onboarding" | "notification-banner";
type Aba = "payouts" | "payments" | "account-management";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "payouts", rotulo: "Saques" },
  { id: "payments", rotulo: "Pagamentos" },
  { id: "account-management", rotulo: "Dados da conta" },
];

interface ElementoConnect extends HTMLElement {
  setOnExit?(fn: () => void): void;
  setOnLoadError?(fn: (e: { error: { type?: string; message?: string } }) => void): void;
  setPrivacyPolicyUrl?(url: string): void;
}
interface InstanciaConnect {
  create(componente: Componente): ElementoConnect;
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

const instancias = new Map<string, Promise<InstanciaConnect>>();

/**
 * Uma instância do Connect por organização, reaproveitada por todos os componentes da página.
 * A sessão é pedida ao servidor sempre que o Stripe precisar (a primeira traz também a chave
 * publicável). A instância não é encerrada ao desmontar: o `logout` derruba a confirmação de
 * identidade do Stripe e obriga a abrir a janela dele de novo, que o navegador bloqueia quando
 * não vem de um clique.
 */
function instanciaDaOrganizacao(organizacaoId: string, tema: Tema): Promise<InstanciaConnect> {
  const existente = instancias.get(organizacaoId);
  if (existente) return existente;
  const buscarSessao = () => sessaoComponentesStripeOrg(organizacaoId);
  const nova = Promise.all([carregarConnect(), buscarSessao()]).then(([sc, primeira]) => {
    if (!sc.init) throw new Error("Não foi possível carregar os painéis do Stripe.");
    let usada = false;
    return sc.init({
      publishableKey: primeira.chavePublicavel,
      fetchClientSecret: async () => (usada ? (await buscarSessao()).clientSecret : ((usada = true), primeira.clientSecret)),
      locale: "pt-BR",
      appearance: aparencia(tema),
    });
  });
  nova.catch(() => instancias.delete(organizacaoId));
  instancias.set(organizacaoId, nova);
  return nova;
}

/** Encerra as sessões do Stripe abertas nesta página. Chamado só ao sair da conta do site. */
export async function encerrarStripeConnect(): Promise<void> {
  const abertas = [...instancias.values()];
  instancias.clear();
  await Promise.all(abertas.map((p) => p.then((i) => i.logout?.()).catch(() => undefined)));
}

/** Instância compartilhada da organização enquanto `ligado`. */
function useInstanciaStripe(organizacaoId: string, ligado: boolean) {
  const { tema } = useTheme();
  const [instancia, setInstancia] = useState<InstanciaConnect | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!ligado) return;
    let ativo = true;
    setErro("");
    instanciaDaOrganizacao(organizacaoId, tema)
      .then((i) => {
        if (ativo) setInstancia(i);
      })
      .catch((err) => {
        if (ativo) setErro(err instanceof Error ? err.message : "Não foi possível abrir o Stripe.");
      });
    return () => {
      ativo = false;
      setInstancia(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligado, organizacaoId]);

  useEffect(() => {
    instancia?.update({ appearance: aparencia(tema) });
  }, [instancia, tema]);

  return { instancia, erro, carregando: ligado && !instancia && !erro };
}

/** Monta um componente do Stripe num contêiner do site. */
function ElementoStripe({ instancia, componente, aoSair, className = "" }: {
  instancia: InstanciaConnect;
  componente: Componente;
  aoSair?: (() => void) | undefined;
  className?: string;
}) {
  const area = useRef<HTMLDivElement | null>(null);
  const saida = useRef(aoSair);
  saida.current = aoSair;
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    const alvo = area.current;
    if (!alvo) return;
    setFalhou(false);
    const el = instancia.create(componente);
    el.setOnLoadError?.(() => setFalhou(true));
    if (componente === "account-onboarding") {
      el.setOnExit?.(() => saida.current?.());
      el.setPrivacyPolicyUrl?.(`${window.location.origin}/privacidade`);
    }
    alvo.replaceChildren(el);
    return () => alvo.replaceChildren();
  }, [instancia, componente]);
  return (
    <>
      {falhou && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          O Stripe não conseguiu abrir este painel. Se o navegador avisou que bloqueou uma janela, permita pop-ups para este site e tente de novo.
        </p>
      )}
      <div ref={area} className={`w-full min-w-0 overflow-x-auto ${className}`} />
    </>
  );
}

/**
 * Cadastro da conta de recebimento dentro do site (componente account-onboarding). Ao sair,
 * `aoSair` atualiza a situação da conta pelo servidor.
 */
export function CadastroStripeEmbutido({ organizacaoId, aoSair }: { organizacaoId: string; aoSair: () => void }) {
  const { instancia, erro, carregando } = useInstanciaStripe(organizacaoId, true);
  return (
    <div className="mt-3 rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">
        Preencha os dados da organização e a conta bancária. O Stripe pode abrir uma janela para confirmar seu e-mail ou celular.
      </p>
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
      {carregando && <p className="mt-2 text-sm text-muted-foreground">Carregando o cadastro do Stripe...</p>}
      {instancia && <ElementoStripe instancia={instancia} componente="account-onboarding" aoSair={aoSair} className="mt-3 min-h-24" />}
    </div>
  );
}

export function PaineisStripe({ organizacaoId }: { organizacaoId: string }) {
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<Aba>("payouts");
  const { instancia, erro, carregando } = useInstanciaStripe(organizacaoId, aberto);

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-medium"><LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />Painéis do Stripe</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Saques, pagamentos e dados da conta (inclusive a conta bancária), sem sair do site. Em alguns casos o Stripe
            pede para confirmar seu e-mail ou celular numa janela própria. Reembolsos são feitos pelo cancelamento da inscrição.
          </p>
        </div>
        {!aberto && (
          <Button type="button" variant="outline" className="w-full shrink-0 sm:w-auto" onClick={() => setAberto(true)}>Abrir painéis</Button>
        )}
      </div>
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
      {aberto && !erro && (
        <>
          <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
            <TabsList aria-label="Painéis do Stripe" className="mt-3 gap-1 overflow-x-auto">
              {ABAS.map((a) => (
                <TabsTrigger key={a.id} value={a.id} asChild>
                  <Button type="button" variant={aba === a.id ? "default" : "ghost"}>
                    {a.rotulo}
                  </Button>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {carregando && <p className="mt-2 text-sm text-muted-foreground">Carregando o Stripe...</p>}
          {instancia && <ElementoStripe instancia={instancia} componente="notification-banner" className="mt-3" />}
          {instancia && (
            <div role="tabpanel">
              <ElementoStripe instancia={instancia} componente={aba} className="mt-3 min-h-24" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
