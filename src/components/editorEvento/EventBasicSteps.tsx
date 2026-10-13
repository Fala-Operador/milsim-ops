import { gerarId } from "@/services/db";
import { AreaTexto, Botao, Campo, Entrada, Selecao } from "@/components/ui";
import { ehModalidade, MODALIDADES } from "@/lib/modalidades";
import { dataUrlParaBlobUrl, pdfParaDataUrl } from "@/lib/imagens";
import type { Ocupacao } from "@/lib/eventoEditor";
import { Ajuda, inval, MsgErro, paraLocal, Secao, type PropsEtapa } from "./comum";

const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const FUSOS = [
  ["America/Sao_Paulo", "Brasília (UTC−3)"],
  ["America/Manaus", "Amazonas (UTC−4)"],
  ["America/Cuiaba", "Mato Grosso (UTC−4)"],
  ["America/Campo_Grande", "Mato Grosso do Sul (UTC−4)"],
  ["America/Rio_Branco", "Acre (UTC−5)"],
  ["America/Noronha", "Fernando de Noronha (UTC−2)"],
] as const;

export function EtapaGeral({ ev, set, erros, organizacoes, podeEscolherOrg }: PropsEtapa & { organizacoes: { id: string; nome: string }[]; podeEscolherOrg: boolean }) {
  return (
    <div className="space-y-4">
      <Campo rotulo="Nome do evento" htmlFor="ev-nome">
        <Entrada id="ev-nome" value={ev.nome} maxLength={200} onChange={(e) => set("nome", e.target.value)} {...inval(erros, "ev-nome")} />
        <MsgErro erros={erros} id="ev-nome" />
      </Campo>
      <Campo rotulo="Modalidade principal" htmlFor="ev-mod">
        <Selecao id="ev-mod" value={ev.modalidade ?? ""} onChange={(e) => set("modalidade", ehModalidade(e.target.value) ? e.target.value : undefined)} {...inval(erros, "ev-mod")}>
          <option value="">Selecione…</option>
          {MODALIDADES.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </Selecao>
        <MsgErro erros={erros} id="ev-mod" />
        <Ajuda>A que melhor representa a operação. Detalhes ficam no caderno de regras.</Ajuda>
      </Campo>
      <Campo rotulo={`Descrição resumida (${ev.descricaoResumida.length}/200)`} htmlFor="ev-desc">
        <Entrada id="ev-desc" maxLength={200} value={ev.descricaoResumida} onChange={(e) => set("descricaoResumida", e.target.value)} {...inval(erros, "ev-desc")} />
        <MsgErro erros={erros} id="ev-desc" />
        <Ajuda>Aparece nos cards da página inicial.</Ajuda>
      </Campo>
      <Campo rotulo="Enredo" htmlFor="ev-enredo">
        <AreaTexto id="ev-enredo" rows={5} value={ev.enredo} onChange={(e) => set("enredo", e.target.value)} {...inval(erros, "ev-enredo")} />
        <MsgErro erros={erros} id="ev-enredo" />
      </Campo>
      <Campo rotulo="Organização responsável" htmlFor="ev-org">
        {podeEscolherOrg ? (
          <Selecao id="ev-org" value={ev.organizacaoId} onChange={(e) => set("organizacaoId", e.target.value)}>
            {organizacoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        ) : (
          <Entrada id="ev-org" readOnly value={organizacoes.find((o) => o.id === ev.organizacaoId)?.nome ?? "—"} />
        )}
      </Campo>
    </div>
  );
}

export function EtapaLocal({ ev, set, erros }: PropsEtapa) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Início" htmlFor="ev-ini">
          <Entrada id="ev-ini" type="datetime-local" value={paraLocal(ev.inicioEm)} onChange={(e) => e.target.value && set("inicioEm", new Date(e.target.value).toISOString())} {...inval(erros, "ev-ini")} />
          <MsgErro erros={erros} id="ev-ini" />
        </Campo>
        <Campo rotulo="Término" htmlFor="ev-fim">
          <Entrada id="ev-fim" type="datetime-local" value={paraLocal(ev.fimEm)} onChange={(e) => e.target.value && set("fimEm", new Date(e.target.value).toISOString())} {...inval(erros, "ev-fim")} />
          <MsgErro erros={erros} id="ev-fim" />
        </Campo>
        <Campo rotulo="Fuso horário" htmlFor="ev-fuso">
          <Selecao id="ev-fuso" value={ev.fuso} onChange={(e) => set("fuso", e.target.value)}>
            {FUSOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            {!FUSOS.some(([v]) => v === ev.fuso) && <option value={ev.fuso}>{ev.fuso}</option>}
          </Selecao>
        </Campo>
      </div>
      <Campo rotulo="Local (nome do campo)" htmlFor="ev-local">
        <Entrada id="ev-local" value={ev.local} onChange={(e) => set("local", e.target.value)} {...inval(erros, "ev-local")} />
        <MsgErro erros={erros} id="ev-local" />
      </Campo>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Campo rotulo="CEP (opcional)" htmlFor="ev-cep">
          <Entrada id="ev-cep" inputMode="numeric" placeholder="00000-000" maxLength={9} value={ev.cep ?? ""} onChange={(e) => set("cep", e.target.value || undefined)} {...inval(erros, "ev-cep")} />
          <MsgErro erros={erros} id="ev-cep" />
        </Campo>
        <Campo rotulo="Endereço" htmlFor="ev-end">
          <Entrada id="ev-end" value={ev.endereco} onChange={(e) => set("endereco", e.target.value)} />
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Campo rotulo="Cidade" htmlFor="ev-cid">
          <Entrada id="ev-cid" value={ev.cidade} onChange={(e) => set("cidade", e.target.value)} {...inval(erros, "ev-cid")} />
          <MsgErro erros={erros} id="ev-cid" />
        </Campo>
        <Campo rotulo="UF" htmlFor="ev-uf">
          <Selecao id="ev-uf" value={ev.uf} onChange={(e) => set("uf", e.target.value)}>
            {UFS.map((u) => <option key={u}>{u}</option>)}
          </Selecao>
        </Campo>
      </div>
    </div>
  );
}

export function EtapaExercitos({ ev, set, erros, ocupacao }: PropsEtapa & { ocupacao: Ocupacao }) {
  const mudar = (i: number, mud: Partial<Evento["exercitos"][number]>) => set("exercitos", ev.exercitos.map((x, j) => (j === i ? { ...x, ...mud } : x)));
  const soma = ev.exercitos.reduce((t, x) => t + (x.capacidade || 0), 0);
  return (
    <div className="space-y-4">
      <Campo rotulo="Capacidade total" htmlFor="ev-cap">
        <Entrada id="ev-cap" type="number" min={Math.max(1, ocupacao.total)} className="max-w-40" value={ev.capacidadeTotal} onChange={(e) => set("capacidadeTotal", Number(e.target.value))} {...inval(erros, "ev-cap")} />
        <MsgErro erros={erros} id="ev-cap" />
        <Ajuda>{ocupacao.total > 0 ? `${ocupacao.total} inscrições confirmadas. ` : ""}Os exércitos somam {soma} vagas.</Ajuda>
      </Campo>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide">Exércitos</h3>
        <Botao type="button" id="ev-ex-add" variante="contorno" onClick={() => set("exercitos", [...ev.exercitos, { id: gerarId("ex"), nome: "", capacidade: 10 }])}>+ Adicionar exército</Botao>
      </div>
      <MsgErro erros={erros} id="ev-ex-add" />
      <ul className="grid gap-3 lg:grid-cols-2">
        {ev.exercitos.map((x, i) => {
          const ocup = ocupacao.porExercito[x.id] ?? 0;
          return (
            <li key={x.id} className="space-y-2 rounded-md border border-border bg-elevated p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                <Campo rotulo="Nome" htmlFor={`ex-nome-${x.id}`}>
                  <Entrada id={`ex-nome-${x.id}`} value={x.nome} onChange={(e) => mudar(i, { nome: e.target.value })} {...inval(erros, `ex-nome-${x.id}`)} />
                  <MsgErro erros={erros} id={`ex-nome-${x.id}`} />
                </Campo>
                <Campo rotulo="Vagas" htmlFor={`ex-cap-${x.id}`}>
                  <Entrada id={`ex-cap-${x.id}`} type="number" min={Math.max(1, ocup)} value={x.capacidade} onChange={(e) => mudar(i, { capacidade: Number(e.target.value) })} {...inval(erros, `ex-cap-${x.id}`)} />
                  <MsgErro erros={erros} id={`ex-cap-${x.id}`} />
                </Campo>
              </div>
              <Campo rotulo="Descrição (opcional)" htmlFor={`ex-desc-${x.id}`}>
                <Entrada id={`ex-desc-${x.id}`} value={x.descricao ?? ""} onChange={(e) => mudar(i, { descricao: e.target.value || undefined })} />
              </Campo>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{ocup > 0 ? `${ocup} inscritos` : "Sem inscritos"}</span>
                <Botao type="button" variante="fantasma" disabled={ocup > 0} title={ocup > 0 ? "Exércitos com inscritos não podem ser removidos" : undefined}
                  onClick={() => set("exercitos", ev.exercitos.filter((_, j) => j !== i))}>Remover</Botao>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function EtapaCronograma({ ev, set, erros, onErroArquivo }: PropsEtapa & { onErroArquivo: (m: string) => void }) {
  const ordenado = [...ev.cronograma].sort((a, b) => a.ordem - b.ordem);
  const gravar = (lista: typeof ordenado) => set("cronograma", lista.map((a, i) => ({ ...a, ordem: i })));
  const mudar = (id: string, mud: Partial<(typeof ordenado)[number]>) => gravar(ordenado.map((a) => (a.id === id ? { ...a, ...mud } : a)));
  const mover = (i: number, d: -1 | 1) => {
    const l = [...ordenado];
    const [x] = l.splice(i, 1);
    l.splice(i + d, 0, x!);
    gravar(l);
  };
  const regras = ev.regras;
  const definirRegras = (mud: Partial<NonNullable<Evento["regras"]>>) =>
    set("regras", { titulo: "Manual de regras", versao: "1", atualizadoEm: new Date().toISOString(), formato: "pdf", ...regras, ...mud });

  return (
    <div className="space-y-4">
      <Secao titulo={`Cronograma (${ordenado.length})`} acao={
        <Botao type="button" id="ev-at-add" variante="contorno"
          onClick={() => gravar([...ordenado, { id: gerarId("at"), data: paraLocal(ev.inicioEm).slice(0, 10), horario: "08:00", titulo: "", descricao: "", ordem: ordenado.length }])}>
          + Adicionar atividade
        </Botao>
      }>
        <MsgErro erros={erros} id="ev-at-add" />
        {ordenado.length === 0 && <p className="text-xs text-muted-foreground">Obrigatório ao menos uma atividade para publicar.</p>}
        <ol className="space-y-3">
          {ordenado.map((a, i) => (
            <li key={a.id} className="space-y-2 rounded-md border border-border p-3">
              <div className="grid gap-2 sm:grid-cols-[9.5rem_6.5rem_minmax(0,1fr)]">
                <Campo rotulo="Data" htmlFor={`at-data-${a.id}`}>
                  <Entrada id={`at-data-${a.id}`} type="date" value={a.data} onChange={(e) => mudar(a.id, { data: e.target.value })} {...inval(erros, `at-data-${a.id}`)} />
                </Campo>
                <Campo rotulo="Horário" htmlFor={`at-hora-${a.id}`}>
                  <Entrada id={`at-hora-${a.id}`} type="time" value={a.horario} onChange={(e) => mudar(a.id, { horario: e.target.value })} />
                </Campo>
                <Campo rotulo="Atividade" htmlFor={`at-titulo-${a.id}`}>
                  <Entrada id={`at-titulo-${a.id}`} value={a.titulo} onChange={(e) => mudar(a.id, { titulo: e.target.value })} {...inval(erros, `at-titulo-${a.id}`)} />
                </Campo>
              </div>
              <MsgErro erros={erros} id={`at-data-${a.id}`} />
              <MsgErro erros={erros} id={`at-titulo-${a.id}`} />
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <Campo rotulo="Descrição" htmlFor={`at-desc-${a.id}`}>
                  <Entrada id={`at-desc-${a.id}`} value={a.descricao} onChange={(e) => mudar(a.id, { descricao: e.target.value })} />
                </Campo>
                <Campo rotulo="Local (opcional)" htmlFor={`at-local-${a.id}`}>
                  <Entrada id={`at-local-${a.id}`} value={a.local ?? ""} onChange={(e) => mudar(a.id, { local: e.target.value || undefined })} />
                </Campo>
              </div>
              <div className="flex justify-end gap-1">
                <Botao type="button" variante="fantasma" disabled={i === 0} aria-label={`Mover ${a.titulo || "atividade"} para cima`} onClick={() => mover(i, -1)}>↑</Botao>
                <Botao type="button" variante="fantasma" disabled={i === ordenado.length - 1} aria-label={`Mover ${a.titulo || "atividade"} para baixo`} onClick={() => mover(i, 1)}>↓</Botao>
                <Botao type="button" variante="fantasma" onClick={() => gravar(ordenado.filter((x) => x.id !== a.id))}>Remover</Botao>
              </div>
            </li>
          ))}
        </ol>
      </Secao>

      <Secao titulo="Caderno de regras" aberta={!!regras}>
        <Ajuda>PDF ou DOCX, até 5 MB. PDFs abrem no leitor interno da página do evento.</Ajuda>
        {regras && (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <Campo rotulo="Título" htmlFor="ev-regras-titulo">
              <Entrada id="ev-regras-titulo" value={regras.titulo} onChange={(e) => definirRegras({ titulo: e.target.value })} {...inval(erros, "ev-regras-titulo")} />
              <MsgErro erros={erros} id="ev-regras-titulo" />
            </Campo>
            <Campo rotulo="Versão" htmlFor="ev-regras-versao">
              <Entrada id="ev-regras-versao" value={regras.versao} onChange={(e) => definirRegras({ versao: e.target.value })} />
            </Campo>
          </div>
        )}
        {regras && (regras.pdfDataUrl || regras.arquivoUrl) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
            <p className="min-w-0 truncate text-xs">{regras.nomeArquivo ?? "manual"} · {regras.formato.toUpperCase()}</p>
            <div className="flex gap-1">
              {regras.pdfDataUrl && (
                <Botao type="button" variante="fantasma" onClick={() => window.open(dataUrlParaBlobUrl(regras.pdfDataUrl!), "_blank", "noopener")}>Pré-visualizar</Botao>
              )}
              <Botao type="button" variante="fantasma" onClick={() => set("regras", undefined)}>Remover</Botao>
            </div>
          </div>
        )}
        <Campo rotulo={regras?.pdfDataUrl || regras?.arquivoUrl ? "Substituir arquivo" : "Arquivo (PDF ou DOCX)"} htmlFor="ev-regras-arquivo">
          <Entrada id="ev-regras-arquivo" type="file" accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={async (e) => {
              const a = e.target.files?.[0];
              e.target.value = "";
              if (!a) return;
              try {
                const docx = a.name.toLowerCase().endsWith(".docx");
                if (docx) {
                  if (a.size > 5 * 1024 * 1024) throw new Error("Arquivo muito grande (máx. 5 MB).");
                  const url = await new Promise<string>((ok, f) => {
                    const r = new FileReader();
                    r.onload = () => ok(String(r.result));
                    r.onerror = () => f(new Error("Não foi possível ler o arquivo."));
                    r.readAsDataURL(a);
                  });
                  definirRegras({ formato: "docx", nomeArquivo: a.name, arquivoUrl: url, pdfDataUrl: undefined, atualizadoEm: new Date().toISOString() });
                } else {
                  definirRegras({ formato: "pdf", nomeArquivo: a.name, pdfDataUrl: await pdfParaDataUrl(a), arquivoUrl: undefined, atualizadoEm: new Date().toISOString() });
                }
              } catch (err) {
                onErroArquivo(err instanceof Error ? err.message : "Falha ao ler o arquivo.");
              }
            }} />
        </Campo>
      </Secao>
    </div>
  );
}

type Evento = PropsEtapa["ev"];
