// Cifra dos dados pessoais gravados no banco (colunas em COLUNAS_CIFRADAS, src/lib/esquemaBanco.ts).
//
//  - AES-256-GCM (cifra autenticada): nonce aleatório de 96 bits por valor; o texto cifrado
//    fica preso à tabela, à coluna e à chave primária da linha (dados associados), então um
//    valor copiado para outra linha ou coluna não decifra.
//  - Formato gravado: "cifra:v1:<id da chave>:<base64url(nonce ‖ cifrado ‖ tag)>".
//  - Chave mestra: PERSONAL_DATA_ENCRYPTION_KEY (32 bytes em base64, só no ambiente do servidor).
//    Dela saem, por HKDF-SHA256, a chave da cifra, a chave dos índices cegos e o id da chave.
//  - Rotação: a chave nova vai em PERSONAL_DATA_ENCRYPTION_KEY e as antigas em
//    PERSONAL_DATA_ENCRYPTION_PREVIOUS_KEYS (separadas por vírgula). Valores com chave antiga
//    ou ainda em texto puro (linhas de antes da cifra) entram em `pendentes` e são regravados
//    com a chave atual pelo servidor (src/server/unidade.server.ts).
//  - Índices cegos (INDICES_CEGOS): HMAC-SHA256 do valor, só para unicidade no banco.
// Sem a chave, a base ainda é lida enquanto não houver valor cifrado, mas nada com dado
// pessoal é gravado: perder a chave é perder esses dados (guarde uma cópia fora do servidor).
import { COLUNAS_CIFRADAS, INDICES_CEGOS } from "@/lib/esquemaBanco";
import { TABELAS_BANCO, type Mudancas, type TabelasExportadas } from "@/lib/persistencia";

// Web Crypto (crypto.subtle), e não node:crypto: o mesmo código roda no Node (Dokploy) e no
// runtime Cloudflare da publicação pelo Lovable.
const PREFIXO = "cifra:v1:";
const NONCE = 12;
export const VARIAVEL_CHAVE = "PERSONAL_DATA_ENCRYPTION_KEY";
export const VARIAVEL_CHAVES_ANTIGAS = "PERSONAL_DATA_ENCRYPTION_PREVIOUS_KEYS";

type Linha = Record<string, unknown>;

interface Chave { id: string; cifra: CryptoKey; indice: CryptoKey }

export interface Chaveiro {
  /** Chave usada para cifrar (null = não configurada: só leitura de texto puro). */
  atual: Chave | null;
  /** Todas as chaves aceitas para decifrar, por id. */
  porId: ReadonlyMap<string, Chave>;
}

/** Linhas que precisam ser regravadas com a chave atual: tabela → chaves primárias. */
export type Pendentes = Record<string, string[]>;

const utf8 = new TextEncoder();
const deUtf8 = new TextDecoder("utf-8", { fatal: true });

