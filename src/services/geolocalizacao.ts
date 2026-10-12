// Localização real do aparelho (com autorização do navegador) e conversão em cidade/UF.
// Provedor externo: BigDataCloud "reverse-geocode-client" (gratuito, sem chave, feito para uso no navegador).
// Dados enviados: somente latitude/longitude arredondadas a 2 casas (~1 km) e o idioma "pt".
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
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}&localityLanguage=pt`;
  let dados: { city?: string; locality?: string; principalSubdivisionCode?: string; countryCode?: string };
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    dados = await r.json();
  } catch {
    throw new ErroLocalizacao("cidade_nao_resolvida");
  }
  const cidade = (dados.city || dados.locality || "").trim();
  const uf = (dados.principalSubdivisionCode ?? "").replace(/^BR-/, "");
  if (dados.countryCode !== "BR" || !cidade || uf.length !== 2) throw new ErroLocalizacao("cidade_nao_resolvida");
  return casarLocalidade(CIDADES_BASE, cidade, uf);
}

export async function detectarCidade(): Promise<Localidade> {
  const { lat, lng } = await obterCoordenadas();
  return coordenadasParaCidade(lat, lng);
}
