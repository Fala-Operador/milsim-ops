// Serviço de check-in: tokens, validação, registro, reversão, preparação offline e
// sincronização demonstrativa. Regras de decisão ficam em src/lib/checkin.ts.
import { carregarBase, mutarBase, ErroDominio } from "@/services/db";
import { storage } from "@/lib/storage";
import {
  mesclarRegistros, normalizarCodigo, resolverSincronizacao, validarIngresso,
  type IngressoCredenciamento, type OrigemEntrada, type RegistroCheckin, type ResultadoValidacao,
} from "@/lib/checkin";
import {
  atualizarOperacao, gravarReferencia, lerReferencia, lerSnapshot, listarFila, listarRegistrosLocais,
  registrarLocal, salvarSnapshot, type SnapshotOffline,
} from "@/services/checkinStore";
import type { BaseDados, Evento, Usuario } from "@/lib/domain/types";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function aleatorio(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}
const novoId = () => `ck-${Date.now().toString(36)}-${aleatorio(8)}`;

export function dispositivoId(): string {
  let id = storage.ler<string>("dispositivo-id");
  if (!id) { id = `disp-${aleatorio(6)}`; storage.gravar("dispositivo-id", id); }
  return id;
}

export function podeOperar(usuario: Usuario | null, evento: Evento | undefined): boolean {
  if (!usuario || !evento) return false;
  return usuario.perfil === "admin" || (usuario.perfil === "organizador" && usuario.organizacaoId === evento.organizacaoId);
}
function exigirPermissao(usuario: Usuario | null, eventoId: string) {
  const evento = carregarBase().eventos.find((e) => e.id === eventoId);
  if (!podeOperar(usuario, evento)) throw new ErroDominio("sem_permissao", "Você não tem acesso ao check-in deste evento.");
  return usuario!;
}

/** Garante token estável para inscrições confirmadas. Nunca troca um token existente. */
export function garantirTokens(eventoId?: string): void {
  const faltando = carregarBase().inscricoes.some(
    (i) => i.status === "confirmada" && !i.tokenEntrada && (!eventoId || i.eventoId === eventoId),
  );
  if (!faltando) return;
  mutarBase((b) => b.inscricoes.forEach((i) => {
    if (i.status === "confirmada" && !i.tokenEntrada && (!eventoId || i.eventoId === eventoId)) i.tokenEntrada = `T${aleatorio(20)}`;
  }));
}

/** Token do participante (só o dono da inscrição). */
export function tokenDaInscricao(inscricaoId: string, usuarioId: string): string {
  const ins = carregarBase().inscricoes.find((i) => i.id === inscricaoId && i.usuarioId === usuarioId);
  if (!ins || ins.status !== "confirmada") throw new ErroDominio("sem_ingresso", "Ingresso indisponível.");
  if (!ins.tokenEntrada) garantirTokens(ins.eventoId);
  return carregarBase().inscricoes.find((i) => i.id === inscricaoId)!.tokenEntrada!;
}

export function ingressosDoEvento(base: BaseDados, eventoId: string): IngressoCredenciamento[] {
  const evento = base.eventos.find((e) => e.id === eventoId);
  if (!evento) return [];
  return base.inscricoes.filter((i) => i.eventoId === eventoId).map((i) => ({
    inscricaoId: i.id,
    eventoId,
    token: i.tokenEntrada ?? "",
    codigo: i.codigo,
    nome: base.usuarios.find((u) => u.id === i.usuarioId)?.nomeCompleto ?? "Participante",
    tipo: evento.tipos.find((t) => t.id === i.tipoId)?.nome ?? "—",
    exercito: evento.exercitos.find((x) => x.id === i.exercitoId)?.nome ?? "—",
    status: i.status,
  }));
}

/** Presenças conhecidas pela base de referência (usado na página Inscritos). */
export function registrosReferencia(eventoId: string): RegistroCheckin[] {
  return lerReferencia().filter((r) => r.eventoId === eventoId);
}

export interface FonteDados {
  online: boolean;
  ingressos: IngressoCredenciamento[];
  tokensOutros: Set<string>;
  registros: RegistroCheckin[];
  snapshot?: SnapshotOffline | undefined;
}

/** Monta a fonte de validação: online usa a base de referência; offline, a base baixada. */
export async function carregarFonte(eventoId: string, online: boolean): Promise<FonteDados> {
  const [locais, snapshot] = await Promise.all([listarRegistrosLocais(eventoId), lerSnapshot(eventoId)]);
  if (online) {
    const base = carregarBase();
    const tokensOutros = new Set(base.inscricoes.filter((i) => i.eventoId !== eventoId && i.tokenEntrada).map((i) => i.tokenEntrada!));
    return { online, ingressos: ingressosDoEvento(base, eventoId), tokensOutros, registros: mesclarRegistros(registrosReferencia(eventoId), locais), snapshot };
  }
  return {
    online,
    ingressos: snapshot?.ingressos ?? [],
    tokensOutros: new Set(snapshot?.tokensOutrosEventos ?? []),
    registros: mesclarRegistros(snapshot?.registros ?? [], locais),
    snapshot,
  };
}

