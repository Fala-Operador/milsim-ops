// Regras puras de tema e de localização da página inicial (sem acesso ao navegador).
import type { Abrangencia, Evento } from "@/lib/domain/types";
import { abrangenciaDoEvento, areasSobrepostas, NACIONAL } from "@/lib/divulgacao";

export type Tema = "dark" | "light";

/** Visitantes sempre veem o escuro; contas usam a preferência salva (padrão escuro). */
export function temaEfetivo(autenticado: boolean, preferenciaConta: Tema | undefined): Tema {
  if (!autenticado) return "dark";
  return preferenciaConta === "light" ? "light" : "dark";
}

/** atual = obtida pelo aparelho; manual = escolhida pela pessoa; nacional = sem filtro. */
export type ModoLocal = "nacional" | "atual" | "manual";

export interface LocalSalvo {
  modo: ModoLocal;
  local: Abrangencia; // apenas cidade/UF — nunca coordenadas
}

export const LOCAL_PADRAO: LocalSalvo = { modo: "nacional", local: NACIONAL };

/** Uma nova leitura do aparelho só substitui o local quando não há escolha manual ativa. */
export function aplicarLeituraDoAparelho(atual: LocalSalvo, lido: Abrangencia, explicito: boolean): LocalSalvo {
  if (atual.modo === "manual" && !explicito) return atual;
  return { modo: "atual", local: lido };
}

export interface Localidade { cidade: string; uf: string }

export function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Busca por cidade ou UF (sem acento, sem diferenciar maiúsculas). */
export function buscarLocalidades(lista: Localidade[], termo: string, max = 8): Localidade[] {
  const q = normalizar(termo);
  if (!q) return lista.slice(0, max);
  const porUf = q.length === 2 ? lista.filter((l) => l.uf.toLowerCase() === q) : [];
  // Termo que é exatamente uma UF filtra o estado inteiro; nomes de cidade não entram.
  if (porUf.length > 0) return porUf.slice(0, max);
  const porNome = lista
    .filter((l) => normalizar(l.cidade).includes(q) || normalizar(`${l.cidade} ${l.uf}`).includes(q))
    .sort((a, b) => Number(!normalizar(a.cidade).startsWith(q)) - Number(!normalizar(b.cidade).startsWith(q)));
  const vistos = new Set<string>();
  return [...porUf, ...porNome].filter((l) => {
    const k = `${l.cidade}/${l.uf}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  }).slice(0, max);
}

/** Usa a grafia conhecida quando o nome vindo do aparelho coincide (ignora acentos). */
export function casarLocalidade(lista: Localidade[], cidade: string, uf: string): Localidade {
  const achado = lista.find((l) => l.uf === uf && normalizar(l.cidade) === normalizar(cidade));
  return achado ?? { cidade, uf };
}

export type Periodo = "" | "30d" | "90d";

export interface FiltroDescoberta { busca: string; periodo: Periodo }

/** Filtra eventos pelo local aplicado, texto (operação ou organização) e período. Nunca amplia o local. */
export function filtrarEventos(
  eventos: Evento[], local: Abrangencia, filtro: FiltroDescoberta, organizacaoDe: (id: string) => string, agora: Date,
): Evento[] {
  const q = normalizar(filtro.busca);
  return eventos
    .filter((e) => areasSobrepostas(abrangenciaDoEvento(e), local))
    .filter((e) => !q || normalizar(e.nome).includes(q) || normalizar(organizacaoDe(e.organizacaoId)).includes(q))
    .filter((e) => {
      if (!filtro.periodo) return true;
      const dias = filtro.periodo === "30d" ? 30 : 90;
      return new Date(e.inicioEm).getTime() - agora.getTime() <= dias * 86400000;
    })
    .sort((a, b) => a.inicioEm.localeCompare(b.inicioEm));
}

/** Rótulo curto do local para botões: "São Paulo (SP)", "Campinas, SP" ou "Todo o Brasil". */
export function rotuloCurto(a: Abrangencia): string {
  if (a.escopo === "cidade" && a.cidade) return `${a.cidade}, ${a.uf}`;
  if (a.escopo === "estado" && a.uf) return NOMES_UF[a.uf] ? `${NOMES_UF[a.uf]} (${a.uf})` : `Estado de ${a.uf}`;
  if (a.escopo === "regiao" && a.regiao) return `Região ${a.regiao}`;
  return "Todo o Brasil";
}

export const NOMES_UF: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

export interface Estado { uf: string; nome: string }

/** Os 27 estados (com DF), em ordem alfabética do nome. */
export const ESTADOS: Estado[] = Object.entries(NOMES_UF)
  .map(([uf, nome]) => ({ uf, nome }))
  .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

/** Busca por nome do estado ou UF (sem acento, sem diferenciar maiúsculas). UF exata vem primeiro. */
export function buscarEstados(termo: string): Estado[] {
  const q = normalizar(termo);
  if (!q) return ESTADOS;
  const exata = ESTADOS.filter((e) => e.uf.toLowerCase() === q);
  const porNome = ESTADOS
    .filter((e) => !exata.includes(e) && normalizar(e.nome).includes(q))
    .sort((a, b) => Number(!normalizar(a.nome).startsWith(q)) - Number(!normalizar(b.nome).startsWith(q)));
  return [...exata, ...porNome];
}

/** A descoberta filtra por estado: um local salvo por cidade (versões antigas) vira o estado dela. */
export function paraEstado(a: Abrangencia): Abrangencia {
  return a.escopo === "cidade" && a.uf ? { escopo: "estado", uf: a.uf } : a;
}

/** Principais cidades para a busca manual (somadas às cidades dos eventos). */
export const CIDADES_BASE: Localidade[] = [
  ["São Paulo", "SP"], ["Campinas", "SP"], ["Santos", "SP"], ["Sorocaba", "SP"], ["Ribeirão Preto", "SP"],
  ["São José dos Campos", "SP"], ["Jundiaí", "SP"], ["Itu", "SP"], ["Mairiporã", "SP"], ["Bauru", "SP"],
  ["Rio de Janeiro", "RJ"], ["Niterói", "RJ"], ["Belo Horizonte", "MG"], ["Uberlândia", "MG"], ["Juiz de Fora", "MG"],
  ["Vitória", "ES"], ["Curitiba", "PR"], ["Londrina", "PR"], ["Maringá", "PR"], ["Florianópolis", "SC"],
  ["Joinville", "SC"], ["Blumenau", "SC"], ["Porto Alegre", "RS"], ["Caxias do Sul", "RS"], ["Brasília", "DF"],
  ["Goiânia", "GO"], ["Campo Grande", "MS"], ["Cuiabá", "MT"], ["Salvador", "BA"], ["Recife", "PE"],
  ["Fortaleza", "CE"], ["Natal", "RN"], ["João Pessoa", "PB"], ["Maceió", "AL"], ["Aracaju", "SE"],
  ["Teresina", "PI"], ["São Luís", "MA"], ["Belém", "PA"], ["Manaus", "AM"], ["Macapá", "AP"],
  ["Boa Vista", "RR"], ["Porto Velho", "RO"], ["Rio Branco", "AC"], ["Palmas", "TO"],
].map(([cidade, uf]) => ({ cidade: cidade!, uf: uf! }));
