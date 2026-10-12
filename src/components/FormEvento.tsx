import { useState } from "react";
import { gerarId } from "@/services/db";
import { AreaTexto, Botao, Campo, Entrada, Selecao } from "@/components/ui";
import type { Evento } from "@/lib/domain/types";

const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

function paraLocal(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function eventoVazio(organizacaoId: string): Evento {
  const inicio = new Date(Date.now() + 30 * 86400000);
  inicio.setHours(7, 0, 0, 0);
  const fim = new Date(inicio.getTime() + 11 * 3600000);
  return {
    id: gerarId("evt"),
    organizacaoId,
    nome: "",
    descricaoResumida: "",
    enredo: "",
    inicioEm: inicio.toISOString(),
    fimEm: fim.toISOString(),
    fuso: "America/Sao_Paulo",
    local: "",
    endereco: "",
    cidade: "",
    uf: "SP",
    capacidadeTotal: 50,
    exercitos: [
      { id: gerarId("ex"), nome: "Exército A", capacidade: 25 },
      { id: gerarId("ex"), nome: "Exército B", capacidade: 25 },
    ],
    tipos: [{ id: gerarId("tp"), nome: "Ingresso Padrão", precoBaseCentavos: 10000, quantidadeMaxima: 50 }],
    lotes: [],
    cronograma: [],
    status: "rascunho",
    criadoEm: new Date().toISOString(),
  };
}

export function FormEvento({
  inicial,
  onSalvar,
  onCancelar,
}: {
  inicial: Evento;
  onSalvar: (ev: Evento) => Promise<void>;
  onCancelar: () => void;
}) {
  const [ev, setEv] = useState<Evento>(inicial);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof Evento>(k: K, v: Evento[K]) => setEv((p) => ({ ...p, [k]: v }));

  const salvar = async () => {
    setErro("");
    if (!ev.nome.trim()) return setErro("Informe o nome do evento.");
    if (new Date(ev.fimEm) <= new Date(ev.inicioEm)) return setErro("O término deve ser depois do início.");
    if (ev.exercitos.length === 0) return setErro("Cadastre ao menos um exército.");
    if (ev.tipos.length === 0) return setErro("Cadastre ao menos um tipo de ingresso.");
    setSalvando(true);
    try {
      await onSalvar(ev);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const secao = "rounded-md border border-border bg-elevated p-3 space-y-2";

  return (
    <div className="space-y-4 text-sm">
      <Campo rotulo="Nome do evento" htmlFor="ev-nome">
        <Entrada id="ev-nome" value={ev.nome} onChange={(e) => set("nome", e.target.value)} />
      </Campo>
      <Campo rotulo="Descrição resumida" htmlFor="ev-desc">
        <Entrada id="ev-desc" maxLength={200} value={ev.descricaoResumida} onChange={(e) => set("descricaoResumida", e.target.value)} />
      </Campo>
      <Campo rotulo="Enredo" htmlFor="ev-enredo">
        <AreaTexto id="ev-enredo" rows={3} value={ev.enredo} onChange={(e) => set("enredo", e.target.value)} />
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Início" htmlFor="ev-ini">
          <Entrada id="ev-ini" type="datetime-local" value={paraLocal(ev.inicioEm)} onChange={(e) => e.target.value && set("inicioEm", new Date(e.target.value).toISOString())} />
        </Campo>
        <Campo rotulo="Término" htmlFor="ev-fim">
          <Entrada id="ev-fim" type="datetime-local" value={paraLocal(ev.fimEm)} onChange={(e) => e.target.value && set("fimEm", new Date(e.target.value).toISOString())} />
        </Campo>
        <Campo rotulo="Local (campo)" htmlFor="ev-local">
          <Entrada id="ev-local" value={ev.local} onChange={(e) => set("local", e.target.value)} />
        </Campo>
        <Campo rotulo="Endereço" htmlFor="ev-end">
          <Entrada id="ev-end" value={ev.endereco} onChange={(e) => set("endereco", e.target.value)} />
        </Campo>
        <Campo rotulo="Cidade" htmlFor="ev-cid">
          <Entrada id="ev-cid" value={ev.cidade} onChange={(e) => set("cidade", e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="UF" htmlFor="ev-uf">
            <Selecao id="ev-uf" value={ev.uf} onChange={(e) => set("uf", e.target.value)}>
              {UFS.map((u) => <option key={u}>{u}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Capacidade" htmlFor="ev-cap">
            <Entrada id="ev-cap" type="number" min={1} value={ev.capacidadeTotal} onChange={(e) => set("capacidadeTotal", Number(e.target.value))} />
          </Campo>
        </div>
      </div>

      <div className={secao}>
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Exércitos</h3>
          <Botao variante="fantasma" onClick={() => set("exercitos", [...ev.exercitos, { id: gerarId("ex"), nome: "", capacidade: 10 }])}>+ Adicionar</Botao>
        </div>
        {ev.exercitos.map((x, i) => (
          <div key={x.id} className="flex gap-2">
            <Entrada aria-label="Nome do exército" placeholder="Nome" value={x.nome} onChange={(e) => set("exercitos", ev.exercitos.map((y, j) => (j === i ? { ...y, nome: e.target.value } : y)))} />
            <Entrada aria-label="Capacidade do exército" type="number" min={1} className="w-28" value={x.capacidade} onChange={(e) => set("exercitos", ev.exercitos.map((y, j) => (j === i ? { ...y, capacidade: Number(e.target.value) } : y)))} />
            <Botao variante="fantasma" aria-label="Remover exército" onClick={() => set("exercitos", ev.exercitos.filter((_, j) => j !== i))}>✕</Botao>
          </div>
        ))}
      </div>

      <div className={secao}>
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Tipos de ingresso</h3>
          <Botao variante="fantasma" onClick={() => set("tipos", [...ev.tipos, { id: gerarId("tp"), nome: "", precoBaseCentavos: 0, quantidadeMaxima: 10 }])}>+ Adicionar</Botao>
        </div>
        {ev.tipos.map((t, i) => (
          <div key={t.id} className="grid grid-cols-[1fr_7rem_6rem_auto] gap-2">
            <Entrada aria-label="Nome do ingresso" placeholder="Nome" value={t.nome} onChange={(e) => set("tipos", ev.tipos.map((y, j) => (j === i ? { ...y, nome: e.target.value } : y)))} />
            <Entrada aria-label="Preço em reais" type="number" min={0} step="0.01" value={t.precoBaseCentavos / 100} onChange={(e) => set("tipos", ev.tipos.map((y, j) => (j === i ? { ...y, precoBaseCentavos: Math.round(Number(e.target.value) * 100) } : y)))} />
            <Entrada aria-label="Quantidade máxima" type="number" min={1} value={t.quantidadeMaxima} onChange={(e) => set("tipos", ev.tipos.map((y, j) => (j === i ? { ...y, quantidadeMaxima: Number(e.target.value) } : y)))} />
            <Botao variante="fantasma" aria-label="Remover ingresso" onClick={() => set("tipos", ev.tipos.filter((_, j) => j !== i))}>✕</Botao>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Preço em R$ · quantidade máxima</p>
      </div>

      <div className={secao}>
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Cronograma</h3>
          <Botao
            variante="fantasma"
            onClick={() =>
              set("cronograma", [
                ...ev.cronograma,
                { id: gerarId("at"), data: paraLocal(ev.inicioEm).slice(0, 10), horario: "08:00", titulo: "", descricao: "", ordem: ev.cronograma.length },
              ])
            }
          >
            + Adicionar
          </Botao>
        </div>
        {ev.cronograma.map((a, i) => (
          <div key={a.id} className="grid grid-cols-[9rem_6rem_1fr_auto] gap-2">
            <Entrada aria-label="Data" type="date" value={a.data} onChange={(e) => set("cronograma", ev.cronograma.map((y, j) => (j === i ? { ...y, data: e.target.value } : y)))} />
            <Entrada aria-label="Horário" type="time" value={a.horario} onChange={(e) => set("cronograma", ev.cronograma.map((y, j) => (j === i ? { ...y, horario: e.target.value } : y)))} />
            <Entrada aria-label="Atividade" placeholder="Atividade" value={a.titulo} onChange={(e) => set("cronograma", ev.cronograma.map((y, j) => (j === i ? { ...y, titulo: e.target.value } : y)))} />
            <Botao variante="fantasma" aria-label="Remover atividade" onClick={() => set("cronograma", ev.cronograma.filter((_, j) => j !== i))}>✕</Botao>
          </div>
        ))}
        {ev.cronograma.length === 0 && <p className="text-xs text-muted-foreground">Necessário ao menos uma atividade para publicar.</p>}
      </div>

      {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Botao variante="fantasma" onClick={onCancelar}>Cancelar</Botao>
        <Botao onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar evento"}</Botao>
      </div>
    </div>
  );
}
