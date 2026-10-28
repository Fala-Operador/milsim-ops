// Regras puras da lista de usuários do admin: busca, filtros, ordenação e paginação.
import type { Perfil, Usuario } from "@/lib/domain/types";

export type CampoOrdenacaoUsuarios = "nome" | "email" | "perfil" | "status" | "cadastro";
export type DirecaoOrdenacao = "asc" | "desc";

export interface OrdenacaoUsuarios {
  campo: CampoOrdenacaoUsuarios;
  direcao: DirecaoOrdenacao;
}

export interface FiltrosUsuarios {
  busca: string;
  perfil: "" | Perfil;
  status: "" | "ativo" | "inativo" | "autorizacao_pendente";
}

export const FILTROS_USUARIOS_VAZIOS: FiltrosUsuarios = { busca: "", perfil: "", status: "" };

/** Mais recentes primeiro: é o que o admin procura ao abrir a lista. */
export const ORDENACAO_USUARIOS_PADRAO: OrdenacaoUsuarios = { campo: "cadastro", direcao: "desc" };

export const USUARIOS_POR_PAGINA = 20;

export const ROTULO_ORDENACAO_USUARIOS: Record<CampoOrdenacaoUsuarios, string> = {
  nome: "Nome",
  email: "E-mail",
  perfil: "Perfil",
  status: "Status",
  cadastro: "Cadastro",
};

/** Minúsculas e sem acentos, para "joao" achar "João". */
const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Busca por nome, nome de exibição, e-mail ou CPF (com ou sem pontuação). O CPF só é comparado
 * quando o termo tem dígitos, para "ana" não casar com qualquer CPF.
 */
export function filtrarUsuarios(usuarios: Usuario[], filtros: FiltrosUsuarios): Usuario[] {
  const termo = normalizar(filtros.busca.trim());
  const digitos = filtros.busca.replace(/\D/g, "");
  return usuarios.filter((u) => {
    if (filtros.perfil && u.perfil !== filtros.perfil) return false;
    if (filtros.status === "ativo" && !u.ativo) return false;
    if (filtros.status === "inativo" && u.ativo) return false;
    if (filtros.status === "autorizacao_pendente" && u.autorizacaoResponsavel !== "pendente") return false;
    if (!termo) return true;
    return (
      normalizar(u.nomeCompleto).includes(termo) ||
      normalizar(u.nomeExibicao ?? "").includes(termo) ||
      u.email.toLowerCase().includes(termo) ||
      (digitos.length > 0 && u.cpf.includes(digitos))
    );
  });
}

const comparador = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

function chave(u: Usuario, campo: CampoOrdenacaoUsuarios): string {
  switch (campo) {
    case "nome": return u.nomeCompleto;
    case "email": return u.email;
    case "perfil": return u.perfil;
    case "status": return u.ativo ? "0" : "1";
    case "cadastro": return u.criadoEm;
  }
}

/** Ordena sem alterar a lista original; empates caem no nome, para a ordem ficar estável. */
export function ordenarUsuarios(usuarios: Usuario[], { campo, direcao }: OrdenacaoUsuarios): Usuario[] {
  const sinal = direcao === "asc" ? 1 : -1;
  return [...usuarios].sort(
    (a, b) => sinal * comparador.compare(chave(a, campo), chave(b, campo)) || comparador.compare(a.nomeCompleto, b.nomeCompleto),
  );
}

/** Clicar no mesmo campo inverte a direção; outro campo começa crescente (cadastro: mais recente). */
export function alternarOrdenacao(atual: OrdenacaoUsuarios, campo: CampoOrdenacaoUsuarios): OrdenacaoUsuarios {
  if (atual.campo === campo) return { campo, direcao: atual.direcao === "asc" ? "desc" : "asc" };
  return { campo, direcao: campo === "cadastro" ? "desc" : "asc" };
}

/** Recorte da página pedida; página fora do intervalo cai na mais próxima. */
export function paginar<T>(itens: T[], pagina: number, porPagina = USUARIOS_POR_PAGINA) {
  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const atual = Math.min(Math.max(1, Math.floor(pagina) || 1), totalPaginas);
  const inicio = (atual - 1) * porPagina;
  return { itens: itens.slice(inicio, inicio + porPagina), pagina: atual, totalPaginas, inicio, fim: Math.min(inicio + porPagina, itens.length) };
}
