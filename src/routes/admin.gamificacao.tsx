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
            <NativeSelect id="in-ic" value={d.icone} onChange={(e) => setD({ ...d, icone: e.target.value })}>
              {ICONES_INSIGNIA.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
            </NativeSelect>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground"><IconeInsignia icone={d.icone} size={18} /></span>
          </div>
        </Campo>
        <Campo rotulo="Nome" htmlFor="in-nome"><Input id="in-nome" value={d.nome} maxLength={60} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
      </div>
      <div className="mt-3 space-y-3">
        <Campo rotulo="Descrição" htmlFor="in-desc"><Textarea id="in-desc" rows={2} value={d.descricao} onChange={(e) => setD({ ...d, descricao: e.target.value })} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Critério" htmlFor="in-tipo">
            <NativeSelect id="in-tipo" value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value as CriterioInsignia["tipo"] })}>
              <option value="operacoes">Operações concluídas</option><option value="estados">Estados diferentes</option><option value="modalidades">Modalidades diferentes</option><option value="missoes">Missões pré-evento concluídas</option>
            </NativeSelect>
          </Campo>
          <Campo rotulo="Meta" htmlFor="in-meta"><Input id="in-meta" type="number" min={1} value={d.meta} onChange={(e) => setD({ ...d, meta: Number(e.target.value) })} /></Campo>
        </div>
        <Label className="flex items-center gap-2 text-sm font-normal text-inherit"><Checkbox checked={d.ativa} onCheckedChange={(marcado) => setD({ ...d, ativa: marcado === true })} /> Concedendo novas conquistas</Label>
        <p className="text-xs text-muted-foreground">Mudar o critério cria uma nova versão; quem já conquistou mantém a insígnia pela regra da época. Só presença confirmada conta — curtidas, fotos e documentos nunca entram.</p>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={async () => {
            try { await salvarInsignia({ id: inicial?.id, nome: d.nome, descricao: d.descricao, icone: d.icone, criterio: { tipo: d.tipo, meta: d.meta }, ativa: d.ativa }); onFechar(); }
            catch (e) { setErro(msg(e)); }
          }}>Salvar</Button>
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
        <h2 id="t-correcoes" className="text-lg font-semibold">Corrigir participação</h2>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          <li className="border-l-2 border-destructive/60 pl-3"><span className="font-medium text-foreground">Invalidar</span> tira a operação da progressão e revoga benefícios não usados. Os usados viram ocorrência.</li>
          <li className="border-l-2 border-success/60 pl-3"><span className="font-medium text-foreground">Validar</span> registra presença sem check-in em evento concluído.</li>
        </ul>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Justificativa obrigatória · registrada na auditoria</p>
      </div>
      <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Evento" htmlFor="cr-ev">
          <NativeSelect id="cr-ev" value={eventoId} onChange={(e) => { setEventoId(e.target.value); setUsuarioId(""); }}>
            <option value="">Selecione</option>
            {base.eventos.filter((e) => e.status !== "rascunho").map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </NativeSelect>
        </Campo>
        <Campo rotulo="Participante" htmlFor="cr-us">
          <NativeSelect id="cr-us" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} disabled={!eventoId}>
            <option value="">Selecione</option>
            {inscritos.map((i) => <option key={i.id} value={i.usuarioId}>{nomeExibicao(base.usuarios.find((u) => u.id === i.usuarioId))}</option>)}
          </NativeSelect>
        </Campo>
        <Campo rotulo="Ação" htmlFor="cr-tp">
          <NativeSelect id="cr-tp" value={tipo} onChange={(e) => setTipo(e.target.value as "invalidar" | "validar")}>
            <option value="invalidar">Invalidar participação</option><option value="validar">Validar participação</option>
          </NativeSelect>
        </Campo>
        <Campo rotulo="Justificativa" htmlFor="cr-j"><Input id="cr-j" value={just} onChange={(e) => setJust(e.target.value)} placeholder="Ex.: check-in feito em papel" /></Campo>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button disabled={!eventoId || !usuarioId} onClick={async () => {
          try { await corrigirParticipacao({ usuarioId, eventoId, tipo, justificativa: just }); setAviso({ ok: true, t: "Correção registrada e progressão recalculada." }); setJust(""); }
          catch (e) { setAviso({ ok: false, t: msg(e) }); }
        }}>Registrar correção</Button>
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
  const SECOES = [["insignias", "Insígnias"], ["campanhas", "Campanhas"], ["correcoes", "Correções"], ["historico", "Histórico"]] as const;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="titulo-pagina">Gamificação</h1>
        <p className="subtitulo-pagina">Insígnias que os operadores conquistam, campanhas de recompensa ligadas a elas e correções de participação. Só presença confirmada conta.</p>
      </div>
      <FaixaIndicadores className="lg:grid-cols-4" itens={[
        { rotulo: "Insígnias ativas", valor: `${base.insignias.filter((i) => i.ativa).length} de ${base.insignias.length}` },
        { rotulo: "Conquistas concedidas", valor: String(base.concessoesInsignia.filter((c) => !c.revogadaEm).length) },
        { rotulo: "Campanhas ativas", valor: String(base.campanhasRecompensa.filter((c) => c.ativa).length) },
        { rotulo: "Benefícios usados", valor: String(base.vouchers.filter((v) => v.status === "utilizada").length), detalhe: `de ${base.vouchers.length} emitidos` },
      ]} />
      <nav aria-label="Seções da gamificação" className="flex flex-wrap gap-1 border-b border-border">
        {SECOES.map(([id, r]) => <a key={id} href={`#${id}`} className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:border-border hover:text-foreground">{r}</a>)}
      </nav>

      <section id="insignias" aria-labelledby="t-insignias" className="scroll-mt-24">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="t-insignias" className="text-lg font-semibold">Insígnias</h2>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Mudar o critério cria uma nova versão</span>
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
                <p><span className="font-display text-3xl font-bold leading-none tabular-nums">{concedidas(i.id)}</span> <span className="text-xs text-muted-foreground">concedidas</span></p>
                <Button variant="link" size="none" className="text-sm" onClick={() => setInsignia(i)}>Editar</Button>
              </div>
              {!i.ativa && <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Sem novas concessões</p>}
            </li>
          ))}
          <li>
            <Button variant="plain" size="none" onClick={() => setInsignia("nova")}
              className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-accent hover:text-foreground">
              <Plus className="size-5" aria-hidden />Nova insígnia
            </Button>
          </li>
        </ul>
      </section>

      <section id="campanhas" aria-labelledby="t-campanhas" className="scroll-mt-24 border-t border-border pt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="t-campanhas" className="text-lg font-semibold">Campanhas de recompensa</h2>
            <p className="text-sm text-muted-foreground">Benefício dado a quem conquista uma insígnia. As organizações criam as delas em Recompensas.</p>
          </div>
          <Button variant="outline" onClick={() => setCampanha("nova")}><Plus className="size-4" aria-hidden />Nova campanha</Button>
        </div>
        <div className="mt-3"><ListaCampanhas base={base} campanhas={base.campanhasRecompensa} onEditar={setCampanha} onNova={() => setCampanha("nova")} /></div>
      </section>

      <Correcao />

      <section id="historico" aria-labelledby="t-historico" className="scroll-mt-24 border-t border-border pt-8">
        <h2 id="t-historico" className="text-lg font-semibold">Histórico</h2>
        <div className="mt-3 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="rotulo-tecnico">Conquistas</h3>
            <div className="mt-2 max-h-96 overflow-y-auto border-y border-border">
              <Table className="w-full text-left text-sm">
                <TableHeader><TableRow><TableHead className="rotulo-tecnico px-2 py-2">Data</TableHead><TableHead className="rotulo-tecnico px-2 py-2">Pessoa</TableHead><TableHead className="rotulo-tecnico px-2 py-2">Insígnia</TableHead><TableHead className="rotulo-tecnico px-2 py-2">Situação</TableHead></TableRow></TableHeader>
                <TableBody>
                  {base.concessoesInsignia.map((c) => {
                    const ins = base.insignias.find((i) => i.id === c.insigniaId);
                    return (
                      <TableRow key={c.id} className="border-t border-border">
                        <TableCell className="whitespace-nowrap px-2 py-2 font-mono text-xs text-muted-foreground">{formatarDataBR(c.conquistadaEm)}</TableCell>
                        <TableCell className="px-2 py-2 font-medium">{nome(c.usuarioId)}</TableCell>
                        <TableCell className="px-2 py-2"><span className="inline-flex items-center gap-1.5">{ins && <IconeInsignia icone={ins.icone} size={14} />}{ins?.nome}</span></TableCell>
                        <TableCell className="px-2 py-2">{c.revogadaEm ? <Badge variant="destructive" title={c.motivoRevogacao}>Revogada</Badge> : <Badge variant="success">Ativa</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {base.concessoesInsignia.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nenhuma conquista ainda.</p>}
            </div>
          </div>
          <div>
            <h3 className="rotulo-tecnico">Benefícios e resgates</h3>
            <div className="mt-2 max-h-96 overflow-y-auto border-y border-border">
              <Table className="w-full text-left text-sm">
                <TableHeader><TableRow><TableHead className="rotulo-tecnico px-2 py-2">Pessoa</TableHead><TableHead className="rotulo-tecnico px-2 py-2">Benefício</TableHead><TableHead className="rotulo-tecnico px-2 py-2">Situação</TableHead><TableHead className="rotulo-tecnico px-2 py-2">Observação</TableHead></TableRow></TableHeader>
                <TableBody>
                  {base.vouchers.map((v) => {
                    const st = statusVoucher(v);
                    return (
                      <TableRow key={v.id} className="border-t border-border">
                        <TableCell className="px-2 py-2 font-medium">{nome(v.usuarioId)}</TableCell>
                        <TableCell className="px-2 py-2">{v.beneficio.nome}</TableCell>
                        <TableCell className="px-2 py-2"><Badge variant={st === "disponivel" ? "success" : st === "utilizada" ? "accent" : "secondary"}>{st}</Badge></TableCell>
                        <TableCell className="px-2 py-2 text-xs text-muted-foreground">{v.ocorrencia ?? v.motivo ?? (v.inscricaoId ? `Inscrição ${v.inscricaoId}` : "")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {base.vouchers.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nenhum benefício emitido ainda.</p>}
            </div>
          </div>
        </div>
      </section>

      {insignia && <FormInsignia inicial={insignia === "nova" ? null : insignia} onFechar={() => setInsignia(null)} />}
      {campanha && <FormCampanha base={base} usuario={usuario} inicial={campanha === "nova" ? null : campanha} onFechar={() => setCampanha(null)} />}
    </div>
  );
}
