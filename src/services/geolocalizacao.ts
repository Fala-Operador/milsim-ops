// Localização real do aparelho (com autorização do navegador) e conversão em cidade/UF.
// Provedor externo: OpenStreetMap Nominatim (gratuito, sem chave; limite de 1 consulta/s, uso leve).
// Dados enviados: somente latitude/longitude arredondadas a 2 casas (~1 km) e o idioma "pt-BR".
// Para produção, trocar por um provedor contratado ou instância própria.
// Coordenadas nunca são salvas, exibidas ou enviadas para métricas.
import { CIDADES_BASE, casarLocalidade, type Localidade } from "@/lib/localizacao";

export type EstadoPermissao = "concedida" | "negada" | "perguntar" | "desconhecida";
export type FalhaLocal = "negada" | "indisponivel" | "tempo" | "sem_suporte" | "cidade_nao_resolvida";

export class ErroLocalizacao extends Error {
  constructor(public motivo: FalhaLocal) { super(motivo); }
}

export async function consultarPermissao(): Promise<EstadoPermissao> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return "desconhecida";
  try {
    const r = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (!r) return "desconhecida";
    return r.state === "granted" ? "concedida" : r.state === "denied" ? "negada" : "perguntar";
  } catch {
    return "desconhecida";
  }
}

/** Leitura única (sem acompanhamento contínuo). */
export function obterCoordenadas(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return reject(new ErroLocalizacao("sem_suporte"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new ErroLocalizacao(e.code === 1 ? "negada" : e.code === 3 ? "tempo" : "indisponivel")),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60000 },
    );
  });
}

export async function coordenadasParaCidade(lat: number, lng: number): Promise<Localidade> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=pt-BR&lat=${lat.toFixed(2)}&lon=${lng.toFixed(2)}`;
  let dados: { address?: { city?: string; town?: string; municipality?: string; village?: string; country_code?: string; "ISO3166-2-lvl4"?: string } };
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(String(r.status));
    dados = await r.json();
  } catch {
    throw new ErroLocalizacao("cidade_nao_resolvida");
  }
  const a = dados.address ?? {};
  const cidade = (a.city || a.town || a.municipality || a.village || "").trim();
  const uf = (a["ISO3166-2-lvl4"] ?? "").replace(/^BR-/, "");
  if (a.country_code !== "br" || !cidade || uf.length !== 2) throw new ErroLocalizacao("cidade_nao_resolvida");
  return casarLocalidade(CIDADES_BASE, cidade, uf);
}

export async function detectarCidade(): Promise<Localidade> {
  const { lat, lng } = await obterCoordenadas();
  return coordenadasParaCidade(lat, lng);
}

export interface EnderecoCep {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export type FalhaCep = "invalido" | "nao_encontrado" | "indisponivel";

export class ErroCep extends Error {
  constructor(public motivo: FalhaCep) {
    super(motivo === "invalido" ? "CEP inválido." : motivo === "nao_encontrado" ? "CEP não encontrado." : "Não foi possível consultar o CEP agora.");
  }
}

/**
 * Endereço de um CEP pelo ViaCEP (público e gratuito, sem chave). Envia só os 8 dígitos do CEP.
 * Os campos preenchidos continuam editáveis: o CEP é só um atalho.
 */
export async function consultarCep(cep: string, signal?: AbortSignal): Promise<EnderecoCep> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) throw new ErroCep("invalido");
  let resposta: Response;
  try {
    resposta = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: signal ?? null });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ErroCep("indisponivel");
  }
  // ViaCEP responde 400 para formato inválido e {"erro": true} para CEP inexistente.
  if (resposta.status === 400) throw new ErroCep("nao_encontrado");
  if (!resposta.ok) throw new ErroCep("indisponivel");
  const r = (await resposta.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
  if (r.erro) throw new ErroCep("nao_encontrado");
  return { logradouro: r.logradouro ?? "", bairro: r.bairro ?? "", cidade: r.localidade ?? "", uf: r.uf ?? "" };
}
