// Serviços administrativos da página inicial (exclusivos do administrador), com auditoria.
import { mutarBase, latencia, ErroDominio, gerarId } from "./db";
import type { BaseDados, Parceiro, SecaoInicial, StatusSecao, Usuario } from "@/lib/domain/types";
import { hrefDoLink, rotuloDoLink, validarUrlExterna } from "@/lib/divulgacao";

function exigirAdmin(u: Usuario | null) {
  if (!u || u.perfil !== "admin") throw new ErroDominio("permissao", "Somente administradores gerenciam a página inicial.");
}

function auditar(b: BaseDados, autorId: string, acao: string, entidade: string, entidadeId: string, justificativa?: string) {
  b.auditoria.push({ id: gerarId("aud"), autorId, acao, entidade, entidadeId, justificativa, criadoEm: new Date().toISOString() });
}

export type DadosSecao = Omit<SecaoInicial, "id" | "ordem" | "criadoEm" | "atualizadoEm"> & { id?: string };

export function validarSecao(d: DadosSecao): void {
  if (!d.titulo.trim()) throw new ErroDominio("titulo", "Informe o título da seção.");
  if (d.agendamento.inicioEm && d.agendamento.fimEm && d.agendamento.fimEm <= d.agendamento.inicioEm) {
    throw new ErroDominio("agendamento", "O término deve ser depois do início.");
  }
  if (d.tipo === "banner") {
    if (!d.banner?.textoAlt.trim() && d.banner?.imagemDesktop) throw new ErroDominio("banner", "Informe o texto alternativo da imagem.");
    if (d.banner?.destino?.tipo === "externo" && !validarUrlExterna(d.banner.destino.valor)) {
      throw new ErroDominio("banner", "Link externo inválido: use um endereço http ou https.");
    }
  }
  if (d.modo === "automatico" && d.automatica && d.automatica.maximo < 1) {
    throw new ErroDominio("automatica", "Quantidade máxima deve ser pelo menos 1.");
  }
}

export async function salvarSecao(admin: Usuario | null, d: DadosSecao): Promise<SecaoInicial> {
  exigirAdmin(admin);
  validarSecao(d);
  await latencia(150);
  return mutarBase((b) => {
    const agora = new Date().toISOString();
    const existente = d.id ? b.secoesInicio.find((s) => s.id === d.id) : undefined;
    if (existente) {
      const antes = new Set(existente.destaques.map((x) => x.eventoId));
      const depois = new Set(d.destaques.map((x) => x.eventoId));
      Object.assign(existente, { ...d, id: existente.id, atualizadoEm: agora });
      auditar(b, admin!.id, "secao_editada", "secao_inicio", existente.id, existente.titulo);
      depois.forEach((id) => !antes.has(id) && auditar(b, admin!.id, "destaque_incluido", "evento", id, existente.titulo));
      antes.forEach((id) => !depois.has(id) && auditar(b, admin!.id, "destaque_removido", "evento", id, existente.titulo));
      return existente;
    }
    const ordem = Math.max(0, ...b.secoesInicio.map((s) => s.ordem)) + 1;
    const nova: SecaoInicial = { ...d, id: gerarId("sec"), ordem, criadoEm: agora, atualizadoEm: agora };
    b.secoesInicio.push(nova);
    auditar(b, admin!.id, "secao_criada", "secao_inicio", nova.id, nova.titulo);
    nova.destaques.forEach((x) => auditar(b, admin!.id, "destaque_incluido", "evento", x.eventoId, nova.titulo));
    return nova;
  });
}

export async function alterarStatusSecao(admin: Usuario | null, id: string, status: StatusSecao) {
  exigirAdmin(admin);
  await latencia(100);
  mutarBase((b) => {
    const s = b.secoesInicio.find((x) => x.id === id);
    if (!s) throw new ErroDominio("secao", "Seção não encontrada.");
    s.status = status;
    s.atualizadoEm = new Date().toISOString();
    auditar(b, admin!.id, `secao_${status}`, "secao_inicio", id, s.titulo);
  });
}

/** Exclui só a seção: eventos e parceiros referenciados continuam cadastrados. */
export async function excluirSecao(admin: Usuario | null, id: string) {
  exigirAdmin(admin);
  await latencia(100);
  mutarBase((b) => {
    const s = b.secoesInicio.find((x) => x.id === id);
    b.secoesInicio = b.secoesInicio.filter((x) => x.id !== id);
    auditar(b, admin!.id, "secao_excluida", "secao_inicio", id, s?.titulo);
  });
}

export function reordenarSecoes(admin: Usuario | null, idsNaOrdem: string[]) {
  exigirAdmin(admin);
  mutarBase((b) => {
    idsNaOrdem.forEach((id, i) => {
      const s = b.secoesInicio.find((x) => x.id === id);
      if (s) s.ordem = i + 1;
    });
    auditar(b, admin!.id, "secoes_reordenadas", "secao_inicio", "ordem", idsNaOrdem.join(", "));
  });
}

export type DadosParceiro = Omit<Parceiro, "id" | "criadoEm" | "atualizadoEm"> & { id?: string };

export function validarParceiro(d: DadosParceiro): void {
  if (!d.nome.trim()) throw new ErroDominio("nome", "Informe o nome do parceiro.");
  if (d.logoUrl && !d.textoAlt.trim()) throw new ErroDominio("textoAlt", "Informe o texto alternativo do logo.");
  for (const l of d.links) {
    if (l.tipo === "outro" && !l.rotulo?.trim()) throw new ErroDominio("links", "Informe o rótulo do link personalizado.");
    if (!hrefDoLink(l)) {
      throw new ErroDominio(
        "links",
        l.tipo === "whatsapp"
          ? "WhatsApp inválido: informe o telefone com código do país (ex.: +55 11 99999-0000)."
          : `Link "${rotuloDoLink(l)}" inválido: use um endereço http ou https.`,
      );
    }
  }
}

export async function salvarParceiro(admin: Usuario | null, d: DadosParceiro): Promise<Parceiro> {
  exigirAdmin(admin);
  validarParceiro(d);
  await latencia(150);
  return mutarBase((b) => {
    const agora = new Date().toISOString();
    const existente = d.id ? b.parceiros.find((p) => p.id === d.id) : undefined;
    if (existente) {
      Object.assign(existente, { ...d, id: existente.id, atualizadoEm: agora });
      auditar(b, admin!.id, "parceiro_editado", "parceiro", existente.id, `${existente.nome} (${existente.links.length} links)`);
      return existente;
    }
    const novo: Parceiro = { ...d, id: gerarId("par"), criadoEm: agora, atualizadoEm: agora };
    b.parceiros.push(novo);
    auditar(b, admin!.id, "parceiro_criado", "parceiro", novo.id, novo.nome);
    return novo;
  });
}

export async function excluirParceiro(admin: Usuario | null, id: string) {
  exigirAdmin(admin);
  await latencia(100);
  mutarBase((b) => {
    const p = b.parceiros.find((x) => x.id === id);
    b.parceiros = b.parceiros.filter((x) => x.id !== id);
    b.secoesInicio.forEach((s) => (s.parceiros = s.parceiros.filter((i) => i.parceiroId !== id)));
    auditar(b, admin!.id, "parceiro_excluido", "parceiro", id, p?.nome);
  });
}
