// API da Central de Suporte. Toda chamada revalida o acesso no servidor.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as sup from "@/services/suporte";
import { ErroDominio } from "@/services/db";
import { contextoSomenteLeitura, exigirUsuario, mutar, tratarErro } from "@/server/unidade.server";
import { gravarAnexo, urlDoAnexo } from "@/server/anexosSuporte.server";
import { podeVer, podeAbrirAnexo, LIMITE_MENSAGEM, type AcaoStatus } from "@/lib/suporte";
import { chamar } from "@/api/cliente";
import { recarregarVisao } from "@/api/sessao.functions";
import { tr } from "@/i18n/api/suporte.functions";

const id = z.string().min(1).max(100);
const clienteId = z.string().regex(/^[a-z0-9-]{8,64}$/i);
const anexo = z.object({ nome: z.string().max(200), dataUrl: z.string().max(7_200_000) }).optional();

async function enviarAnexo(chamadoId: string, cid: string, a: z.infer<typeof anexo>, novoChamado: boolean) {
  if (!a) return undefined;
  try {
    const { base, usuario } = await contextoSomenteLeitura();
    const u = exigirUsuario(usuario);
    if (!novoChamado) {
      const c = base.chamados.find((x) => x.id === chamadoId);
      if (!c || !podeVer(base, u, c)) throw new ErroDominio("chamado", tr("chamado_nao_encontrado"));
      if (c.status === "fechado") throw new ErroDominio("status", tr("chamado_fechado_somente_leitura"));
    } else {
      const c = base.chamados.find((x) => x.id === chamadoId);
      if (c && c.solicitanteId !== u.id) throw new ErroDominio("cliente", tr("identificador_invalido"));
    }
    return await gravarAnexo(chamadoId, cid, a.nome, a.dataUrl);
  } catch (e) { tratarErro(e); }
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
  .validator(z.object({ chamadoId: id, clienteId, corpo: z.string().max(LIMITE_MENSAGEM), anexo, encaminhamentoId: id.optional() }).parse)
  .handler(async ({ data }) => {
    const meta = await enviarAnexo(data.chamadoId, data.clienteId, data.anexo, false);
    return mutar(({ usuario }) => sup.enviarMensagem(exigirUsuario(usuario), data.chamadoId, data.clienteId, data.corpo, meta, data.encaminhamentoId));
  });

export const encaminharChamadoFn = createServerFn({ method: "POST" })
  .validator(z.object({ chamadoId: id, clienteId, orientacao: z.string().max(LIMITE_MENSAGEM), anexos: z.array(id).max(20) }).parse)
  .handler(({ data }) => mutar(({ usuario }) => sup.encaminhar(exigirUsuario(usuario), data.chamadoId, data.clienteId, data.orientacao, data.anexos)));

export const marcarRetornoFn = createServerFn({ method: "POST" })
  .validator(z.object({ chamadoId: id, encaminhamentoId: id }).parse)
  .handler(({ data }) => mutar(({ usuario }) => sup.marcarRetorno(exigirUsuario(usuario), data.chamadoId, data.encaminhamentoId)));

export const definirResponsavelFn = createServerFn({ method: "POST" })
  .validator(z.object({ chamadoId: id, responsavelId: id.optional() }).parse)
  .handler(({ data }) => mutar(({ usuario }) => sup.definirResponsavel(exigirUsuario(usuario), data.chamadoId, data.responsavelId)));

export const alterarStatusChamadoFn = createServerFn({ method: "POST" })
  .validator(z.object({ chamadoId: id, acao: z.enum(["aguardar", "resolver", "reabrir", "fechar"]), descricao: z.string().max(500).optional() }).parse)
  .handler(({ data }) => mutar(({ usuario }) => sup.alterarStatus(exigirUsuario(usuario), data.chamadoId, data.acao, data.descricao)));

export const marcarChamadoLidoFn = createServerFn({ method: "POST" })
  .validator(z.object({ chamadoId: id, ate: z.string().max(40) }).parse)
  .handler(({ data }) => mutar(({ usuario }) => sup.marcarChamadoLido(exigirUsuario(usuario), data.chamadoId, data.ate)));

export const linkAnexoFn = createServerFn({ method: "POST" })
  .validator(z.object({ chamadoId: id, mensagemId: id, baixar: z.boolean() }).parse)
  .handler(async ({ data }) => {
    try {
      const { base, usuario } = await contextoSomenteLeitura();
      const u = exigirUsuario(usuario);
      const c = base.chamados.find((x) => x.id === data.chamadoId);
      if (!c || !podeVer(base, u, c) || !podeAbrirAnexo(base, u, c, data.mensagemId)) throw new ErroDominio("chamado", tr("chamado_nao_encontrado"));
      const m = c.mensagens.find((x) => x.id === data.mensagemId);
      if (!m?.anexo) throw new ErroDominio("anexo", tr("anexo_nao_encontrado"));
      return await urlDoAnexo(m.anexo, data.baixar);
    } catch (e) { tratarErro(e); }
  });

// ---------- Uso no navegador ----------
export type AnexoEnvio = { nome: string; dataUrl: string };
export interface DadosNovoChamado { clienteId: string; tipo: "evento" | "plataforma"; eventoId?: string | undefined; assunto: string; categoria: string; descricao: string; vinculadoA?: string | undefined; anexo?: AnexoEnvio | undefined }
export const abrirChamadoSuporte = (d: DadosNovoChamado) => chamar(abrirChamadoSuporteFn({ data: d }));
export const enviarMensagemSuporte = (chamadoId: string, clienteIdMsg: string, corpo: string, a?: AnexoEnvio, encaminhamentoId?: string) =>
  chamar(enviarMensagemSuporteFn({ data: { chamadoId, clienteId: clienteIdMsg, corpo, anexo: a, encaminhamentoId } }));
export const encaminharChamado = (chamadoId: string, clienteIdEnc: string, orientacao: string, anexos: string[]) =>
  chamar(encaminharChamadoFn({ data: { chamadoId, clienteId: clienteIdEnc, orientacao, anexos } }));
export const marcarRetornoEnviado = (chamadoId: string, encaminhamentoId: string) => chamar(marcarRetornoFn({ data: { chamadoId, encaminhamentoId } }));
export const assumirChamado = (chamadoId: string, responsavelId?: string) => chamar(definirResponsavelFn({ data: { chamadoId, responsavelId } }));
export const alterarStatusChamado = (chamadoId: string, acao: AcaoStatus, descricao?: string) =>
  chamar(alterarStatusChamadoFn({ data: { chamadoId, acao, descricao } }));
export const linkAnexo = (chamadoId: string, mensagemId: string, baixar = false) => linkAnexoFn({ data: { chamadoId, mensagemId, baixar } });
export const marcarLidoServidor = (chamadoId: string, ate: string) => chamar(marcarChamadoLidoFn({ data: { chamadoId, ate } }));
export const atualizarSuporte = () => recarregarVisao();
