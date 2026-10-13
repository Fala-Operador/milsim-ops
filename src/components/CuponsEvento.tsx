// Gestão de cupons de uma operação: lista com situação e painel de criação/edição.
import { useEffect, useMemo, useState } from "react";
import { atualizarCupom, criarCupom } from "@/api/organizador.functions";
import { formatarDataBR } from "@/lib/domain/money";
import { normalizarCodigoCupom, resumoCupom, situacaoCupom, validarDadosCupom, type DadosCupom, type SituacaoCupom } from "@/lib/vendas";
import { Badge, Botao, Campo, Entrada, Selecao } from "@/components/ui";
import type { Cupom, Evento } from "@/lib/domain/types";

const TOM: Record<SituacaoCupom, "sucesso" | "aviso" | "perigo" | "padrao"> = {
  ativo: "sucesso", agendado: "aviso", expirado: "padrao", esgotado: "perigo", inativo: "padrao",
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
      setAviso(`Cupom ${c.codigo} ${c.ativo ? "desativado" : "reativado"}.`);
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Não foi possível alterar o cupom.");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold uppercase">Cupons de desconto</h3>
          <p className="text-sm text-muted-foreground">Crie códigos promocionais para esta operação.</p>
        </div>
        <Botao onClick={() => { setAviso(""); setPainel({ cupom: null }); }}>Criar cupom</Botao>
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
                  <Botao variante="fantasma" aria-label={`Copiar código ${c.codigo}`} onClick={() => { navigator.clipboard?.writeText(c.codigo); setCopiado(c.id); }}>
                    {copiado === c.id ? "Copiado" : "Copiar"}
                  </Botao>
                  <Badge tom={TOM[sit]}>{sit}</Badge>
                </span>
                <span className="flex gap-1">
                  <Botao variante="fantasma" onClick={() => { setAviso(""); setPainel({ cupom: c }); }}>Editar</Botao>
                  <Botao variante="fantasma" onClick={() => alternarAtivo(c)}>{c.ativo ? "Desativar" : "Reativar"}</Botao>
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.descontoPercentual}% · {c.limiteUsos === null ? `${c.usos} utilizações (sem limite)` : `${c.usos} de ${c.limiteUsos} utilizações`} ·{" "}
                {formatarDataBR(c.validoDe)} até {c.validoAte ? formatarDataBR(c.validoAte) : "sem data de término"} ·{" "}
                {todos ? "todos os ingressos" : c.tiposElegiveis.map(nomeTipo).join(", ")}
              </p>
            </li>
          );
        })}
        {cupons.length === 0 && <li className="text-sm text-muted-foreground">Nenhum cupom criado para esta operação.</li>}
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
        e.limiteUsos = `O limite não pode ser menor que as ${cupom.usos} utilizações já feitas.`;
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
        onSalvo(`Cupom ${cupom.codigo} atualizado. Inscrições anteriores mantêm o desconto já aplicado.`);
      } else {
        await criarCupom({ ...dados, eventoId: evento.id });
        onSalvo(`Cupom ${normalizarCodigoCupom(dados.codigo)} criado.`);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o cupom.");
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="dialog" aria-modal="true" aria-label={cupom ? "Editar cupom" : "Criar cupom"} onClick={onFechar}>
      <div className="flex h-full w-full flex-col overflow-y-auto border-l border-border bg-popover p-5 text-popover-foreground shadow-xl sm:max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">{cupom ? `Editar cupom ${cupom.codigo}` : "Criar cupom"}</h2>
            <p className="text-sm text-muted-foreground">Operação: <strong className="text-foreground">{evento.nome}</strong></p>
          </div>
          <Botao variante="fantasma" onClick={onFechar} aria-label="Fechar">✕</Botao>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo rotulo="Código do cupom" htmlFor="cp-codigo" erro={mostrar("codigo")}>
              <Entrada id="cp-codigo" value={cupom ? cupom.codigo : f.codigo} disabled={!!cupom} placeholder="Ex.: FALAOPERADOR" autoComplete="off"
                onChange={(e) => set("codigo", e.target.value)} />
              {cupom && <p className="text-xs text-muted-foreground">O código não muda depois de criado, para preservar o histórico.</p>}
            </Campo>
          </div>
          <Campo rotulo="Desconto (%)" htmlFor="cp-desc" erro={mostrar("descontoPercentual")}>
            <div className="relative">
              <Entrada id="cp-desc" type="number" inputMode="numeric" min={1} max={100} step={1} placeholder="Ex.: 15" className="pr-8"
                value={f.desconto} onChange={(e) => set("desconto", e.target.value)} />
              <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            </div>
          </Campo>
          <Campo rotulo="Limite total de utilizações" htmlFor="cp-lim" erro={mostrar("limiteUsos")}>
            <Entrada id="cp-lim" type="number" inputMode="numeric" min={1} step={1} placeholder="Ex.: 10" disabled={f.semLimite}
              value={f.semLimite ? "" : f.limite} onChange={(e) => set("limite", e.target.value)} />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={f.semLimite} onChange={(e) => set("semLimite", e.target.checked)} /> Sem limite de utilizações
            </label>
          </Campo>
          <Campo rotulo="Início da validade" htmlFor="cp-ini" erro={mostrar("validoDe")}>
            <Entrada id="cp-ini" type="datetime-local" value={f.inicio} onChange={(e) => set("inicio", e.target.value)} />
          </Campo>
          <Campo rotulo="Fim da validade" htmlFor="cp-fim" erro={mostrar("validoAte")}>
            <Entrada id="cp-fim" type="datetime-local" disabled={f.semFim} value={f.semFim ? "" : f.fim} onChange={(e) => set("fim", e.target.value)} />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={f.semFim} onChange={(e) => set("semFim", e.target.checked)} /> Sem data de término
            </label>
          </Campo>
          <div className="sm:col-span-2">
            <Campo rotulo="Tipos de ingresso elegíveis" htmlFor="cp-tipos" erro={mostrar("tiposElegiveis")}>
              <Selecao id="cp-tipos" value={f.todosTipos ? "todos" : "selecao"} onChange={(e) => set("todosTipos", e.target.value === "todos")}>
                <option value="todos">Todos os ingressos</option>
                <option value="selecao">Seleção específica</option>
              </Selecao>
              {!f.todosTipos && (
                <div className="mt-2 space-y-1">
                  {tipos.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={f.tipos.includes(t.id)}
                        onChange={(e) => set("tipos", e.target.checked ? [...f.tipos, t.id] : f.tipos.filter((x) => x !== t.id))} />
                      {t.nome}
                    </label>
                  ))}
                </div>
              )}
            </Campo>
          </div>
          <Campo rotulo="Status" htmlFor="cp-status">
            <Selecao id="cp-status" value={f.ativo ? "ativo" : "inativo"} onChange={(e) => set("ativo", e.target.value === "ativo")}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </Selecao>
          </Campo>
        </div>

        <div className="mt-5 rounded-md border border-border bg-elevated p-3 text-sm">
          <p className="text-xs font-medium uppercase text-muted-foreground">Resumo</p>
          <p className="mt-1">
            {resumoCupom(
              { codigo: cupom?.codigo ?? f.codigo, descontoPercentual: Number(f.desconto) || 0, limiteUsos: f.semLimite ? null : Number(f.limite) || 0 },
              f.todosTipos,
            )}
          </p>
        </div>

        {erro && <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
        {tentou && Object.keys(erros).length > 0 && <p role="alert" className="mt-3 text-sm text-destructive">Corrija os campos destacados.</p>}

        <div className="mt-auto flex justify-end gap-2 pt-5">
          <Botao variante="contorno" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : cupom ? "Salvar alterações" : "Criar cupom"}</Botao>
        </div>
      </div>
    </div>
  );
}
