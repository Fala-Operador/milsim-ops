import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { corrigirParticipacao, salvarInsignia } from "@/api/gamificacao.functions";
import { FormCampanha, ListaCampanhas } from "@/components/perfil/campanhas";
import { descreverCriterio, statusVoucher } from "@/lib/participacao";
import { formatarDataBR } from "@/lib/domain/money";
import { nomeExibicao } from "@/services/comunidade";
import type { CampanhaRecompensa, CriterioInsignia, Insignia } from "@/lib/domain/types";
import { AreaTexto, Badge, Botao, Campo, Cartao, Entrada, Modal, Selecao } from "@/components/ui";

export const Route = createFileRoute("/admin/gamificacao")({
  head: () => ({
    meta: [
      { title: "Gamificação e recompensas — Admin MilSim Ops" },
      { name: "description", content: "Insígnias, campanhas de recompensa, concessões, resgates e correções de participação." },
      { property: "og:title", content: "Gamificação e recompensas — Admin MilSim Ops" },
      { property: "og:description", content: "Administração das regras de progressão." },
    ],
  }),
  component: Gamificacao,
});

const msg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível salvar.");

function FormInsignia({ inicial, onFechar }: { inicial: Insignia | null; onFechar: () => void }) {
  const [d, setD] = useState({
    nome: inicial?.nome ?? "", descricao: inicial?.descricao ?? "", icone: inicial?.icone ?? "🎖️",
    tipo: inicial?.criterio.tipo ?? ("operacoes" as CriterioInsignia["tipo"]), meta: inicial?.criterio.meta ?? 1, ativa: inicial?.ativa ?? true,
  });
  const [erro, setErro] = useState("");
  return (
    <Modal aberto titulo={inicial ? `Editar insígnia (versão ${inicial.versao})` : "Nova insígnia"} onFechar={onFechar}>
      <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
        <Campo rotulo="Ícone" htmlFor="in-ic">
          <div className="flex items-center gap-2">
            <Selecao id="in-ic" value={d.icone} onChange={(e) => setD({ ...d, icone: e.target.value })}>
              {ICONES_INSIGNIA.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
            </Selecao>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground"><IconeInsignia icone={d.icone} size={18} /></span>
          </div>
        </Campo>
        <Campo rotulo="Nome" htmlFor="in-nome"><Entrada id="in-nome" value={d.nome} maxLength={60} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
      </div>
      <div className="mt-3 space-y-3">
        <Campo rotulo="Descrição" htmlFor="in-desc"><AreaTexto id="in-desc" rows={2} value={d.descricao} onChange={(e) => setD({ ...d, descricao: e.target.value })} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Critério" htmlFor="in-tipo">
            <Selecao id="in-tipo" value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value as CriterioInsignia["tipo"] })}>
              <option value="operacoes">Operações concluídas</option><option value="estados">Estados diferentes</option><option value="modalidades">Modalidades diferentes</option>
            </Selecao>
          </Campo>
          <Campo rotulo="Meta" htmlFor="in-meta"><Entrada id="in-meta" type="number" min={1} value={d.meta} onChange={(e) => setD({ ...d, meta: Number(e.target.value) })} /></Campo>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.ativa} onChange={(e) => setD({ ...d, ativa: e.target.checked })} /> Concedendo novas conquistas</label>
        <p className="text-xs text-muted-foreground">Mudar o critério cria uma nova versão; quem já conquistou mantém a insígnia pela regra da época. Só presença confirmada conta — curtidas, fotos e documentos nunca entram.</p>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={async () => {
            try { await salvarInsignia({ id: inicial?.id, nome: d.nome, descricao: d.descricao, icone: d.icone, criterio: { tipo: d.tipo, meta: d.meta }, ativa: d.ativa }); onFechar(); }
            catch (e) { setErro(msg(e)); }
          }}>Salvar</Botao>
        </div>
      </div>
    </Modal>
  );
}

