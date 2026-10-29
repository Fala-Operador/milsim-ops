// Gestão de cupons de uma operação: lista com situação e painel de criação/edição.
import { useEffect, useMemo, useState } from "react";
import { atualizarCupom, criarCupom } from "@/api/organizador.functions";
import { formatarDataBR } from "@/lib/domain/money";
import { normalizarCodigoCupom, resumoCupom, situacaoCupom, validarDadosCupom, type DadosCupom, type SituacaoCupom } from "@/lib/vendas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Campo } from "@/components/ui";
import type { Cupom, Evento } from "@/lib/domain/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { tr } from "@/i18n/components/CuponsEvento";

const ROTULO_SITUACAO: Record<SituacaoCupom, string> = {
  get ativo() { return tr("situacao_ativo"); }, get agendado() { return tr("situacao_agendado"); }, get expirado() { return tr("situacao_expirado"); },
  get esgotado() { return tr("situacao_esgotado"); }, get inativo() { return tr("situacao_inativo"); },
};

const TOM: Record<SituacaoCupom, "success" | "warning" | "destructive" | "secondary"> = {
  ativo: "success", agendado: "warning", expirado: "secondary", esgotado: "destructive", inativo: "secondary",
};

function paraLocal(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface Formulario {
  codigo: string; desconto: string; limite: string; semLimite: boolean;
  inicio: string; fim: string; semFim: boolean; todosTipos: boolean; tipos: string[]; ativo: boolean;
}

function formVazio(evento: Evento): Formulario {
  return {
    codigo: "", desconto: "", limite: "", semLimite: false,
    inicio: paraLocal(new Date().toISOString()), fim: paraLocal(evento.inicioEm), semFim: false,
    todosTipos: true, tipos: [], ativo: true,
  };
}

function formDoCupom(c: Cupom, evento: Evento): Formulario {
  const todos = evento.tipos.every((t) => t.arquivado || c.tiposElegiveis.includes(t.id));
  return {
    codigo: c.codigo, desconto: String(c.descontoPercentual), limite: c.limiteUsos === null ? "" : String(c.limiteUsos),
    semLimite: c.limiteUsos === null, inicio: paraLocal(c.validoDe), fim: c.validoAte ? paraLocal(c.validoAte) : "",
    semFim: c.validoAte === null, todosTipos: todos, tipos: c.tiposElegiveis, ativo: c.ativo,
  };
}

function paraDados(f: Formulario, evento: Evento): DadosCupom {
  const tiposAtivos = evento.tipos.filter((t) => !t.arquivado).map((t) => t.id);
  return {
    codigo: f.codigo,
    descontoPercentual: f.desconto === "" ? NaN : Number(f.desconto),
    limiteUsos: f.semLimite ? null : f.limite === "" ? NaN : Number(f.limite),
    validoDe: f.inicio ? new Date(f.inicio).toISOString() : "",
    validoAte: f.semFim ? null : f.fim ? new Date(f.fim).toISOString() : "invalida",
    tiposElegiveis: f.todosTipos ? tiposAtivos : f.tipos,
    ativo: f.ativo,
  };
}

export function CuponsEvento({ evento, cupons }: { evento: Evento; cupons: Cupom[] }) {
  const [painel, setPainel] = useState<{ cupom: Cupom | null } | null>(null);
  const [aviso, setAviso] = useState("");
  const [copiado, setCopiado] = useState("");
  const [erroAcao, setErroAcao] = useState("");
  const nomeTipo = (id: string) => evento.tipos.find((t) => t.id === id)?.nome ?? "—";

  useEffect(() => { setPainel(null); setAviso(""); setErroAcao(""); }, [evento.id]);

  const alternarAtivo = async (c: Cupom) => {
    setErroAcao(""); setAviso("");
    try {
      await atualizarCupom(c.id, { descontoPercentual: c.descontoPercentual, limiteUsos: c.limiteUsos, validoDe: c.validoDe, validoAte: c.validoAte, tiposElegiveis: c.tiposElegiveis, ativo: !c.ativo });
      setAviso(tr(c.ativo ? "cupom_desativado" : "cupom_reativado", { codigo: c.codigo }));
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : tr("nao_foi_possivel_alterar_o_cupom"));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold uppercase">{tr("cupons_de_desconto")}</h3>
          <p className="text-sm text-muted-foreground">{tr("crie_codigos_promocionais_para_esta_oper")}</p>
        </div>
        <Button onClick={() => { setAviso(""); setPainel({ cupom: null }); }}>{tr("criar_cupom")}</Button>
      </div>
      {aviso && <p role="status" className="mt-3 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">{aviso}</p>}
      {erroAcao && <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erroAcao}</p>}

      <ul className="mt-3 space-y-2 text-sm">
        {cupons.map((c) => {
          const sit = situacaoCupom(c);
          const todos = evento.tipos.every((t) => t.arquivado || c.tiposElegiveis.includes(t.id));
          return (
            <li key={c.id} className="rounded-md border border-border bg-elevated px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{c.codigo}</span>
                  <Button variant="ghost" aria-label={tr("copiar_codigo_codigo", { codigo: c.codigo })} onClick={() => { navigator.clipboard?.writeText(c.codigo); setCopiado(c.id); }}>
                    {copiado === c.id ? tr("copiado") : tr("copiar")}
                  </Button>
                  <Badge variant={TOM[sit]}>{ROTULO_SITUACAO[sit]}</Badge>
                </span>
                <span className="flex gap-1">
                  <Button variant="ghost" onClick={() => { setAviso(""); setPainel({ cupom: c }); }}>{tr("editar")}</Button>
                  <Button variant="ghost" onClick={() => alternarAtivo(c)}>{c.ativo ? tr("desativar") : tr("reativar")}</Button>
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.descontoPercentual}% · {c.limiteUsos === null ? tr("usos_utilizacoes_sem_limite", { usos: c.usos }) : tr("usos_de_limiteusos_utilizacoes", { usos: c.usos, limiteUsos: c.limiteUsos })}{" "}{tr("validode_ate", { validoDe: formatarDataBR(c.validoDe) })}{" "}{c.validoAte ? formatarDataBR(c.validoAte) : tr("sem_data_de_termino")} ·{" "}
                {todos ? tr("todos_os_ingressos") : c.tiposElegiveis.map(nomeTipo).join(", ")}
              </p>
            </li>
          );
        })}
        {cupons.length === 0 && <li className="text-sm text-muted-foreground">{tr("nenhum_cupom_criado_para_esta_operacao")}</li>}
      </ul>

      {painel && (
        <PainelCupom
          evento={evento}
          cupom={painel.cupom}
          codigosExistentes={cupons.map((c) => c.codigo)}
          onFechar={() => setPainel(null)}
          onSalvo={(msg) => { setPainel(null); setAviso(msg); }}
        />
      )}
    </div>
  );
}

