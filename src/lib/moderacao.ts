import { tr } from "@/i18n/lib/moderacao";
// Moderação de conteúdo da comunidade geral: ponto ÚNICO de decisão antes de publicar.
// Hoje: lista de termos (instantânea, sem custo). Conteúdo adulto — sexo, drogas e morte/violência
// real — é recusado. Amanhã: um classificador (IA de texto e imagem) entra aqui, atrás da mesma
// assinatura, sem mudar quem chama. Fotos ainda não são analisadas: dependem de denúncia.
//
// Cuidado com o contexto do airsoft: "morri", "fui eliminado", "baixa", "tiro", "sniper",
// "granada", "missão suicida" e nomes de operação como "Vale da Morte" são jargão do jogo e NÃO
// são bloqueados. Também ficam fora palavras comuns com outro sentido ("vai rolar", "pelada").

export type CategoriaBloqueio = "sexo" | "drogas" | "violencia";

export type ResultadoModeracao =
  | { aprovado: true }
  | { aprovado: false; categoria: CategoriaBloqueio; motivo: string };

const MOTIVO: Record<CategoriaBloqueio, string> = {
  get sexo() { return tr("conteudo_sexual_nao_e_permitido_na"); },
  get drogas() { return tr("conteudo_sobre_drogas_ilicitas_nao_e"); },
  get violencia() { return tr("conteudo_de_morte_ou_violencia_real"); },
};

// Termos já normalizados (minúsculas, sem acento). Raízes casam o começo de palavra:
// "estupr" pega "estupro" e "estuprada". Palavras inteiras ficam entre \b nas duas pontas.
const RAIZES: Record<CategoriaBloqueio, string[]> = {
  sexo: [
    "porn", "putaria", "putinha", "xvideo", "xxx", "onlyfans", "privacy\\.com", "nudes?\\b",
    "sexo\\b", "sexual", "transar", "trepar", "foder", "fodend", "punheta", "boquete", "siririca", "buceta", "piroca",
    "orgasm", "orgia", "estupr", "pedofil", "camgirl", "acompanhante de luxo",
  ],
  drogas: [
    "cocaina", "crack\\b", "maconha", "\\bthc\\b", "skunk", "haxixe", "lsd\\b", "ecstasy", "mdma", "metanfetamina",
    "heroina", "lanca[- ]perfume", "ketamina", "cheirar po\\b", "vendo droga", "boca de fumo", "biqueira", "traficante",
  ],
  violencia: [
    "decapit", "esquartej", "degol", "cadaver", "se matar\\b", "me matar\\b", "vou te matar", "assassinat",
    "chacina", "corpo esfaqueado", "sangue real", "gore\\b", "execucao real", "mutilad",
  ],
};

/** Minúsculas, sem acento, sem trocas óbvias de letra por número (p0rn, c0caina). */
export function normalizarParaModeracao(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/@/g, "a")
    .replace(/\s+/g, " ");
}

const PADROES: [CategoriaBloqueio, RegExp][] = (Object.keys(RAIZES) as CategoriaBloqueio[]).map((c) => [
  c,
  new RegExp(`(^|[^a-z])(${RAIZES[c].join("|")})`, "i"),
]);

/** Decide se o texto pode ser publicado. Vazio é aprovado (post só com foto). */
export function moderarTexto(texto: string): ResultadoModeracao {
  const t = normalizarParaModeracao(texto);
  for (const [categoria, re] of PADROES) {
    if (re.test(t)) return { aprovado: false, categoria, motivo: MOTIVO[categoria] };
  }
  return { aprovado: true };
}