function Correcao() {
  const base = carregarBase();
  const [eventoId, setEventoId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [tipo, setTipo] = useState<"invalidar" | "validar">("invalidar");
  const [just, setJust] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; t: string } | null>(null);
  const inscritos = base.inscricoes.filter((i) => i.eventoId === eventoId && i.status === "confirmada");
  return (
    <Cartao>
      <h3 className="font-display text-lg font-semibold uppercase">Corrigir participação</h3>
      <p className="text-xs text-muted-foreground">Invalidar remove a operação da progressão e revoga benefícios não usados (usados viram ocorrência para análise). Validar registra presença sem check-in em evento concluído. Toda correção exige justificativa e fica na auditoria.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Campo rotulo="Evento" htmlFor="cr-ev">
          <Selecao id="cr-ev" value={eventoId} onChange={(e) => { setEventoId(e.target.value); setUsuarioId(""); }}>
            <option value="">Selecione</option>
            {base.eventos.filter((e) => e.status !== "rascunho").map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Participante" htmlFor="cr-us">
          <Selecao id="cr-us" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} disabled={!eventoId}>
            <option value="">Selecione</option>
            {inscritos.map((i) => <option key={i.id} value={i.usuarioId}>{nomeExibicao(base.usuarios.find((u) => u.id === i.usuarioId))}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Ação" htmlFor="cr-tp">
          <Selecao id="cr-tp" value={tipo} onChange={(e) => setTipo(e.target.value as "invalidar" | "validar")}>
            <option value="invalidar">Invalidar participação</option><option value="validar">Validar participação</option>
          </Selecao>
        </Campo>
        <Campo rotulo="Justificativa" htmlFor="cr-j"><Entrada id="cr-j" value={just} onChange={(e) => setJust(e.target.value)} /></Campo>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Botao disabled={!eventoId || !usuarioId} onClick={async () => {
          try { await corrigirParticipacao({ usuarioId, eventoId, tipo, justificativa: just }); setAviso({ ok: true, t: "Correção registrada e progressão recalculada." }); setJust(""); }
          catch (e) { setAviso({ ok: false, t: msg(e) }); }
        }}>Registrar correção</Botao>
        {aviso && <p role={aviso.ok ? "status" : "alert"} className={`text-sm ${aviso.ok ? "text-success" : "text-destructive"}`}>{aviso.t}</p>}
      </div>
    </Cartao>
  );
}

function Gamificacao() {
  useVersaoBase();
  const { usuario } = useAuth();
  const [insignia, setInsignia] = useState<Insignia | null | "nova">(null);
  const [campanha, setCampanha] = useState<CampanhaRecompensa | null | "nova">(null);
  if (!usuario) return null;
  const base = carregarBase();
  const nome = (id: string) => nomeExibicao(base.usuarios.find((u) => u.id === id));

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold uppercase">Insígnias</h2>
          <Botao onClick={() => setInsignia("nova")}>Nova insígnia</Botao>
        </div>
        <ul className="mt-2 grid gap-2 md:grid-cols-2">
          {base.insignias.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-3 text-sm">
              <div>
                <p className="flex items-center gap-2 font-medium"><IconeInsignia icone={i.icone} size={18} /> {i.nome} <span className="text-xs text-muted-foreground">v{i.versao}</span> {!i.ativa && <Badge>Sem novas concessões</Badge>}</p>
                <p className="text-xs text-muted-foreground">{descreverCriterio(i.criterio)} · {base.concessoesInsignia.filter((c) => c.insigniaId === i.id && !c.revogadaEm).length} concedidas</p>
              </div>
              <Botao variante="contorno" className="px-3 py-1 text-xs" onClick={() => setInsignia(i)}>Editar</Botao>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold uppercase">Campanhas de recompensa</h2>
          <Botao onClick={() => setCampanha("nova")}>Nova campanha</Botao>
        </div>
        <div className="mt-2"><ListaCampanhas base={base} campanhas={base.campanhasRecompensa} onEditar={setCampanha} /></div>
      </section>

      <Correcao />

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-lg font-semibold uppercase">Concessões</h2>
          <div className="mt-2 max-h-80 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary"><tr><th className="p-2">Pessoa</th><th className="p-2">Insígnia</th><th className="p-2">Data</th><th className="p-2">Situação</th></tr></thead>
              <tbody>
                {base.concessoesInsignia.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="p-2">{nome(c.usuarioId)}</td>
                    <td className="p-2">{base.insignias.find((i) => i.id === c.insigniaId)?.nome}</td>
                    <td className="p-2">{formatarDataBR(c.conquistadaEm)}</td>
                    <td className="p-2">{c.revogadaEm ? `Revogada: ${c.motivoRevogacao}` : "Ativa"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold uppercase">Benefícios e resgates</h2>
          <div className="mt-2 max-h-80 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary"><tr><th className="p-2">Pessoa</th><th className="p-2">Campanha</th><th className="p-2">Status</th><th className="p-2">Observação</th></tr></thead>
              <tbody>
                {base.vouchers.map((v) => (
                  <tr key={v.id} className="border-t border-border">
                    <td className="p-2">{nome(v.usuarioId)}</td>
                    <td className="p-2">{v.beneficio.nome}</td>
                    <td className="p-2">{statusVoucher(v)}</td>
                    <td className="p-2">{v.ocorrencia ?? v.motivo ?? (v.inscricaoId ? `Inscrição ${v.inscricaoId}` : "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {insignia && <FormInsignia inicial={insignia === "nova" ? null : insignia} onFechar={() => setInsignia(null)} />}
      {campanha && <FormCampanha base={base} usuario={usuario} inicial={campanha === "nova" ? null : campanha} onFechar={() => setCampanha(null)} />}
    </div>
  );
}
