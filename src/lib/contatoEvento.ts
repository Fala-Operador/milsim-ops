// Regras puras do contato do evento no WhatsApp:
//  - número do organizador: público (botão "Falar no WhatsApp" na página do evento);
//  - link do grupo: só para inscritos confirmados e para quem gere o evento — a visão
//    (src/lib/visao.ts) remove o link dos demais, então ele nem chega ao navegador.
// Só aceita convites de grupo (chat.whatsapp.com): o campo não serve para links arbitrários.
import type { BaseDados, Evento, Usuario } from "@/lib/domain/types";
import { linkWhatsapp } from "@/lib/divulgacao";
import { tr } from "@/i18n/lib/contatoEvento";

const GRUPO = /^(?:https?:\/\/)?chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{10,40})\/?(?:[?#].*)?$/i;

/** Convite do grupo normalizado (https://chat.whatsapp.com/<código>) ou null se inválido. */
export function normalizarGrupoWhatsapp(entrada: string | undefined): string | null {
  const m = GRUPO.exec((entrada ?? "").trim());
  return m ? `https://chat.whatsapp.com/${m[1]}` : null;
}

/** Número em dígitos com código do país; número brasileiro sem DDI ganha o 55. */
export function normalizarContatoWhatsapp(entrada: string | undefined): string | null {
  let d = (entrada ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.startsWith("55") && d.length !== 12 && d.length !== 13) return null;
  return d.length >= 12 && d.length <= 15 ? d : null;
}

/** "(11) 99999-9999" para números do Brasil; "+DDI ..." para os demais. */
export function formatarContatoWhatsapp(digitos: string): string {
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    const ddd = digitos.slice(2, 4);
    const n = digitos.slice(4);
    return `(${ddd}) ${n.slice(0, n.length - 4)}-${n.slice(-4)}`;
  }
  return `+${digitos}`;
}

/** Link wa.me do organizador com mensagem inicial que identifica o evento. */
export function linkContatoEvento(evento: Pick<Evento, "whatsappContato" | "nome">): string | null {
  if (!evento.whatsappContato) return null;
  return linkWhatsapp(evento.whatsappContato, tr("ola_tenho_uma_duvida_sobre_nome", { nome: evento.nome }));
}

/** Erros de preenchimento (campo = id do elemento no editor). Campos vazios são opcionais. */
export function errosContatoEvento(ev: Pick<Evento, "whatsappContato" | "whatsappGrupoUrl">): { campo: string; mensagem: string }[] {
  const erros: { campo: string; mensagem: string }[] = [];
  if (ev.whatsappContato?.trim() && !normalizarContatoWhatsapp(ev.whatsappContato)) {
    erros.push({ campo: "ev-whats", mensagem: tr("whatsapp_invalido_informe_ddd_e_numero") });
  }
  if (ev.whatsappGrupoUrl?.trim() && !normalizarGrupoWhatsapp(ev.whatsappGrupoUrl)) {
    erros.push({ campo: "ev-grupo", mensagem: tr("use_o_link_de_convite_do") });
  }
  return erros;
}

/** Normaliza os dois campos para gravar (vazio vira ausente). Valide antes com errosContatoEvento. */
export function contatoParaGravar<T extends Pick<Evento, "whatsappContato" | "whatsappGrupoUrl">>(ev: T): T {
  return {
    ...ev,
    whatsappContato: normalizarContatoWhatsapp(ev.whatsappContato) ?? undefined,
    whatsappGrupoUrl: normalizarGrupoWhatsapp(ev.whatsappGrupoUrl) ?? undefined,
  };
}

/** Quem vê o link do grupo: quem gere o evento ou tem inscrição confirmada nele. */
export function podeVerGrupo(
  base: Pick<BaseDados, "inscricoes">,
  usuario: Pick<Usuario, "id"> | null,
  eventoId: string,
  gere: boolean,
): boolean {
  if (gere) return true;
  if (!usuario) return false;
  return base.inscricoes.some((i) => i.eventoId === eventoId && i.usuarioId === usuario.id && i.status === "confirmada");
}