export function validarEntrada(
  fonte: FonteDados, eventoId: string, busca: { token?: string; codigo?: string; inscricaoId?: string },
): ResultadoValidacao {
  const ingresso = fonte.ingressos.find((i) =>
    busca.token ? i.token === busca.token : busca.codigo ? i.codigo === normalizarCodigo(busca.codigo) : i.inscricaoId === busca.inscricaoId);
  return validarIngresso({ eventoId, ingresso, outroEvento: !!busca.token && fonte.tokensOutros.has(busca.token), registros: fonte.registros });
}

/** Registra entrada após revalidar com as mesmas regras (QR ou manual). */
export async function confirmarEntrada(p: {
  usuario: Usuario | null; eventoId: string; inscricaoId: string; origem: OrigemEntrada; motivo?: string; online: boolean;
}): Promise<{ resultado: ResultadoValidacao; registro?: RegistroCheckin }> {
  const usuario = exigirPermissao(p.usuario, p.eventoId);
  if (p.origem !== "qr" && !p.motivo?.trim()) throw new ErroDominio("motivo", "Informe o motivo do check-in manual.");
  const fonte = await carregarFonte(p.eventoId, p.online);
  const resultado = validarEntrada(fonte, p.eventoId, { inscricaoId: p.inscricaoId });
  if (resultado.tipo !== "valido") return { resultado };
  const registro: RegistroCheckin = {
    id: novoId(), eventoId: p.eventoId, inscricaoId: p.inscricaoId, tipo: "entrada", origem: p.origem,
    motivo: p.motivo?.trim() || undefined, operadorId: usuario.id, operadorNome: usuario.nomeExibicao ?? usuario.nomeCompleto,
    dispositivoId: dispositivoId(), em: new Date().toISOString(), sync: "pendente",
  };
  await registrarLocal(registro);
  return { resultado, registro };
}

/** Desfaz um check-in: preserva o original e adiciona uma reversão. */
export async function reverterEntrada(p: { usuario: Usuario | null; registro: RegistroCheckin; motivo: string }): Promise<RegistroCheckin> {
  const usuario = exigirPermissao(p.usuario, p.registro.eventoId);
  if (!p.motivo.trim()) throw new ErroDominio("motivo", "Informe a justificativa para desfazer o check-in.");
  const rev: RegistroCheckin = {
    id: novoId(), eventoId: p.registro.eventoId, inscricaoId: p.registro.inscricaoId, tipo: "reversao",
    revertidoId: p.registro.id, origem: p.registro.origem, motivo: p.motivo.trim(), operadorId: usuario.id,
    operadorNome: usuario.nomeExibicao ?? usuario.nomeCompleto, dispositivoId: dispositivoId(), em: new Date().toISOString(), sync: "pendente",
  };
  await registrarLocal(rev);
  return rev;
}

/** Baixa a base mínima do evento para o aparelho (sem CPF, telefone, e-mail ou endereço). */
export async function prepararOffline(usuario: Usuario | null, eventoId: string): Promise<SnapshotOffline> {
  exigirPermissao(usuario, eventoId);
  garantirTokens();
  const base = carregarBase();
  const snapshot: SnapshotOffline = {
    eventoId,
    atualizadoEm: new Date().toISOString(),
    ingressos: ingressosDoEvento(base, eventoId),
    tokensOutrosEventos: base.inscricoes.filter((i) => i.eventoId !== eventoId && i.tokenEntrada).map((i) => i.tokenEntrada!),
    registros: registrosReferencia(eventoId),
  };
  await salvarSnapshot(snapshot);
  return snapshot;
}

/** Envia a fila à base de referência simulada. Conflitos são preservados e sinalizados. */
export async function sincronizar(simularFalha: boolean): Promise<{ enviados: number; conflitos: number; falhas: number }> {
  const fila = await listarFila();
  let enviados = 0, conflitos = 0, falhas = 0;
  for (const op of fila) {
    if (simularFalha) { falhas++; await atualizarOperacao({ ...op, sync: "falhou" }, false); continue; }
    const ref = lerReferencia();
    const status = carregarBase().inscricoes.find((i) => i.id === op.inscricaoId)?.status;
    const r = resolverSincronizacao(ref, op, status);
    const final: RegistroCheckin = { ...op, sync: r.status, conflito: r.conflito };
    if (!ref.some((x) => x.id === op.id)) gravarReferencia([...ref, final]);
    await atualizarOperacao(final, true);
    if (r.status === "conflito") conflitos++; else enviados++;
  }
  return { enviados, conflitos, falhas };
}

export async function contarPendentes(): Promise<number> {
  return (await listarFila()).length;
}
