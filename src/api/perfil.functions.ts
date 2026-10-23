// API do Perfil do Operador: leitura filtrada por privacidade e escritas da própria conta.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ErroDominio } from "@/services/db";
import * as perfil from "@/services/perfilOperador";
import { recalcularProgressao } from "@/services/progressao";
import { montarPerfil, type PerfilDTO } from "@/lib/perfilSocial";
import { contextoSomenteLeitura, exigirUsuario, idDaSessao, ler, mutar } from "@/server/unidade.server";
import { gravarNota, lerArquivoNota, removerNota, urlDaNota } from "@/server/documentos.server";
import { relacaoCom } from "@/server/social.server";
import { chamar } from "@/api/cliente";
import type { PrivacidadePerfil } from "@/lib/domain/types";

const id = z.string().min(1).max(120);
const vis = z.enum(["eu", "autenticados"]);
const imagem = z.string().max(perfil.TAMANHO_MAX_IMAGEM);

export const obterPerfilFn = createServerFn({ method: "POST" })
  .validator(z.object({ usuarioId: id }).parse)
  .handler(async ({ data }) => {
    const sessao = await idDaSessao();
    // O dono recalcula a própria progressão ao abrir o perfil (idempotente).
    if (sessao && sessao === data.usuarioId) {
      return mutar(({ base, usuario }) => {
        recalcularProgressao(base);
        return montarPerfil(base, data.usuarioId, usuario);
      });
    }
    // Perfil privado: os blocos dependem de seguir (aprovado) e de bloqueio, lidos fora da base.
    return ler(async ({ base, usuario }) => montarPerfil(base, data.usuarioId, usuario, await relacaoCom(usuario?.id ?? null, data.usuarioId)));
  });

export const salvarPerfilFn = createServerFn({ method: "POST" })
  .validator(z.object({
    callsign: z.string().max(60).optional(), bio: z.string().max(400).optional(), squad: z.string().max(80).optional(),
    instagram: z.string().max(60).optional(), capa: imagem.nullable().optional(), insigniaDestaque: z.string().max(120).nullable().optional(),
  }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => perfil.salvarPerfil(base, exigirUsuario(usuario), data)));

export const salvarPrivacidadeFn = createServerFn({ method: "POST" })
  .validator(z.object({ historico: vis, mapa: vis, insignias: vis, equipamentos: vis, fotos: vis }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => perfil.salvarPrivacidade(base, exigirUsuario(usuario), data)));

export const marcarIntroFn = createServerFn({ method: "POST" })
  .handler(() => mutar(({ base, usuario }) => perfil.marcarIntroVista(base, exigirUsuario(usuario))));

export const ocultarOperacaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id, oculta: z.boolean() }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => perfil.alternarOperacaoOculta(base, exigirUsuario(usuario), data.eventoId, data.oculta)));

export const salvarEquipamentoFn = createServerFn({ method: "POST" })
  .validator(z.object({
    id: id.optional(), marca: z.string().max(100), tipo: z.enum(["spring", "hpa", "aeg", "gbbr"]), modelo: z.string().max(120),
    apelido: z.string().max(100).optional(), observacoes: z.string().max(800).optional(),
    fotos: z.array(imagem).max(perfil.MAX_FOTOS_EQUIPAMENTO), visivel: z.boolean(),
  }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => perfil.salvarEquipamento(base, exigirUsuario(usuario), data).id));

export const excluirEquipamentoFn = createServerFn({ method: "POST" })
  .validator(z.object({ id }).parse)
  .handler(async ({ data }) => {
    const r = await mutar(({ base, usuario }) => {
      const u = exigirUsuario(usuario);
      perfil.excluirEquipamento(base, u, data.id);
      return u.id;
    });
    await removerNota(r.resultado, data.id); // documento privado sai junto
    return r;
  });

export const adicionarFotoFn = createServerFn({ method: "POST" })
  .validator(z.object({ dataUrl: imagem, legenda: z.string().max(300).optional(), alt: z.string().max(300).optional() }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => perfil.adicionarFoto(base, exigirUsuario(usuario), data)));

export const editarFotoFn = createServerFn({ method: "POST" })
  .validator(z.object({ id, legenda: z.string().max(300).optional(), alt: z.string().max(300).optional(), visivel: z.boolean() }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => perfil.editarFoto(base, exigirUsuario(usuario), data.id, data)));

export const excluirFotoFn = createServerFn({ method: "POST" })
  .validator(z.object({ id }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => perfil.excluirFoto(base, exigirUsuario(usuario), data.id)));

