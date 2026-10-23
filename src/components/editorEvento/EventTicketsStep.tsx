import { useState } from "react";
import { gerarId } from "@/services/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Campo } from "@/components/ui";
import type { Evento, Lote } from "@/lib/domain/types";
import { situacaoIngresso, TEXTO_SITUACAO, type SituacaoIngresso } from "@/lib/eventoEditor";
import type { OcupacaoLote } from "@/lib/vendas";
import { deCampoNoFuso, paraCampoNoFuso } from "@/lib/fusoHorario";
import { inval, MsgErro, Secao, type PropsEtapa } from "./comum";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const TOM: Record<SituacaoIngresso, "success" | "accent" | "warning" | "secondary" | "destructive"> = {
  disponivel: "success", agendado: "accent", sem_lote: "warning", encerrado: "secondary", esgotado: "destructive",
};

function CamposLote({ ev, lote, onChange, erros }: { ev: Evento; lote: Lote; onChange: (l: Lote) => void; erros: Record<string, string> }) {
  const m = (mud: Partial<Lote>) => onChange({ ...lote, ...mud });
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Campo rotulo="Nome do lote" htmlFor={`lt-nome-${lote.id}`}>
          <Input id={`lt-nome-${lote.id}`} value={lote.nome} onChange={(e) => m({ nome: e.target.value })} {...inval(erros, `lt-nome-${lote.id}`)} />
        </Campo>
        <Campo rotulo="Situação" htmlFor={`lt-st-${lote.id}`}>
          <NativeSelect id={`lt-st-${lote.id}`} value={lote.status} onChange={(e) => m({ status: e.target.value as Lote["status"] })}>
            <option value="ativo">Ativo</option>
            <option value="encerrado">Encerrado</option>
            <option value="arquivado">Arquivado</option>
          </NativeSelect>
        </Campo>
        <Campo rotulo="Início das vendas" htmlFor={`lt-ini-${lote.id}`}>
          <Input id={`lt-ini-${lote.id}`} type="datetime-local" value={paraCampoNoFuso(lote.inicioVendas, ev.fuso)} onChange={(e) => { const iso = deCampoNoFuso(e.target.value, ev.fuso); if (iso) m({ inicioVendas: iso }); }} />
        </Campo>
        <Campo rotulo="Fim das vendas" htmlFor={`lt-fim-${lote.id}`}>
          <Input id={`lt-fim-${lote.id}`} type="datetime-local" value={paraCampoNoFuso(lote.fimVendas, ev.fuso)} onChange={(e) => { const iso = deCampoNoFuso(e.target.value, ev.fuso); if (iso) m({ fimVendas: iso }); }} {...inval(erros, `lt-fim-${lote.id}`)} />
        </Campo>
      </div>
      <MsgErro erros={erros} id={`lt-nome-${lote.id}`} />
      <MsgErro erros={erros} id={`lt-fim-${lote.id}`} />
      <p className="text-xs font-medium">Ingressos neste lote</p>
      {ev.tipos.filter((t) => !t.arquivado).map((t) => {
        const item = lote.itens.find((it) => it.tipoId === t.id);
        const atualizar = (mud: Partial<Lote["itens"][number]>) => m({ itens: lote.itens.map((it) => (it.tipoId === t.id ? { ...it, ...mud } : it)) });
        return (
          <div key={t.id} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
            <Label className="flex min-w-0 items-center gap-2 text-sm font-normal text-inherit">
              <Checkbox checked={!!item}
                onCheckedChange={(marcado) => m({ itens: marcado === true ? [...lote.itens, { tipoId: t.id, precoCentavos: t.precoBaseCentavos, quantidade: t.quantidadeMaxima }] : lote.itens.filter((it) => it.tipoId !== t.id) })} />
              <span className="truncate">{t.nome || "Ingresso sem nome"}</span>
            </Label>
            {item && (
              <>
                <Campo rotulo="Preço (R$)" htmlFor={`lt-pr-${lote.id}-${t.id}`}>
                  <Input id={`lt-pr-${lote.id}-${t.id}`} type="number" min={0} step="0.01" value={item.precoCentavos / 100} onChange={(e) => atualizar({ precoCentavos: Math.round(Number(e.target.value) * 100) })} {...inval(erros, `lt-pr-${lote.id}-${t.id}`)} />
                </Campo>
                <Campo rotulo="Vagas no lote" htmlFor={`lt-qt-${lote.id}-${t.id}`}>
                  <Input id={`lt-qt-${lote.id}-${t.id}`} type="number" min={1} value={item.quantidade} onChange={(e) => atualizar({ quantidade: Number(e.target.value) })} {...inval(erros, `lt-qt-${lote.id}-${t.id}`)} />
                </Campo>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EtapaIngressos({ ev, set, erros, ocupacaoLote }: PropsEtapa & { ocupacaoLote: OcupacaoLote }) {
  const [novo, setNovo] = useState<Lote | null>(null);
  const sugerirLote = (): Lote => {
    const fimEvento = new Date(ev.inicioEm);
    return {
      id: gerarId("lt"),
      nome: `${ev.lotes.length + 1}º lote`,
      inicioVendas: new Date().toISOString(),
      fimVendas: (fimEvento.getTime() > Date.now() ? fimEvento : new Date(Date.now() + 30 * 86400000)).toISOString(),
      status: "ativo",
      itens: ev.tipos.filter((t) => !t.arquivado).map((t) => ({ tipoId: t.id, precoCentavos: t.precoBaseCentavos, quantidade: t.quantidadeMaxima })),
    };
  };
  const mudarTipo = (i: number, mud: Partial<Evento["tipos"][number]>) => set("tipos", ev.tipos.map((t, j) => (j === i ? { ...t, ...mud } : t)));

  return (
    <div className="space-y-4">
      <Secao titulo={`Tipos de ingresso (${ev.tipos.length})`} acao={
        <Button type="button" id="ev-tp-add" variant="outline" onClick={() => set("tipos", [...ev.tipos, { id: gerarId("tp"), nome: "", precoBaseCentavos: 0, quantidadeMaxima: 10 }])}>+ Adicionar ingresso</Button>
      }>
        <MsgErro erros={erros} id="ev-tp-add" />
        <ul className="space-y-3">
          {ev.tipos.map((t, i) => {
            const s = situacaoIngresso(ev, t.id, ocupacaoLote);
            return (
              <li key={t.id} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={TOM[s]}>{TEXTO_SITUACAO[s]}</Badge>
                  <Button type="button" variant="ghost" onClick={() => set("tipos", ev.tipos.filter((_, j) => j !== i))}>Remover</Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
                  <Campo rotulo="Nome" htmlFor={`tp-nome-${t.id}`}>
                    <Input id={`tp-nome-${t.id}`} value={t.nome} onChange={(e) => mudarTipo(i, { nome: e.target.value })} {...inval(erros, `tp-nome-${t.id}`)} />
                  </Campo>
                  <Campo rotulo="Preço base (R$)" htmlFor={`tp-preco-${t.id}`}>
                    <Input id={`tp-preco-${t.id}`} type="number" min={0} step="0.01" value={t.precoBaseCentavos / 100} onChange={(e) => mudarTipo(i, { precoBaseCentavos: Math.round(Number(e.target.value) * 100) })} {...inval(erros, `tp-preco-${t.id}`)} />
                  </Campo>
                  <Campo rotulo="Quantidade" htmlFor={`tp-qt-${t.id}`}>
                    <Input id={`tp-qt-${t.id}`} type="number" min={1} value={t.quantidadeMaxima} onChange={(e) => mudarTipo(i, { quantidadeMaxima: Number(e.target.value) })} {...inval(erros, `tp-qt-${t.id}`)} />
                  </Campo>
                </div>
                <MsgErro erros={erros} id={`tp-nome-${t.id}`} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Campo rotulo="Descrição" htmlFor={`tp-desc-${t.id}`}>
                    <Input id={`tp-desc-${t.id}`} value={t.descricao ?? ""} onChange={(e) => mudarTipo(i, { descricao: e.target.value || undefined })} />
                  </Campo>
                  <Campo rotulo="Benefícios" htmlFor={`tp-ben-${t.id}`}>
                    <Input id={`tp-ben-${t.id}`} placeholder="Ex.: patch, almoço, camiseta" value={t.beneficios ?? ""} onChange={(e) => mudarTipo(i, { beneficios: e.target.value || undefined })} />
                  </Campo>
                </div>
              </li>
            );
          })}
        </ul>
      </Secao>

      <Secao titulo={`Lotes de venda (${ev.lotes.length})`} acao={
        ev.lotes.length > 0 && !novo ? <Button type="button" id="ev-lt-add" variant="outline" onClick={() => setNovo(sugerirLote())}>+ Adicionar lote</Button> : undefined
      }>
        <p className="text-xs text-muted-foreground">
          As inscrições só abrem para ingressos incluídos em um lote ativo, dentro do período de vendas e com vagas. O preço cobrado é o do lote.
        </p>
        {ev.lotes.length === 0 && !novo && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <p>Nenhum lote configurado: ninguém conseguirá se inscrever.</p>
            <Button type="button" id="ev-lt-add" className="mt-2" disabled={ev.tipos.length === 0} onClick={() => setNovo(sugerirLote())}>Criar primeiro lote</Button>
            {ev.tipos.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Cadastre um tipo de ingresso antes.</p>}
          </div>
        )}
        {novo && (
          <fieldset className="space-y-3 rounded-md border-2 border-primary/60 p-3">
            <legend className="px-1 text-xs font-semibold uppercase">Novo lote — revise os valores sugeridos</legend>
            <CamposLote ev={ev} lote={novo} onChange={setNovo} erros={{}} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setNovo(null)}>Cancelar</Button>
              <Button type="button" disabled={novo.itens.length === 0 || !novo.nome.trim()} onClick={() => { set("lotes", [...ev.lotes, novo]); setNovo(null); }}>Criar lote</Button>
            </div>
          </fieldset>
        )}
        {ev.lotes.map((l, i) => (
          <fieldset key={l.id} className="space-y-2 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-medium">{l.nome || "Lote sem nome"}</legend>
            <CamposLote ev={ev} lote={l} erros={erros} onChange={(nl) => set("lotes", ev.lotes.map((x, j) => (j === i ? nl : x)))} />
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => set("lotes", ev.lotes.filter((_, j) => j !== i))}>Remover lote</Button>
            </div>
          </fieldset>
        ))}
      </Secao>
    </div>
  );
}
