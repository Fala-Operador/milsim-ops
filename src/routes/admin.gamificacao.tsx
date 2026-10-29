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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { FaixaIndicadores } from "@/components/FaixaIndicadores";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo, Modal } from "@/components/ui";
import { IconeInsignia, ICONES_INSIGNIA } from "@/components/perfil/IconeInsignia";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { tr } from "@/i18n/routes/admin.gamificacao";

export const Route = createFileRoute("/admin/gamificacao")({
  head: () => ({
    meta: [
      { title: tr("gamificacao_e_recompensas_admin_milsim_o") },
      { name: "description", content: tr("insignias_campanhas_de_recompensa_conces") },
      { property: "og:title", content: tr("gamificacao_e_recompensas_admin_milsim_o") },
      { property: "og:description", content: tr("administracao_das_regras_de_progressao") },
    ],
  }),
  component: Gamificacao,
});

const msg = (e: unknown) => (e instanceof Error ? e.message : tr("nao_foi_possivel_salvar"));

function FormInsignia({ inicial, onFechar }: { inicial: Insignia | null; onFechar: () => void }) {
  const [d, setD] = useState({
    nome: inicial?.nome ?? "", descricao: inicial?.descricao ?? "", icone: inicial?.icone ?? "🎖️",
    tipo: inicial?.criterio.tipo ?? ("operacoes" as CriterioInsignia["tipo"]), meta: inicial?.criterio.meta ?? 1, ativa: inicial?.ativa ?? true,
  });
  const [erro, setErro] = useState("");
  return (
    <Modal aberto titulo={inicial ? tr("editar_insignia_versao_versao", { versao: inicial.versao }) : tr("nova_insignia")} onFechar={onFechar}>
      <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
        <Campo rotulo={tr("icone")} htmlFor="in-ic">
          <div className="flex items-center gap-2">
            <NativeSelect id="in-ic" value={d.icone} onChange={(e) => setD({ ...d, icone: e.target.value })}>
              {ICONES_INSIGNIA.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
            </NativeSelect>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground"><IconeInsignia icone={d.icone} size={18} /></span>
          </div>
        </Campo>
        <Campo rotulo={tr("nome")} htmlFor="in-nome"><Input id="in-nome" value={d.nome} maxLength={60} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
      </div>
      <div className="mt-3 space-y-3">
        <Campo rotulo={tr("descricao")} htmlFor="in-desc"><Textarea id="in-desc" rows={2} value={d.descricao} onChange={(e) => setD({ ...d, descricao: e.target.value })} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={tr("criterio")} htmlFor="in-tipo">
            <NativeSelect id="in-tipo" value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value as CriterioInsignia["tipo"] })}>
              <option value="operacoes">{tr("operacoes_concluidas")}</option><option value="estados">{tr("estados_diferentes")}</option><option value="modalidades">{tr("modalidades_diferentes")}</option><option value="missoes">{tr("missoes_pre_evento_concluidas")}</option>
            </NativeSelect>
          </Campo>
          <Campo rotulo={tr("meta")} htmlFor="in-meta"><Input id="in-meta" type="number" min={1} value={d.meta} onChange={(e) => setD({ ...d, meta: Number(e.target.value) })} /></Campo>
        </div>
        <Label className="flex items-center gap-2 text-sm font-normal text-inherit"><Checkbox checked={d.ativa} onCheckedChange={(marcado) => setD({ ...d, ativa: marcado === true })} />{" "}{tr("concedendo_novas_conquistas")}</Label>
        <p className="text-xs text-muted-foreground">{tr("mudar_o_criterio_cria_uma_nova")}</p>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar}>{tr("cancelar")}</Button>
          <Button onClick={async () => {
            try { await salvarInsignia({ id: inicial?.id, nome: d.nome, descricao: d.descricao, icone: d.icone, criterio: { tipo: d.tipo, meta: d.meta }, ativa: d.ativa }); onFechar(); }
            catch (e) { setErro(msg(e)); }
          }}>{tr("salvar")}</Button>
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
    <section id="correcoes" aria-labelledby="t-correcoes" className="grid scroll-mt-24 gap-6 border-t border-border pt-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div>
        <h2 id="t-correcoes" className="text-lg font-semibold">{tr("corrigir_participacao")}</h2>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          <li className="border-l-2 border-destructive/60 pl-3"><span className="font-medium text-foreground">{tr("invalidar")}</span>{" "}{tr("tira_a_operacao_da_progressao_e")}</li>
          <li className="border-l-2 border-success/60 pl-3"><span className="font-medium text-foreground">{tr("validar")}</span>{" "}{tr("registra_presenca_sem_check_in_em")}</li>
        </ul>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{tr("justificativa_obrigatoria_registrada_na")}</p>
      </div>
      <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo={tr("evento")} htmlFor="cr-ev">
          <NativeSelect id="cr-ev" value={eventoId} onChange={(e) => { setEventoId(e.target.value); setUsuarioId(""); }}>
            <option value="">{tr("selecione")}</option>
            {base.eventos.filter((e) => e.status !== "rascunho").map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </NativeSelect>
        </Campo>
        <Campo rotulo={tr("participante")} htmlFor="cr-us">
          <NativeSelect id="cr-us" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} disabled={!eventoId}>
            <option value="">{tr("selecione")}</option>
            {inscritos.map((i) => <option key={i.id} value={i.usuarioId}>{nomeExibicao(base.usuarios.find((u) => u.id === i.usuarioId))}</option>)}
          </NativeSelect>
        </Campo>
        <Campo rotulo={tr("acao")} htmlFor="cr-tp">
          <NativeSelect id="cr-tp" value={tipo} onChange={(e) => setTipo(e.target.value as "invalidar" | "validar")}>
            <option value="invalidar">{tr("invalidar_participacao")}</option><option value="validar">{tr("validar_participacao")}</option>
          </NativeSelect>
        </Campo>
        <Campo rotulo={tr("justificativa")} htmlFor="cr-j"><Input id="cr-j" value={just} onChange={(e) => setJust(e.target.value)} placeholder={tr("ex_check_in_feito_em_papel")} /></Campo>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button disabled={!eventoId || !usuarioId} onClick={async () => {
          try { await corrigirParticipacao({ usuarioId, eventoId, tipo, justificativa: just }); setAviso({ ok: true, t: tr("correcao_registrada_e_progressao_recalcu") }); setJust(""); }
          catch (e) { setAviso({ ok: false, t: msg(e) }); }
        }}>{tr("registrar_correcao")}</Button>
        {aviso && <p role={aviso.ok ? "status" : "alert"} className={`text-sm ${aviso.ok ? "text-success" : "text-destructive"}`}>{aviso.t}</p>}
      </div>
      </div>
    </section>
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

  const concedidas = (id: string) => base.concessoesInsignia.filter((c) => c.insigniaId === id && !c.revogadaEm).length;
  const SECOES = [["insignias", tr("insignias")], ["campanhas", tr("campanhas")], ["correcoes", tr("correcoes")], ["historico", tr("historico")]] as const;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="titulo-pagina">{tr("gamificacao")}</h1>
        <p className="subtitulo-pagina">{tr("insignias_que_os_operadores_conquistam_c")}</p>
      </div>
      <FaixaIndicadores className="lg:grid-cols-4" itens={[
        { rotulo: tr("insignias_ativas"), valor: tr("x_de_y", { x: base.insignias.filter((i) => i.ativa).length, y: base.insignias.length }) },
        { rotulo: tr("conquistas_concedidas"), valor: String(base.concessoesInsignia.filter((c) => !c.revogadaEm).length) },
        { rotulo: tr("campanhas_ativas"), valor: String(base.campanhasRecompensa.filter((c) => c.ativa).length) },
        { rotulo: tr("beneficios_usados"), valor: String(base.vouchers.filter((v) => v.status === "utilizada").length), detalhe: tr("de_length_emitidos", { length: base.vouchers.length }) },
      ]} />
      <nav aria-label={tr("secoes_da_gamificacao")} className="flex flex-wrap gap-1 border-b border-border">
        {SECOES.map(([id, r]) => <a key={id} href={`#${id}`} className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:border-border hover:text-foreground">{r}</a>)}
      </nav>

      <section id="insignias" aria-labelledby="t-insignias" className="scroll-mt-24">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="t-insignias" className="text-lg font-semibold">{tr("insignias")}</h2>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{tr("mudar_o_criterio_cria_uma_nova_2")}</span>
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {base.insignias.map((i) => (
            <li key={i.id} className={`flex flex-col rounded-lg border border-border p-4 ${i.ativa ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <span className={`grid size-12 place-items-center rounded-full border-2 ${i.ativa ? "border-accent/70 bg-accent/10 text-accent" : "border-border text-muted-foreground"}`}><IconeInsignia icone={i.icone} size={22} /></span>
                <span className="font-mono text-[11px] text-muted-foreground">v{i.versao}</span>
              </div>
              <p className="mt-3 font-semibold">{i.nome}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{descreverCriterio(i.criterio)}</p>
              <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                <p><span className="font-display text-3xl font-bold leading-none tabular-nums">{concedidas(i.id)}</span> <span className="text-xs text-muted-foreground">{tr("concedidas")}</span></p>
                <Button variant="link" size="none" className="text-sm" onClick={() => setInsignia(i)}>{tr("editar")}</Button>
              </div>
              {!i.ativa && <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{tr("sem_novas_concessoes")}</p>}
            </li>
          ))}
          <li>
            <Button variant="plain" size="none" onClick={() => setInsignia("nova")}
              className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-accent hover:text-foreground">
              <Plus className="size-5" aria-hidden />{tr("nova_insignia")}</Button>
          </li>
        </ul>
      </section>

      <section id="campanhas" aria-labelledby="t-campanhas" className="scroll-mt-24 border-t border-border pt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="t-campanhas" className="text-lg font-semibold">{tr("campanhas_de_recompensa")}</h2>
            <p className="text-sm text-muted-foreground">{tr("beneficio_dado_a_quem_conquista_uma")}</p>
          </div>
          <Button variant="outline" onClick={() => setCampanha("nova")}><Plus className="size-4" aria-hidden />{tr("nova_campanha")}</Button>
        </div>
        <div className="mt-3"><ListaCampanhas base={base} campanhas={base.campanhasRecompensa} onEditar={setCampanha} onNova={() => setCampanha("nova")} /></div>
      </section>

      <Correcao />

      <section id="historico" aria-labelledby="t-historico" className="scroll-mt-24 border-t border-border pt-8">
        <h2 id="t-historico" className="text-lg font-semibold">{tr("historico")}</h2>
        <div className="mt-3 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="rotulo-tecnico">{tr("conquistas")}</h3>
            <div className="mt-2 max-h-96 overflow-y-auto border-y border-border">
              <Table className="w-full text-left text-sm">
                <TableHeader><TableRow><TableHead className="rotulo-tecnico px-2 py-2">{tr("data")}</TableHead><TableHead className="rotulo-tecnico px-2 py-2">{tr("pessoa")}</TableHead><TableHead className="rotulo-tecnico px-2 py-2">{tr("insignia")}</TableHead><TableHead className="rotulo-tecnico px-2 py-2">{tr("situacao")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {base.concessoesInsignia.map((c) => {
                    const ins = base.insignias.find((i) => i.id === c.insigniaId);
                    return (
                      <TableRow key={c.id} className="border-t border-border">
                        <TableCell className="whitespace-nowrap px-2 py-2 font-mono text-xs text-muted-foreground">{formatarDataBR(c.conquistadaEm)}</TableCell>
                        <TableCell className="px-2 py-2 font-medium">{nome(c.usuarioId)}</TableCell>
                        <TableCell className="px-2 py-2"><span className="inline-flex items-center gap-1.5">{ins && <IconeInsignia icone={ins.icone} size={14} />}{ins?.nome}</span></TableCell>
                        <TableCell className="px-2 py-2">{c.revogadaEm ? <Badge variant="destructive" title={c.motivoRevogacao}>{tr("revogada")}</Badge> : <Badge variant="success">{tr("ativa")}</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {base.concessoesInsignia.length === 0 && <p className="py-4 text-sm text-muted-foreground">{tr("nenhuma_conquista_ainda")}</p>}
            </div>
          </div>
          <div>
            <h3 className="rotulo-tecnico">{tr("beneficios_e_resgates")}</h3>
            <div className="mt-2 max-h-96 overflow-y-auto border-y border-border">
              <Table className="w-full text-left text-sm">
                <TableHeader><TableRow><TableHead className="rotulo-tecnico px-2 py-2">{tr("pessoa")}</TableHead><TableHead className="rotulo-tecnico px-2 py-2">{tr("beneficio")}</TableHead><TableHead className="rotulo-tecnico px-2 py-2">{tr("situacao")}</TableHead><TableHead className="rotulo-tecnico px-2 py-2">{tr("observacao")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {base.vouchers.map((v) => {
                    const st = statusVoucher(v);
                    return (
                      <TableRow key={v.id} className="border-t border-border">
                        <TableCell className="px-2 py-2 font-medium">{nome(v.usuarioId)}</TableCell>
                        <TableCell className="px-2 py-2">{v.beneficio.nome}</TableCell>
                        <TableCell className="px-2 py-2"><Badge variant={st === "disponivel" ? "success" : st === "utilizada" ? "accent" : "secondary"}>{st}</Badge></TableCell>
                        <TableCell className="px-2 py-2 text-xs text-muted-foreground">{v.ocorrencia ?? v.motivo ?? (v.inscricaoId ? tr("inscricao_inscricaoid", { inscricaoId: v.inscricaoId }) : "")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {base.vouchers.length === 0 && <p className="py-4 text-sm text-muted-foreground">{tr("nenhum_beneficio_emitido_ainda")}</p>}
            </div>
          </div>
        </div>
      </section>

      {insignia && <FormInsignia inicial={insignia === "nova" ? null : insignia} onFechar={() => setInsignia(null)} />}
      {campanha && <FormCampanha base={base} usuario={usuario} inicial={campanha === "nova" ? null : campanha} onFechar={() => setCampanha(null)} />}
    </div>
  );
}