// ---------- Operações fora da plataforma (registradas pelo operador, com foto) ----------
export const salvarOperacaoExternaFn = createServerFn({ method: "POST" })
  .validator(z.object({
    id: id.optional(), nome: z.string().max(120), data: z.string().max(10), cidade: z.string().max(80), uf: z.string().max(2),
    organizacao: z.string().max(120).optional(), modalidade: z.string().max(40).optional(),
    foto: imagem, fotoAlt: z.string().max(200).optional(), descricao: z.string().max(400).optional(), visivel: z.boolean(),
  }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => perfil.salvarOperacaoExterna(base, exigirUsuario(usuario), data).id));

export const excluirOperacaoExternaFn = createServerFn({ method: "POST" })
  .validator(z.object({ id }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => perfil.excluirOperacaoExterna(base, exigirUsuario(usuario), data.id)));

// ---------- Notas fiscais (armazenamento privado) ----------
async function exigirDono(equipamentoId: string) {
  const { base, usuario } = await contextoSomenteLeitura();
  const u = exigirUsuario(usuario);
  if (!base.equipamentos.some((e) => e.id === equipamentoId && e.usuarioId === u.id)) {
    throw new Error("Equipamento não encontrado.");
  }
  return u;
}
const tratar = (e: unknown): never => {
  if (e instanceof ErroDominio) throw new Error(e.message);
  throw e instanceof Error ? e : new Error("Não foi possível concluir.");
};

export const enviarNotaFn = createServerFn({ method: "POST" })
  .validator(z.object({ equipamentoId: id, nome: z.string().min(1).max(160), dataUrl: z.string().max(7_200_000) }).parse)
  .handler(async ({ data }) => {
    try {
      const u = await exigirDono(data.equipamentoId);
      const arq = lerArquivoNota(data.dataUrl);
      const nome = data.nome.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
      const meta = await gravarNota(u.id, data.equipamentoId, nome, arq);
      return await mutar(({ base, usuario }) => {
        const e = base.equipamentos.find((x) => x.id === data.equipamentoId && x.usuarioId === exigirUsuario(usuario).id);
        if (e) e.nota = meta;
      });
    } catch (e) { return tratar(e); }
  });

export const linkNotaFn = createServerFn({ method: "POST" })
  .validator(z.object({ equipamentoId: id, baixar: z.boolean() }).parse)
  .handler(async ({ data }) => {
    try {
      const u = await exigirDono(data.equipamentoId);
      return await urlDaNota(u.id, data.equipamentoId, data.baixar);
    } catch (e) { return tratar(e); }
  });

export const excluirNotaFn = createServerFn({ method: "POST" })
  .validator(z.object({ equipamentoId: id }).parse)
  .handler(async ({ data }) => {
    try {
      const u = await exigirDono(data.equipamentoId);
      await removerNota(u.id, data.equipamentoId);
      return await mutar(({ base, usuario }) => {
        const e = base.equipamentos.find((x) => x.id === data.equipamentoId && x.usuarioId === exigirUsuario(usuario).id);
        if (e) e.nota = undefined;
      });
    } catch (e) { return tratar(e); }
  });

// ---------- Uso no navegador ----------
export const obterPerfil = (usuarioId: string): Promise<PerfilDTO | null> => chamar(obterPerfilFn({ data: { usuarioId } }));
export const salvarPerfil = (d: perfil.DadosPerfil) => chamar(salvarPerfilFn({ data: d }));
export const salvarPrivacidade = (d: PrivacidadePerfil) => chamar(salvarPrivacidadeFn({ data: d }));
export const marcarIntro = () => chamar(marcarIntroFn());
export const ocultarOperacao = (eventoId: string, oculta: boolean) => chamar(ocultarOperacaoFn({ data: { eventoId, oculta } }));
export const salvarEquipamento = (d: perfil.DadosEquipamento) => chamar(salvarEquipamentoFn({ data: d }));
export const excluirEquipamento = (eid: string) => chamar(excluirEquipamentoFn({ data: { id: eid } }));
export const adicionarFoto = (d: { dataUrl: string; legenda?: string | undefined; alt?: string | undefined }) => chamar(adicionarFotoFn({ data: d }));
export const editarFoto = (d: { id: string; legenda?: string | undefined; alt?: string | undefined; visivel: boolean }) => chamar(editarFotoFn({ data: d }));
export const excluirFoto = (fid: string) => chamar(excluirFotoFn({ data: { id: fid } }));
export const enviarNota = (equipamentoId: string, nome: string, dataUrl: string) => chamar(enviarNotaFn({ data: { equipamentoId, nome, dataUrl } }));
export const linkNota = (equipamentoId: string, baixar: boolean) => linkNotaFn({ data: { equipamentoId, baixar } });
export const salvarOperacaoExterna = (d: perfil.DadosOperacaoExterna) => chamar(salvarOperacaoExternaFn({ data: d }));
export const excluirOperacaoExterna = (oid: string) => chamar(excluirOperacaoExternaFn({ data: { id: oid } }));
export const excluirNota = (equipamentoId: string) => chamar(excluirNotaFn({ data: { equipamentoId } }));
