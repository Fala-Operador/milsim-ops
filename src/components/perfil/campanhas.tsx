// Formulário e lista de campanhas de recompensa (administração e organização).
import { useState } from "react";
import { salvarCampanha } from "@/api/gamificacao.functions";
import { descreverBeneficio, statusVoucher } from "@/lib/participacao";
import { formatarDataBR } from "@/lib/domain/money";
import type { BaseDados, CampanhaRecompensa, TipoBeneficio, Usuario } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo, EstadoVazio, Modal } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { tr } from "@/i18n/components/perfil/campanhas";

const paraLocal = (iso: string) => iso.slice(0, 16);
const deLocal = (v: string) => (v ? new Date(v).toISOString() : "");

export function FormCampanha({ base, usuario, inicial, organizacaoFixa, onFechar }: {
  base: BaseDados; usuario: Usuario; inicial: CampanhaRecompensa | null; organizacaoFixa?: string | undefined; onFechar: () => void;
}) {
  const hoje = new Date();
  const em = (d: number) => new Date(hoje.getTime() + d * 864e5).toISOString();
  const [c, setC] = useState({
    nome: inicial?.nome ?? "", descricao: inicial?.descricao ?? "", insigniaId: inicial?.insigniaId ?? base.insignias[0]?.id ?? "",
    organizacaoId: inicial?.organizacaoId ?? organizacaoFixa ?? base.organizacoes[0]?.id ?? "",
    tipo: inicial?.tipo ?? ("percentual" as TipoBeneficio), valor: inicial?.valor ?? 10,
    eventosElegiveis: inicial?.eventosElegiveis ?? [], tiposElegiveis: inicial?.tiposElegiveis ?? [],
    maximo: inicial?.maximo ?? 50, limitePorParticipante: inicial?.limitePorParticipante ?? 1,
    inicioEm: inicial?.inicioEm ?? hoje.toISOString(), conquistarAte: inicial?.conquistarAte ?? em(90), resgatarAte: inicial?.resgatarAte ?? em(180),
    regras: inicial?.regras ?? tr("valido_para_um_ingresso_nao_acumula"),
    aceitaAnteriores: inicial?.aceitaAnteriores ?? false, ativa: inicial?.ativa ?? true, autorizacao: inicial?.autorizacao ?? "",
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const eventos = base.eventos.filter((e) => e.organizacaoId === c.organizacaoId && ["publicado", "inscricoes_encerradas"].includes(e.status));
  const tipos = base.eventos.filter((e) => c.eventosElegiveis.includes(e.id)).flatMap((e) => e.tipos.map((t) => ({ ...t, evento: e.nome })));
  const alternar = (lista: string[], id: string) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  const precisaAutorizacao = usuario.perfil === "admin" && usuario.organizacaoId !== c.organizacaoId;

  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      await salvarCampanha({ ...c, id: inicial?.id, valor: c.tipo === "fixo" ? Math.round(c.valor) : c.valor, autorizacao: c.autorizacao || undefined });
      onFechar();
    } catch (e) { setErro(e instanceof Error ? e.message : tr("nao_foi_possivel_salvar")); } finally { setSalvando(false); }
  };

  return (
    <Modal aberto largo titulo={inicial ? tr("editar_campanha_versao_versao", { versao: inicial.versao }) : tr("nova_campanha_de_recompensa")} onFechar={onFechar}>
      <div className="grid gap-3 md:grid-cols-2">
        <Campo rotulo={tr("nome")} htmlFor="cp-nome"><Input id="cp-nome" value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} /></Campo>
        <Campo rotulo={tr("conquista_necessaria")} htmlFor="cp-ins">
          <NativeSelect id="cp-ins" value={c.insigniaId} onChange={(e) => setC({ ...c, insigniaId: e.target.value })}>
            {base.insignias.map((i) => <option key={i.id} value={i.id}>{i.icone} {i.nome}</option>)}
          </NativeSelect>
        </Campo>
        <div className="md:col-span-2"><Campo rotulo={tr("descricao")} htmlFor="cp-desc"><Textarea id="cp-desc" rows={2} value={c.descricao} onChange={(e) => setC({ ...c, descricao: e.target.value })} /></Campo></div>
        <Campo rotulo={tr("organizacao_responsavel_pelo_beneficio")} htmlFor="cp-org">
          <NativeSelect id="cp-org" value={c.organizacaoId} disabled={!!organizacaoFixa} onChange={(e) => setC({ ...c, organizacaoId: e.target.value, eventosElegiveis: [], tiposElegiveis: [] })}>
            {base.organizacoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </NativeSelect>
        </Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo={tr("beneficio")} htmlFor="cp-tipo">
            <NativeSelect id="cp-tipo" value={c.tipo} onChange={(e) => setC({ ...c, tipo: e.target.value as TipoBeneficio })}>
              <option value="percentual">{tr("desconto")}</option><option value="fixo">{tr("desconto_fixo")}</option><option value="gratuito">{tr("ingresso_gratuito")}</option>
            </NativeSelect>
          </Campo>
          {c.tipo !== "gratuito" && (
            <Campo rotulo={c.tipo === "percentual" ? tr("percentual") : tr("valor_r")} htmlFor="cp-valor">
              <Input id="cp-valor" type="number" min={1} value={c.tipo === "fixo" ? c.valor / 100 : c.valor}
                onChange={(e) => setC({ ...c, valor: c.tipo === "fixo" ? Math.round(Number(e.target.value) * 100) : Number(e.target.value) })} />
            </Campo>
          )}
        </div>
        {precisaAutorizacao && (
          <div className="md:col-span-2">
            <Campo rotulo={tr("referencia_da_oferta_autorizada_pela_org")} htmlFor="cp-aut">
              <Input id="cp-aut" value={c.autorizacao} onChange={(e) => setC({ ...c, autorizacao: e.target.value })} placeholder={tr("ex_e_mail_de_10_10")} />
            </Campo>
            <p className="mt-1 text-xs text-muted-foreground">{tr("a_administracao_nao_pode_criar_obrigacao")}</p>
          </div>
        )}
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium">{tr("eventos_elegiveis")}</legend>
          {eventos.length === 0 ? <p className="text-xs text-muted-foreground">{tr("nenhum_evento_aberto_desta_organizacao")}</p> : (
            <div className="mt-1 grid gap-1 sm:grid-cols-2">
              {eventos.map((e) => (
                <Label key={e.id} className="flex items-center gap-2 text-sm font-normal text-inherit">
                  <Checkbox checked={c.eventosElegiveis.includes(e.id)} onCheckedChange={() => setC({ ...c, eventosElegiveis: alternar(c.eventosElegiveis, e.id) })} /> {e.nome}
                </Label>
              ))}
            </div>
          )}
        </fieldset>
        {tipos.length > 0 && (
          <fieldset className="md:col-span-2">
            <legend className="text-sm font-medium">{tr("tipos_de_ingresso_elegiveis")}{" "}<span className="font-normal text-muted-foreground">{tr("nenhum_marcado_todos")}</span></legend>
            <div className="mt-1 grid gap-1 sm:grid-cols-2">
              {tipos.map((t) => (
                <Label key={t.id} className="flex items-center gap-2 text-sm font-normal text-inherit">
                  <Checkbox checked={c.tiposElegiveis.includes(t.id)} onCheckedChange={() => setC({ ...c, tiposElegiveis: alternar(c.tiposElegiveis, t.id) })} /> {t.nome} <span className="text-xs text-muted-foreground">({t.evento})</span>
                </Label>
              ))}
            </div>
          </fieldset>
        )}
        <Campo rotulo={tr("quantidade_maxima_de_beneficios")} htmlFor="cp-max"><Input id="cp-max" type="number" min={1} value={c.maximo} onChange={(e) => setC({ ...c, maximo: Number(e.target.value) })} /></Campo>
        <Campo rotulo={tr("limite_por_participante")} htmlFor="cp-lim"><Input id="cp-lim" type="number" min={1} max={10} value={c.limitePorParticipante} onChange={(e) => setC({ ...c, limitePorParticipante: Number(e.target.value) })} /></Campo>
        <Campo rotulo={tr("inicio_da_campanha")} htmlFor="cp-ini"><Input id="cp-ini" type="datetime-local" value={paraLocal(c.inicioEm)} onChange={(e) => setC({ ...c, inicioEm: deLocal(e.target.value) })} /></Campo>
        <Campo rotulo={tr("prazo_para_conquistar")} htmlFor="cp-conq"><Input id="cp-conq" type="datetime-local" value={paraLocal(c.conquistarAte)} onChange={(e) => setC({ ...c, conquistarAte: deLocal(e.target.value) })} /></Campo>
        <Campo rotulo={tr("prazo_para_resgatar")} htmlFor="cp-resg"><Input id="cp-resg" type="datetime-local" value={paraLocal(c.resgatarAte)} onChange={(e) => setC({ ...c, resgatarAte: deLocal(e.target.value) })} /></Campo>
        <div className="space-y-2 pt-6 text-sm">
          <Label className="flex items-center gap-2 text-[length:inherit] font-normal text-inherit"><Checkbox checked={c.aceitaAnteriores} onCheckedChange={(marcado) => setC({ ...c, aceitaAnteriores: marcado === true })} />{" "}{tr("aceita_conquistas_anteriores_ao_inicio")}</Label>
          <Label className="flex items-center gap-2 text-[length:inherit] font-normal text-inherit"><Checkbox checked={c.ativa} onCheckedChange={(marcado) => setC({ ...c, ativa: marcado === true })} />{" "}{tr("campanha_ativa")}</Label>
        </div>
        <div className="md:col-span-2"><Campo rotulo={tr("regras_de_uso")} htmlFor="cp-regras"><Textarea id="cp-regras" rows={2} value={c.regras} onChange={(e) => setC({ ...c, regras: e.target.value })} /></Campo></div>
      </div>
      {inicial && <p className="mt-2 text-xs text-muted-foreground">{tr("beneficios_ja_emitidos_mantem_as_condico")}</p>}
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onFechar}>{tr("cancelar")}</Button>
        <Button onClick={salvar} disabled={salvando}>{salvando ? tr("salvando") : tr("salvar_campanha")}</Button>
      </div>
    </Modal>
  );
}