function deBase64(texto: string): Uint8Array<ArrayBuffer> {
  const b = atob(texto.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
function paraBase64Url(bytes: Uint8Array): string {
  let b = "";
  for (const x of bytes) b += String.fromCharCode(x);
  return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function derivar(mestra: Uint8Array<ArrayBuffer>): Promise<Chave> {
  const base = await crypto.subtle.importKey("raw", mestra, "HKDF", false, ["deriveBits"]);
  const bits = (info: string) =>
    crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: utf8.encode("milsim-ops"), info: utf8.encode(info) }, base, 256);
  const [id, cifra, indice] = await Promise.all([bits("id"), bits("aes-256-gcm"), bits("indice-cego")]);
  return {
    id: hex(id).slice(0, 8),
    cifra: await crypto.subtle.importKey("raw", cifra, "AES-GCM", false, ["encrypt", "decrypt"]),
    indice: await crypto.subtle.importKey("raw", indice, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
  };
}

function lerChave(texto: string, nome: string): Promise<Chave> {
  let bytes: Uint8Array<ArrayBuffer> | null = null;
  try { bytes = deBase64(texto.trim()); } catch { /* inválida: cai no erro abaixo */ }
  if (bytes?.length !== 32) {
    throw new Error(`${nome} precisa ter 32 bytes em base64 (gere com: openssl rand -base64 32).`);
  }
  return derivar(bytes);
}

/** Chaveiro a partir dos textos das variáveis (base64). */
export async function criarChaveiro(atual: string | undefined, antigas: string | undefined = undefined): Promise<Chaveiro> {
  const chave = atual?.trim() ? await lerChave(atual, VARIAVEL_CHAVE) : null;
  const porId = new Map<string, Chave>();
  for (const t of (antigas ?? "").split(",").filter((t) => t.trim())) {
    const c = await lerChave(t, VARIAVEL_CHAVES_ANTIGAS);
    porId.set(c.id, c);
  }
  if (chave) porId.set(chave.id, chave);
  return { atual: chave, porId };
}

let doAmbiente: Promise<Chaveiro> | null = null;
/** Chaveiro das variáveis de ambiente do servidor (lido uma vez por instância). */
export function chaveiroDoAmbiente(): Promise<Chaveiro> {
  doAmbiente ??= criarChaveiro(process.env[VARIAVEL_CHAVE], process.env[VARIAVEL_CHAVES_ANTIGAS]).catch((e: unknown) => {
    doAmbiente = null;
    throw e;
  });
  return doAmbiente;
}

export const ehCifrado = (v: unknown): v is string => typeof v === "string" && v.startsWith(PREFIXO);

const contexto = (tabela: string, coluna: string, chavePrimaria: string) =>
  utf8.encode(`${tabela}.${coluna}\u0000${chavePrimaria}`);

export async function cifrarValor(chave: Chave, texto: string, tabela: string, coluna: string, chavePrimaria: string): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE));
  const cifrado = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: contexto(tabela, coluna, chavePrimaria), tagLength: 128 },
    chave.cifra, utf8.encode(texto),
  );
  const corpo = new Uint8Array(NONCE + cifrado.byteLength);
  corpo.set(nonce);
  corpo.set(new Uint8Array(cifrado), NONCE);
  return `${PREFIXO}${chave.id}:${paraBase64Url(corpo)}`;
}

/** Decifra um valor gravado; devolve também o id da chave usada. */
export async function decifrarValor(
  chaveiro: Chaveiro, valor: string, tabela: string, coluna: string, chavePrimaria: string,
): Promise<{ texto: string; chaveId: string }> {
  const resto = valor.slice(PREFIXO.length);
  const i = resto.indexOf(":");
  const chaveId = resto.slice(0, i);
  const chave = i > 0 ? chaveiro.porId.get(chaveId) : undefined;
  if (!chave) {
    throw new Error(
      `${tabela}.${coluna} está cifrado com a chave ${chaveId || "?"}, que não está em ${VARIAVEL_CHAVE} ` +
        `nem em ${VARIAVEL_CHAVES_ANTIGAS}.`,
    );
  }
  try {
    const corpo = deBase64(resto.slice(i + 1));
    const texto = deUtf8.decode(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: corpo.subarray(0, NONCE), additionalData: contexto(tabela, coluna, chavePrimaria), tagLength: 128 },
      chave.cifra, corpo.subarray(NONCE),
    ));
    return { texto, chaveId };
  } catch {
    throw new Error(`${tabela}.${coluna} não pôde ser decifrado (valor adulterado ou de outra linha).`);
  }
}

export const indiceCego = async (chave: Chave, texto: string) => hex(await crypto.subtle.sign("HMAC", chave.indice, utf8.encode(texto)));

function chavePrimariaDe(tabela: string, linha: Linha): string {
  const def = TABELAS_BANCO.get(tabela);
  if (!def) throw new Error(`Tabela cifrada desconhecida: ${tabela}`);
  return def.colunasChave.map((c) => String(linha[c])).join("\u0000");
}

/**
 * Linhas exportadas pelo banco → linhas em texto puro (cópia), mais as linhas que precisam ser
 * regravadas: valor em texto puro, cifrado com chave antiga ou índice cego ausente.
 */