function PainelCupom({
  evento, cupom, codigosExistentes, onFechar, onSalvo,
}: {
  evento: Evento; cupom: Cupom | null; codigosExistentes: string[]; onFechar: () => void; onSalvo: (msg: string) => void;
}) {
  const [f, setF] = useState<Formulario>(() => (cupom ? formDoCupom(cupom, evento) : formVazio(evento)));
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((p) => ({ ...p, [k]: v }));
  const tipos = evento.tipos.filter((t) => !t.arquivado);
  const dados = paraDados(f, evento);
  const erros = useMemo(
    () => {
      const e = validarDadosCupom(cupom ? { ...dados, codigo: cupom.codigo } : dados, {
        codigosExistentes: cupom ? [] : codigosExistentes,
        tiposDoEvento: tipos.map((t) => t.id),
      });
      if (cupom && dados.limiteUsos !== null && Number.isInteger(dados.limiteUsos) && dados.limiteUsos < cupom.usos) {
        e.limiteUsos = tr("o_limite_nao_pode_ser_menor", { usos: cupom.usos });
      }
      return e;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f, cupom, codigosExistentes],
  );
  const mostrar = (k: keyof DadosCupom) => (tentou ? erros[k] : undefined);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  const salvar = async () => {
    setTentou(true);
    setErro("");
    if (Object.keys(erros).length > 0 || salvando) return;
    setSalvando(true);
    try {
      if (cupom) {
        const { codigo: _c, ...resto } = dados;
        await atualizarCupom(cupom.id, resto);
        onSalvo(tr("cupom_codigo_atualizado_inscricoes_anter", { codigo: cupom.codigo }));
      } else {
        await criarCupom({ ...dados, eventoId: evento.id });
        onSalvo(tr("cupom_codigo_criado", { codigo: normalizarCodigoCupom(dados.codigo) }));
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : tr("nao_foi_possivel_salvar_o_cupom"));
      setSalvando(false);
    }
  };

  return (
    <Sheet open onOpenChange={(aberto) => !aberto && onFechar()}>
      <SheetContent side="right" showCloseButton={false} className="flex w-full flex-col gap-0 overflow-y-auto border-border p-5 sm:max-w-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <SheetTitle>{cupom ? tr("editar_cupom_codigo", { codigo: cupom.codigo }) : tr("criar_cupom")}</SheetTitle>
            <SheetDescription>{tr("operacao")}{" "}<strong className="text-foreground">{evento.nome}</strong></SheetDescription>
          </div>
          <Button variant="ghost" onClick={onFechar} aria-label={tr("fechar")}>✕</Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo rotulo={tr("codigo_do_cupom")} htmlFor="cp-codigo" erro={mostrar("codigo")}>
              <Input id="cp-codigo" value={cupom ? cupom.codigo : f.codigo} disabled={!!cupom} placeholder={tr("ex_falaoperador")} autoComplete="off"
                onChange={(e) => set("codigo", e.target.value)} />
              {cupom && <p className="text-xs text-muted-foreground">{tr("o_codigo_nao_muda_depois_de")}</p>}
            </Campo>
          </div>
          <Campo rotulo={tr("desconto")} htmlFor="cp-desc" erro={mostrar("descontoPercentual")}>
            <div className="relative">
              <Input id="cp-desc" type="number" inputMode="numeric" min={1} max={100} step={1} placeholder={tr("ex_15")} className="pr-8"
                value={f.desconto} onChange={(e) => set("desconto", e.target.value)} />
              <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            </div>
          </Campo>
          <Campo rotulo={tr("limite_total_de_utilizacoes")} htmlFor="cp-lim" erro={mostrar("limiteUsos")}>
            <Input id="cp-lim" type="number" inputMode="numeric" min={1} step={1} placeholder={tr("ex_10")} disabled={f.semLimite}
              value={f.semLimite ? "" : f.limite} onChange={(e) => set("limite", e.target.value)} />
            <Label className="flex items-center gap-2 text-xs font-normal text-inherit">
              <Checkbox checked={f.semLimite} onCheckedChange={(marcado) => set("semLimite", marcado === true)} />{" "}{tr("sem_limite_de_utilizacoes")}</Label>
          </Campo>
          <Campo rotulo={tr("inicio_da_validade")} htmlFor="cp-ini" erro={mostrar("validoDe")}>
            <Input id="cp-ini" type="datetime-local" value={f.inicio} onChange={(e) => set("inicio", e.target.value)} />
          </Campo>
          <Campo rotulo={tr("fim_da_validade")} htmlFor="cp-fim" erro={mostrar("validoAte")}>
            <Input id="cp-fim" type="datetime-local" disabled={f.semFim} value={f.semFim ? "" : f.fim} onChange={(e) => set("fim", e.target.value)} />
            <Label className="flex items-center gap-2 text-xs font-normal text-inherit">
              <Checkbox checked={f.semFim} onCheckedChange={(marcado) => set("semFim", marcado === true)} />{" "}{tr("sem_data_de_termino_2")}</Label>
          </Campo>
          <div className="sm:col-span-2">
            <Campo rotulo={tr("tipos_de_ingresso_elegiveis")} htmlFor="cp-tipos" erro={mostrar("tiposElegiveis")}>
              <NativeSelect id="cp-tipos" value={f.todosTipos ? "todos" : "selecao"} onChange={(e) => set("todosTipos", e.target.value === "todos")}>
                <option value="todos">{tr("todos_os_ingressos_2")}</option>
                <option value="selecao">{tr("selecao_especifica")}</option>
              </NativeSelect>
              {!f.todosTipos && (
                <div className="mt-2 space-y-1">
                  {tipos.map((t) => (
                    <Label key={t.id} className="flex items-center gap-2 text-sm font-normal text-inherit">
                      <Checkbox checked={f.tipos.includes(t.id)}
                        onCheckedChange={(marcado) => set("tipos", marcado === true ? [...f.tipos, t.id] : f.tipos.filter((x) => x !== t.id))} />
                      {t.nome}
                    </Label>
                  ))}
                </div>
              )}
            </Campo>
          </div>
          <Campo rotulo={tr("status")} htmlFor="cp-status">
            <NativeSelect id="cp-status" value={f.ativo ? "ativo" : "inativo"} onChange={(e) => set("ativo", e.target.value === "ativo")}>
              <option value="ativo">{tr("ativo")}</option>
              <option value="inativo">{tr("inativo")}</option>
            </NativeSelect>
          </Campo>
        </div>

        <div className="mt-5 rounded-md border border-border bg-elevated p-3 text-sm">
          <p className="text-xs font-medium uppercase text-muted-foreground">{tr("resumo")}</p>
          <p className="mt-1">
            {resumoCupom(
              { codigo: cupom?.codigo ?? f.codigo, descontoPercentual: Number(f.desconto) || 0, limiteUsos: f.semLimite ? null : Number(f.limite) || 0 },
              f.todosTipos,
            )}
          </p>
        </div>

        {erro && <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
        {tentou && Object.keys(erros).length > 0 && <p role="alert" className="mt-3 text-sm text-destructive">{tr("corrija_os_campos_destacados")}</p>}

        <div className="mt-auto flex justify-end gap-2 pt-5">
          <Button variant="outline" onClick={onFechar}>{tr("cancelar")}</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? tr("salvando") : cupom ? tr("salvar_alteracoes") : tr("criar_cupom")}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