export function ListaCampanhas({ base, campanhas, onEditar, onNova }: { base: BaseDados; campanhas: CampanhaRecompensa[]; onEditar: (c: CampanhaRecompensa) => void; onNova?: () => void }) {
  if (!campanhas.length) return (
    <EstadoVazio titulo={tr("nenhuma_campanha_ainda")}
      descricao={tr("crie_uma_campanha_para_dar_um")}
      acao={onNova && <Button onClick={onNova}>{tr("criar_a_primeira_campanha")}</Button>} />
  );
  return (
    <ul className="divide-y divide-border border-y border-border">
      {campanhas.map((c) => {
        const vs = base.vouchers.filter((v) => v.campanhaId === c.id);
        const usados = vs.filter((v) => v.status === "utilizada").length;
        const disp = vs.filter((v) => statusVoucher(v) === "disponivel").length;
        const ins = base.insignias.find((i) => i.id === c.insigniaId);
        const pct = c.maximo > 0 ? Math.min(100, Math.round((vs.length / c.maximo) * 100)) : 0;
        return (
          <li key={c.id} className={`grid gap-4 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-center ${c.ativa ? "" : "opacity-70"}`}>
            <div className="flex min-w-0 gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-md border border-dashed border-accent/60 text-2xl" aria-hidden>{ins?.icone ?? "★"}</span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">{c.nome}<Badge variant={c.ativa ? "success" : "secondary"}>{c.ativa ? tr("ativa") : tr("inativa")}</Badge><span className="font-mono text-[11px] text-muted-foreground">v{c.versao}</span></p>
                <p className="mt-0.5 text-accent">{descreverBeneficio(c)}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{tr("insignia_valor_resgate_ate_resgatarate", { valor: ins?.nome ?? "—", resgatarAte: formatarDataBR(c.resgatarAte) })}{c.aceitaAnteriores ? ` ${tr("aceita_conquistas_anteriores")}` : ""}
                </p>
              </div>
            </div>
            <div>
              <div className="flex justify-between font-mono text-[11px] text-muted-foreground"><span>{tr("emitidos")}</span><span className="tabular-nums">{vs.length}/{c.maximo}</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden><div className="h-full bg-accent" style={{ width: `${pct}%` }} /></div>
              <p className="mt-1 text-xs text-muted-foreground">{tr("disp_disponiveis_usados_usados", { disp, usados })}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEditar(c)}>{tr("editar")}</Button>
          </li>
        );
      })}
    </ul>
  );
}