export async function decifrarTabelas(
  tabelas: TabelasExportadas, chaveiro: Chaveiro,
): Promise<{ tabelas: TabelasExportadas; pendentes: Pendentes }> {
  const saida: TabelasExportadas = { ...tabelas };
  const pendentes: Pendentes = {};
  for (const [tabela, colunas] of Object.entries(COLUNAS_CIFRADAS)) {
    const linhas = tabelas[tabela];
    if (!linhas?.length) continue;
    const indices = INDICES_CEGOS[tabela] ?? {};
    saida[tabela] = await Promise.all(linhas.map(async (original) => {
      const linha = { ...original };
      const pk = chavePrimariaDe(tabela, linha);
      let regravar = false;
      for (const coluna of colunas) {
        const v = linha[coluna];
        if (v === null || v === undefined) continue;
        if (ehCifrado(v)) {
          const { texto, chaveId } = await decifrarValor(chaveiro, v, tabela, coluna, pk);
          linha[coluna] = texto;
          if (chaveId !== chaveiro.atual?.id) regravar = true;
        } else {
          regravar = true;
        }
        const colunaIndice = indices[coluna];
        if (colunaIndice && (linha[colunaIndice] === null || linha[colunaIndice] === undefined)) regravar = true;
      }
      for (const colunaIndice of Object.values(indices)) delete linha[colunaIndice];
      if (regravar) (pendentes[tabela] ??= []).push(pk);
      return linha;
    }));
  }
  return { tabelas: saida, pendentes };
}

export const totalPendentes = (p: Pendentes) => Object.values(p).reduce((n, l) => n + l.length, 0);

/** Acrescenta ao lote as linhas pendentes que ele ainda não grava nem exclui (texto puro de `linhas`). */
export function incluirPendentes(lote: Mudancas, pendentes: Pendentes, linhas: TabelasExportadas): Mudancas {
  const saida: Mudancas = { ...lote };
  for (const [tabela, pks] of Object.entries(pendentes)) {
    const tocadas = new Set([...(lote[tabela]?.gravar ?? []), ...(lote[tabela]?.excluir ?? [])].map((l) => chavePrimariaDe(tabela, l)));
    const faltam = new Set(pks.filter((pk) => !tocadas.has(pk)));
    const novas = (linhas[tabela] ?? []).filter((l) => faltam.has(chavePrimariaDe(tabela, l)));
    if (!novas.length) continue;
    saida[tabela] = { gravar: [...(lote[tabela]?.gravar ?? []), ...novas], excluir: lote[tabela]?.excluir ?? [] };
  }
  return saida;
}

/** Lote em texto puro → lote com os dados pessoais cifrados e os índices cegos preenchidos. */
export async function cifrarLote(lote: Mudancas, chaveiro: Chaveiro): Promise<Mudancas> {
  const saida: Mudancas = { ...lote };
  for (const [tabela, colunas] of Object.entries(COLUNAS_CIFRADAS)) {
    const m = lote[tabela];
    if (!m?.gravar.length) continue;
    const chave = chaveiro.atual;
    if (!chave) {
      throw new Error(`${VARIAVEL_CHAVE} não configurada: dados pessoais (${tabela}) não podem ser gravados.`);
    }
    const indices = INDICES_CEGOS[tabela] ?? {};
    saida[tabela] = {
      excluir: m.excluir,
      gravar: await Promise.all(m.gravar.map(async (original) => {
        const linha = { ...original };
        const pk = chavePrimariaDe(tabela, linha);
        for (const coluna of colunas) {
          const v = linha[coluna];
          const colunaIndice = indices[coluna];
          if (colunaIndice) linha[colunaIndice] = typeof v === "string" ? await indiceCego(chave, v) : null;
          if (v === null || v === undefined) continue;
          if (typeof v !== "string") throw new Error(`${tabela}.${coluna}: só texto pode ser cifrado.`);
          linha[coluna] = await cifrarValor(chave, v, tabela, coluna, pk);
        }
        return linha;
      })),
    };
  }
  return saida;
}
