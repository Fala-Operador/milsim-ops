// Tempo real no navegador: escuta o sinal de versão que o banco manda por Broadcast a cada
// gravação (gatilho em base_control, supabase/migrations/20261022153000_realtime_todas_as_tabelas.sql)
// e busca a visão de novo pela API. Nenhum dado chega pelo Realtime, só o número da versão:
// o que cada pessoa vê continua decidido no servidor (src/lib/visao.ts).
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { versaoDaVisao } from "@/api/cliente";
import { obterConfigRealtime } from "@/api/sessao.functions";

/** Espera aleatória antes de buscar a visão: espalha as requisições de quem recebeu o mesmo sinal. */
const ESPERA_MIN_MS = 300;
const ESPERA_VARIACAO_MS = 1200;
/** Aba escondida por mais que isso solta a conexão (libera vaga no limite de conexões do Realtime). */
const DESLIGAR_ESCONDIDA_MS = 60_000;

type Ouvinte = (versao: number) => void;
const ouvintes = new Set<Ouvinte>();

/** Avisa a cada versão nova da base vinda de outra pessoa (ex.: o QR Code confere a entrada na hora). */
export function aoMudarBase(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Decide se um sinal pede nova busca: só versões além da que a tela já tem. */
export function sinalPedeAtualizacao(versaoSinal: unknown, versaoAtual: number): versaoSinal is number {
  return typeof versaoSinal === "number" && Number.isFinite(versaoSinal) && versaoSinal > versaoAtual;
}

/**
 * Liga o tempo real; `atualizar` busca a visão mais recente. Devolve a função que desliga.
 * Sem configuração (chave publicável ausente) ou sem rede, o site segue atualizando ao voltar para a aba.
 */
export function iniciarTempoReal(atualizar: () => Promise<void>): () => void {
  let ativo = true;
  let cliente: SupabaseClient | null = null;
  let canal: RealtimeChannel | null = null;
  let jaConectou = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let desligarTimer: ReturnType<typeof setTimeout> | undefined;
  let buscando = false;
  let pendente = false;

  const escondida = () => document.visibilityState === "hidden";

  const buscar = async () => {
    timer = undefined;
    if (!ativo) return;
    if (escondida()) {
      pendente = true;
      return;
    }
    buscando = true;
    pendente = false;
    try {
      await atualizar();
    } finally {
      buscando = false;
    }
    if (pendente) agendar();
  };

  const agendar = () => {
    if (!ativo || timer) return;
    if (buscando) {
      pendente = true;
      return;
    }
    timer = setTimeout(buscar, ESPERA_MIN_MS + Math.random() * ESPERA_VARIACAO_MS);
  };

  const conectar = async () => {
    if (canal || !ativo) return;
    if (!cliente) {
      const config = await obterConfigRealtime().catch(() => null);
      if (!config || !ativo) return;
      const { createClient } = await import("@supabase/supabase-js");
      if (!ativo) return;
      cliente = createClient(config.url, config.chave, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    }
    if (canal || !ativo) return;
    canal = cliente
      .channel("base", { config: { broadcast: { self: false }, private: false } })
      .on("broadcast", { event: "versao" }, ({ payload }) => {
        const versao = (payload as { version?: unknown } | undefined)?.version;
        if (!sinalPedeAtualizacao(versao, versaoDaVisao())) return;
        ouvintes.forEach((o) => o(versao));
        agendar();
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // Reconexão (rede caiu, aba voltou): pode ter perdido sinais no meio.
        if (jaConectou) agendar();
        jaConectou = true;
      });
  };

  const desconectar = () => {
    if (canal && cliente) void cliente.removeChannel(canal);
    canal = null;
  };

  const aoMudarVisibilidade = () => {
    clearTimeout(desligarTimer);
    if (escondida()) {
      desligarTimer = setTimeout(desconectar, DESLIGAR_ESCONDIDA_MS);
      return;
    }
    if (!canal) void conectar();
    if (pendente) agendar();
  };

  void conectar();
  document.addEventListener("visibilitychange", aoMudarVisibilidade);

  return () => {
    ativo = false;
    clearTimeout(timer);
    clearTimeout(desligarTimer);
    document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    desconectar();
  };
}
