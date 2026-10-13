import { useEffect, useRef, useState } from "react";
import { gerarId } from "@/services/db";
import { AreaTexto, Botao, Campo, Entrada, Selecao } from "@/components/ui";
import type { Evento, Lote } from "@/lib/domain/types";
import { pdfParaDataUrl } from "@/lib/imagens";
import { ehModalidade, MODALIDADES } from "@/lib/modalidades";

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
  focarLotes = false,
}: {
  focarLotes?: boolean;
  inicial: Evento;
  onSalvar: (ev: Evento) => Promise<void>;
  onCancelar: () => void;
}) {
  const [ev, setEv] = useState<Evento>(inicial);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [tituloRegras, setTituloRegras] = useState(inicial.regras?.titulo ?? "");
  const [versaoRegras, setVersaoRegras] = useState(inicial.regras?.versao ?? "1");
  const [pdf, setPdf] = useState<{ dataUrl: string; nome: string } | null>(
    inicial.regras?.pdfDataUrl ? { dataUrl: inicial.regras.pdfDataUrl, nome: inicial.regras.nomeArquivo ?? "manual.pdf" } : null,
  );
  const set = <K extends keyof Evento>(k: K, v: Evento[K]) => setEv((p) => ({ ...p, [k]: v }));
  const refLotes = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focarLotes) refLotes.current?.scrollIntoView({ block: "start" });
  }, [focarLotes]);
  const setLote = (i: number, mud: Partial<Lote>) => set("lotes", ev.lotes.map((l, j) => (j === i ? { ...l, ...mud } : l)));
  const novoLote = (): Lote => {
    const fim = new Date(ev.inicioEm);
    return {
      id: gerarId("lt"),
      nome: `${ev.lotes.length + 1}º lote`,
      inicioVendas: new Date().toISOString(),
      fimVendas: (fim.getTime() > Date.now() ? fim : new Date(Date.now() + 30 * 86400000)).toISOString(),
      status: "ativo",
      itens: ev.tipos.filter((t) => !t.arquivado).map((t) => ({ tipoId: t.id, precoCentavos: t.precoBaseCentavos, quantidade: t.quantidadeMaxima })),
    };
  };

  const salvar = async () => {
    setErro("");
    if (!ev.nome.trim()) return setErro("Informe o nome do evento.");
    if (new Date(ev.fimEm) <= new Date(ev.inicioEm)) return setErro("O término deve ser depois do início.");
    if (ev.exercitos.length === 0) return setErro("Cadastre ao menos um exército.");
    if (ev.tipos.length === 0) return setErro("Cadastre ao menos um tipo de ingresso.");
    for (const l of ev.lotes) {
      if (!l.nome.trim()) return setErro("Dê um nome a cada lote de venda.");
      if (new Date(l.fimVendas) <= new Date(l.inicioVendas)) return setErro(`No ${l.nome}, o fim das vendas deve ser depois do início.`);
      if (l.itens.length === 0) return setErro(`O ${l.nome} precisa incluir pelo menos um tipo de ingresso.`);
      if (l.itens.some((it) => it.quantidade < 1 || it.precoCentavos < 0 || !ev.tipos.some((t) => t.id === it.tipoId))) {
        return setErro(`Revise preço e quantidade dos ingressos do ${l.nome}.`);
      }
    }
    const proximo: Evento = { ...ev };
    proximo.regras = pdf
      ? {
          titulo: tituloRegras.trim() || "Manual de regras",
          versao: versaoRegras.trim() || "1",
          atualizadoEm: new Date().toISOString(),
          formato: "pdf",
          nomeArquivo: pdf.nome,
          pdfDataUrl: pdf.dataUrl,
        }
      : undefined;
    setSalvando(true);
    try {
      await onSalvar(proximo);
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
      <Campo rotulo="Modalidade principal" htmlFor="ev-mod">
        <Selecao id="ev-mod" value={ev.modalidade ?? ""} aria-describedby="ev-mod-ajuda"
          onChange={(e) => set("modalidade", ehModalidade(e.target.value) ? e.target.value : undefined)}>
          <option value="">Selecione…</option>
          {MODALIDADES.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </Selecao>
        <p id="ev-mod-ajuda" className="mt-1 text-xs text-muted-foreground">
          Selecione a modalidade que melhor representa esta operação. Detalhe as regras específicas no caderno de regras.
          {ev.status !== "rascunho" && !ev.modalidade && " Obrigatória para publicar."}
        </p>
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

      <div className={secao} ref={refLotes} id="ev-lotes">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Lotes de venda</h3>
          <Botao variante="fantasma" onClick={() => set("lotes", [...ev.lotes, novoLote()])}>+ Adicionar lote</Botao>
        </div>
        <p className="text-xs text-muted-foreground">
          As inscrições só abrem para tipos de ingresso incluídos em um lote ativo, dentro do período de vendas e com vagas. O preço cobrado é o do lote.
        </p>
        {ev.lotes.length === 0 && (
          <p role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            Nenhum lote configurado: ninguém conseguirá se inscrever até que um lote seja criado.
          </p>
        )}
        {ev.lotes.map((l, i) => (
          <fieldset key={l.id} className="space-y-2 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-medium">{l.nome || "Lote sem nome"}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <Campo rotulo="Nome do lote" htmlFor={`lt-nome-${l.id}`}>
                <Entrada id={`lt-nome-${l.id}`} value={l.nome} onChange={(e) => setLote(i, { nome: e.target.value })} />
              </Campo>
              <Campo rotulo="Situação" htmlFor={`lt-st-${l.id}`}>
                <Selecao id={`lt-st-${l.id}`} value={l.status} onChange={(e) => setLote(i, { status: e.target.value as Lote["status"] })}>
                  <option value="ativo">Ativo</option>
                  <option value="encerrado">Encerrado</option>
                  <option value="arquivado">Arquivado</option>
                </Selecao>
              </Campo>
              <Campo rotulo="Início das vendas" htmlFor={`lt-ini-${l.id}`}>
                <Entrada id={`lt-ini-${l.id}`} type="datetime-local" value={paraLocal(l.inicioVendas)} onChange={(e) => e.target.value && setLote(i, { inicioVendas: new Date(e.target.value).toISOString() })} />
              </Campo>
              <Campo rotulo="Fim das vendas" htmlFor={`lt-fim-${l.id}`}>
                <Entrada id={`lt-fim-${l.id}`} type="datetime-local" value={paraLocal(l.fimVendas)} onChange={(e) => e.target.value && setLote(i, { fimVendas: new Date(e.target.value).toISOString() })} />
              </Campo>
            </div>
            <p className="text-xs font-medium">Ingressos neste lote</p>
            {ev.tipos.filter((t) => !t.arquivado).map((t) => {
              const item = l.itens.find((it) => it.tipoId === t.id);
              const atualizarItem = (mud: Partial<Lote["itens"][number]>) =>
                setLote(i, { itens: l.itens.map((it) => (it.tipoId === t.id ? { ...it, ...mud } : it)) });
              return (
                <div key={t.id} className="grid items-end gap-2 sm:grid-cols-[1fr_8rem_8rem]">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!item}
                      onChange={(e) =>
                        setLote(i, {
                          itens: e.target.checked
                            ? [...l.itens, { tipoId: t.id, precoCentavos: t.precoBaseCentavos, quantidade: t.quantidadeMaxima }]
                            : l.itens.filter((it) => it.tipoId !== t.id),
                        })
                      }
                    />
                    {t.nome || "Ingresso sem nome"}
                  </label>
                  {item && (
                    <>
                      <Campo rotulo="Preço (R$)" htmlFor={`lt-pr-${l.id}-${t.id}`}>
                        <Entrada id={`lt-pr-${l.id}-${t.id}`} type="number" min={0} step="0.01" value={item.precoCentavos / 100} onChange={(e) => atualizarItem({ precoCentavos: Math.round(Number(e.target.value) * 100) })} />
                      </Campo>
                      <Campo rotulo="Vagas no lote" htmlFor={`lt-qt-${l.id}-${t.id}`}>
                        <Entrada id={`lt-qt-${l.id}-${t.id}`} type="number" min={1} value={item.quantidade} onChange={(e) => atualizarItem({ quantidade: Number(e.target.value) })} />
                      </Campo>
                    </>
                  )}
                </div>
              );
            })}
            <Botao variante="fantasma" onClick={() => set("lotes", ev.lotes.filter((_, j) => j !== i))}>Remover lote</Botao>
          </fieldset>
        ))}
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

      <div className={secao}>
        <h3 className="font-medium">Manual de regras (PDF)</h3>
        <p className="text-xs text-muted-foreground">
          Envie o caderno de regras em PDF. Ele aparece na página pública do evento e os participantes leem dentro da
          plataforma, sem precisar baixar.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
          <Campo rotulo="Título do manual" htmlFor="ev-regras-titulo">
            <Entrada
              id="ev-regras-titulo"
              placeholder="Caderno de regras — Operação Serra Verde"
              value={tituloRegras}
              onChange={(e) => setTituloRegras(e.target.value)}
            />
          </Campo>
          <Campo rotulo="Versão" htmlFor="ev-regras-versao">
            <Entrada id="ev-regras-versao" placeholder="1" value={versaoRegras} onChange={(e) => setVersaoRegras(e.target.value)} />
          </Campo>
        </div>
        {pdf ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
            <p className="truncate text-xs">
              📄 {pdf.nome}
            </p>
            <Botao variante="fantasma" onClick={() => setPdf(null)}>Remover PDF</Botao>
          </div>
        ) : (
          <Campo rotulo="Arquivo PDF (máx. 5 MB)" htmlFor="ev-regras-pdf">
            <Entrada
              id="ev-regras-pdf"
              type="file"
              accept="application/pdf"
              onChange={async (e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (!arquivo) return;
                try {
                  setPdf({ dataUrl: await pdfParaDataUrl(arquivo), nome: arquivo.name });
                  setErro("");
                } catch (err) {
                  setErro(err instanceof Error ? err.message : "Falha ao ler o PDF.");
                }
              }}
            />
          </Campo>
        )}
        <p className="text-xs text-muted-foreground">Sem PDF anexado, o evento fica sem manual de regras.</p>
      </div>

      {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Botao variante="fantasma" onClick={onCancelar}>Cancelar</Botao>
        <Botao onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar evento"}</Botao>
      </div>
    </div>
  );
}
