// API da Central de Suporte. Toda chamada revalida o acesso no servidor.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as sup from "@/services/suporte";
import { ErroDominio } from "@/services/db";
import { contextoSomenteLeitura, exigirUsuario, mutar } from "@/server/unidade.server";
import { gravarAnexo, urlDoAnexo } from "@/server/anexosSuporte.server";
import { podeVer, LIMITE_MENSAGEM, type AcaoStatus } from "@/lib/suporte";
import { chamar } from "@/api/cliente";
import { recarregarVisao } from "@/api/sessao.functions";

const id = z.string().min(1).max(100);
const clienteId = z.string().regex(/^[a-z0-9-]{8,64}$/i);
const anexo = z.object({ nome: z.string().max(200), dataUrl: z.string().max(7_200_000) }).optional();

function erro(e: unknown): never {
  if (e instanceof ErroDominio) throw new Error(e.message);
  console.error(e);
  throw new Error("Não foi possível concluir a operação. Tente novamente.");
}

async function enviarAnexo(chamadoId: string, cid: string, a: z.infer<typeof anexo>, novoChamado: boolean) {
  if (!a) return undefined;
  try {
    const { base, usuario } = await contextoSomenteLeitura();
    const u = exigirUsuario(usuario);
    if (!novoChamado) {
      const c = base.chamados.find((x) => x.id === chamadoId);
      if (!c || !podeVer(base, u, c)) throw new ErroDominio("chamado", "Chamado não encontrado.");
      if (c.status === "fechado") throw new ErroDominio("status", "Chamado fechado: somente leitura.");
    } else {
      const c = base.chamados.find((x) => x.id === chamadoId);
      if (c && c.solicitanteId !== u.id) throw new ErroDominio("cliente", "Identificador inválido.");
    }
    return await gravarAnexo(chamadoId, cid, a.nome, a.dataUrl);
  } catch (e) { erro(e); }
}

export const abrirChamadoSuporteFn = createServerFn({ method: "POST" })
  .validator(z.object({
    clienteId, tipo: z.enum(["evento", "plataforma"]), eventoId: id.optional(), assunto: z.string().max(140),
    categoria: z.string().max(40), descricao: z.string().max(LIMITE_MENSAGEM), vinculadoA: id.optional(), anexo,
  }).parse)
  .handler(async ({ data }) => {
    const meta = await enviarAnexo(sup.idDoChamado(data.clienteId), data.clienteId, data.anexo, true);
    return mutar(({ usuario }) => sup.abrirChamado(exigirUsuario(usuario), { ...data, anexo: meta }));
  });

export const enviarMensagemSuporteFn = createServerFn({ method: "POST" })
  .validator(z.object({ chamadoId: id, clienteId, corpo: z.string().max(LIMITE_MENSAGEM), anexo }).parse)
  .handler(async ({ data }) => {
    const meta = await enviarAnexo(data.chamadoId, data.clienteId, data.anexo, false);
    return mutar(({ usuario }) => sup.enviarMensagem(exigirUsuario(usuario), data.chamadoId, data.clienteId, data.corpo, meta));
  });

export const definirResponsavelFn = createServerFn({ method: "POST" })
  .validator(z.object({ chamadoId: id, responsavelId: id.optional() }).parse)
  .handler(({ data }) => mutar(({ usuario }) => sup.definirResponsavel(exigirUsuario(usuario), data.chamadoId, data.responsavelId)));

export const alterarStatusChamadoFn = createServerFn({ method: "POST" })
  .validator(z.object({ chamadoId: id, acao: z.enum(["aguardar", "resolver", "reabrir", "fechar"]), descricao: z.string().max(500).optional() }).parse)
  .handler(({ data }) => mutar(({ usuario }) => sup.alterarStatus(exigirUsuario(usuario), data.chamadoId, data.acao, data.descricao)));

export const linkAnexoFn = createServerFn({ method: "POST" })
  .validator(z.object({ chamadoId: id, mensagemId: id, baixar: z.boolean() }).parse)
  .handler(async ({ data }) => {
    try {
      const { base, usuario } = await contextoSomenteLeitura();
      const u = exigirUsuario(usuario);
      const c = base.chamados.find((x) => x.id === data.chamadoId);
      if (!c || !podeVer(base, u, c)) throw new ErroDominio("chamado", "Chamado não encontrado.");
      const m = c.mensagens.find((x) => x.id === data.mensagemId);
      if (!m?.anexo) throw new ErroDominio("anexo", "Anexo não encontrado.");
      return await urlDoAnexo(m.anexo, data.baixar);
    } catch (e) { erro(e); }
  });

// ---------- Uso no navegador ----------
export type AnexoEnvio = { nome: string; dataUrl: string };
export const abrirChamadoSuporte = (d: Parameters<typeof abrirChamadoSuporteFn>[0]["data"]) => chamar(abrirChamadoSuporteFn({ data: d }));
export const enviarMensagemSuporte = (chamadoId: string, clienteIdMsg: string, corpo: string, a?: AnexoEnvio) =>
  chamar(enviarMensagemSuporteFn({ data: { chamadoId, clienteId: clienteIdMsg, corpo, anexo: a } }));
export const assumirChamado = (chamadoId: string, responsavelId?: string) => chamar(definirResponsavelFn({ data: { chamadoId, responsavelId } }));
export const alterarStatusChamado = (chamadoId: string, acao: AcaoStatus, descricao?: string) =>
  chamar(alterarStatusChamadoFn({ data: { chamadoId, acao, descricao } }));
export const linkAnexo = (chamadoId: string, mensagemId: string, baixar = false) => linkAnexoFn({ data: { chamadoId, mensagemId, baixar } });
export const atualizarSuporte = () => recarregarVisao();
