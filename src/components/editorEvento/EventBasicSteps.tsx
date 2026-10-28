import { gerarId } from "@/services/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo } from "@/components/ui";
import { ehModalidade, MODALIDADES } from "@/lib/modalidades";
import { dataUrlParaBlobUrl, pdfParaDataUrl } from "@/lib/imagens";
import type { Ocupacao } from "@/lib/eventoEditor";
import { formatarContatoWhatsapp, normalizarContatoWhatsapp } from "@/lib/contatoEvento";
import { mascaraCep } from "@/lib/domain/validators";
import { textoBuscaCep, useBuscaCep } from "@/hooks/useBuscaCep";
import { deCampoNoFuso, paraCampoNoFuso, trocarFuso } from "@/lib/fusoHorario";
import { Ajuda, inval, MsgErro, Secao, type PropsEtapa } from "./comum";

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
        <Input id="ev-nome" value={ev.nome} maxLength={200} onChange={(e) => set("nome", e.target.value)} {...inval(erros, "ev-nome")} />
        <MsgErro erros={erros} id="ev-nome" />
      </Campo>
      <Campo rotulo="Modalidade principal" htmlFor="ev-mod">
        <NativeSelect id="ev-mod" value={ev.modalidade ?? ""} onChange={(e) => set("modalidade", ehModalidade(e.target.value) ? e.target.value : undefined)} {...inval(erros, "ev-mod")}>
          <option value="">Selecione…</option>
          {MODALIDADES.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </NativeSelect>
        <MsgErro erros={erros} id="ev-mod" />
        <Ajuda>A que melhor representa a operação. Detalhes ficam no caderno de regras.</Ajuda>
      </Campo>
      <Campo rotulo={`Descrição resumida (${ev.descricaoResumida.length}/200)`} htmlFor="ev-desc">
        <Input id="ev-desc" maxLength={200} value={ev.descricaoResumida} onChange={(e) => set("descricaoResumida", e.target.value)} {...inval(erros, "ev-desc")} />
        <MsgErro erros={erros} id="ev-desc" />
        <Ajuda>Aparece nos cards da página inicial.</Ajuda>
      </Campo>
      <Campo rotulo="Enredo" htmlFor="ev-enredo">
        <Textarea id="ev-enredo" rows={5} value={ev.enredo} onChange={(e) => set("enredo", e.target.value)} {...inval(erros, "ev-enredo")} />
        <Ajuda>Quebras de linha são mantidas. Use **texto** para negrito e *texto* para itálico.</Ajuda>
        <MsgErro erros={erros} id="ev-enredo" />
      </Campo>
      <Campo rotulo="Organização responsável" htmlFor="ev-org">
        {podeEscolherOrg ? (
          <NativeSelect id="ev-org" value={ev.organizacaoId} onChange={(e) => set("organizacaoId", e.target.value)}>
            {organizacoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </NativeSelect>
        ) : (
          <Input id="ev-org" readOnly value={organizacoes.find((o) => o.id === ev.organizacaoId)?.nome ?? "—"} />
        )}
      </Campo>
      <Secao titulo="Contato no WhatsApp">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="WhatsApp do organizador (opcional)" htmlFor="ev-whats">
            <Input id="ev-whats" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" maxLength={25}
              value={ev.whatsappContato ?? ""}
              onChange={(e) => set("whatsappContato", e.target.value || undefined)}
              onBlur={(e) => { const n = normalizarContatoWhatsapp(e.target.value); if (n) set("whatsappContato", formatarContatoWhatsapp(n)); }}
              {...inval(erros, "ev-whats")} />
            <MsgErro erros={erros} id="ev-whats" />
            <Ajuda>Público: vira o botão “Falar no WhatsApp” na página do evento.</Ajuda>
          </Campo>
          <Campo rotulo="Link do grupo (opcional)" htmlFor="ev-grupo">
            <Input id="ev-grupo" type="url" inputMode="url" placeholder="https://chat.whatsapp.com/…" maxLength={200}
              value={ev.whatsappGrupoUrl ?? ""}
              onChange={(e) => set("whatsappGrupoUrl", e.target.value.trim() || undefined)}
              {...inval(erros, "ev-grupo")} />
            <MsgErro erros={erros} id="ev-grupo" />
            <Ajuda>Só quem tem inscrição confirmada vê o link, em “Meus ingressos” e na página do evento.</Ajuda>
          </Campo>
        </div>
      </Secao>
    </div>
  );
}

export function EtapaLocal({ ev, set, erros }: PropsEtapa) {
  // Datas e horários são digitados no fuso do evento; ao trocar o fuso, a hora digitada se mantém.
  const trocarFusoDoEvento = (fuso: string) => {
    set("inicioEm", trocarFuso(ev.inicioEm, ev.fuso, fuso));
    set("fimEm", trocarFuso(ev.fimEm, ev.fuso, fuso));
    set("lotes", ev.lotes.map((l) => ({ ...l, inicioVendas: trocarFuso(l.inicioVendas, ev.fuso, fuso), fimVendas: trocarFuso(l.fimVendas, ev.fuso, fuso) })));
    set("fuso", fuso);
  };
  // CEP novo preenche endereço, cidade e UF (campos seguem editáveis; vazio do ViaCEP não apaga nada).
  const buscaCep = useBuscaCep(ev.cep, (r) => {
    const endereco = [r.logradouro, r.bairro].filter(Boolean).join(", ");
    if (endereco) set("endereco", endereco);
    if (r.cidade) set("cidade", r.cidade);
    if (UFS.includes(r.uf)) set("uf", r.uf);
  });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Início" htmlFor="ev-ini">
          <Input id="ev-ini" type="datetime-local" value={paraCampoNoFuso(ev.inicioEm, ev.fuso)} onChange={(e) => { const iso = deCampoNoFuso(e.target.value, ev.fuso); if (iso) set("inicioEm", iso); }} {...inval(erros, "ev-ini")} />
          <MsgErro erros={erros} id="ev-ini" />
        </Campo>
        <Campo rotulo="Término" htmlFor="ev-fim">
          <Input id="ev-fim" type="datetime-local" value={paraCampoNoFuso(ev.fimEm, ev.fuso)} onChange={(e) => { const iso = deCampoNoFuso(e.target.value, ev.fuso); if (iso) set("fimEm", iso); }} {...inval(erros, "ev-fim")} />
          <MsgErro erros={erros} id="ev-fim" />
        </Campo>
        <Campo rotulo="Fuso horário" htmlFor="ev-fuso">
          <NativeSelect id="ev-fuso" value={ev.fuso} onChange={(e) => trocarFusoDoEvento(e.target.value)}>
            {FUSOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            {!FUSOS.some(([v]) => v === ev.fuso) && <option value={ev.fuso}>{ev.fuso}</option>}
          </NativeSelect>
        </Campo>
      </div>
      <Campo rotulo="Local (nome do campo)" htmlFor="ev-local">
        <Input id="ev-local" value={ev.local} onChange={(e) => set("local", e.target.value)} {...inval(erros, "ev-local")} />
        <MsgErro erros={erros} id="ev-local" />
      </Campo>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Campo rotulo="CEP (opcional)" htmlFor="ev-cep">
          <Input id="ev-cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9} value={ev.cep ?? ""} onChange={(e) => set("cep", mascaraCep(e.target.value) || undefined)} {...inval(erros, "ev-cep")} />
          <MsgErro erros={erros} id="ev-cep" />
          <p aria-live="polite" className={`mt-1 text-xs ${buscaCep.status === "erro" ? "text-destructive" : "text-muted-foreground"}`}>{textoBuscaCep(buscaCep)}</p>
        </Campo>
        <Campo rotulo="Endereço" htmlFor="ev-end">
          <Input id="ev-end" value={ev.endereco} onChange={(e) => set("endereco", e.target.value)} />
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Campo rotulo="Cidade" htmlFor="ev-cid">
          <Input id="ev-cid" value={ev.cidade} onChange={(e) => set("cidade", e.target.value)} {...inval(erros, "ev-cid")} />
          <MsgErro erros={erros} id="ev-cid" />
        </Campo>
        <Campo rotulo="UF" htmlFor="ev-uf">
          <NativeSelect id="ev-uf" value={ev.uf} onChange={(e) => set("uf", e.target.value)}>
            {UFS.map((u) => <option key={u}>{u}</option>)}
          </NativeSelect>
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
        <Input id="ev-cap" type="number" min={Math.max(1, ocupacao.total)} className="max-w-40" value={ev.capacidadeTotal} onChange={(e) => set("capacidadeTotal", Number(e.target.value))} {...inval(erros, "ev-cap")} />
        <MsgErro erros={erros} id="ev-cap" />
        <Ajuda>{ocupacao.total > 0 ? `${ocupacao.total} inscrições confirmadas. ` : ""}Os exércitos somam {soma} vagas.</Ajuda>
      </Campo>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide">Exércitos</h3>
        <Button type="button" id="ev-ex-add" variant="outline" onClick={() => set("exercitos", [...ev.exercitos, { id: gerarId("ex"), nome: "", capacidade: 10 }])}>+ Adicionar exército</Button>
      </div>
      <MsgErro erros={erros} id="ev-ex-add" />
      <ul className="grid gap-3 lg:grid-cols-2">
        {ev.exercitos.map((x, i) => {
          const ocup = ocupacao.porExercito[x.id] ?? 0;
          return (
            <li key={x.id} className="space-y-2 rounded-md border border-border bg-elevated p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                <Campo rotulo="Nome" htmlFor={`ex-nome-${x.id}`}>
                  <Input id={`ex-nome-${x.id}`} value={x.nome} onChange={(e) => mudar(i, { nome: e.target.value })} {...inval(erros, `ex-nome-${x.id}`)} />
                  <MsgErro erros={erros} id={`ex-nome-${x.id}`} />
                </Campo>
                <Campo rotulo="Vagas" htmlFor={`ex-cap-${x.id}`}>
                  <Input id={`ex-cap-${x.id}`} type="number" min={Math.max(1, ocup)} value={x.capacidade} onChange={(e) => mudar(i, { capacidade: Number(e.target.value) })} {...inval(erros, `ex-cap-${x.id}`)} />
                  <MsgErro erros={erros} id={`ex-cap-${x.id}`} />
                </Campo>
              </div>
              <Campo rotulo="Descrição (opcional)" htmlFor={`ex-desc-${x.id}`}>
                <Input id={`ex-desc-${x.id}`} value={x.descricao ?? ""} onChange={(e) => mudar(i, { descricao: e.target.value || undefined })} />
              </Campo>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{ocup > 0 ? `${ocup} inscritos` : "Sem inscritos"}</span>
                <Button type="button" variant="ghost" disabled={ocup > 0} title={ocup > 0 ? "Exércitos com inscritos não podem ser removidos" : undefined}
                  onClick={() => set("exercitos", ev.exercitos.filter((_, j) => j !== i))}>Remover</Button>
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
        <Button type="button" id="ev-at-add" variant="outline"
          onClick={() => gravar([...ordenado, { id: gerarId("at"), data: paraCampoNoFuso(ev.inicioEm, ev.fuso).slice(0, 10), horario: "08:00", titulo: "", descricao: "", ordem: ordenado.length }])}>
          + Adicionar atividade
        </Button>
      }>
        <MsgErro erros={erros} id="ev-at-add" />
        {ordenado.length === 0 && <p className="text-xs text-muted-foreground">Obrigatório ao menos uma atividade para publicar.</p>}
        <ol className="space-y-3">
          {ordenado.map((a, i) => (
            <li key={a.id} className="space-y-2 rounded-md border border-border p-3">
              <div className="grid gap-2 sm:grid-cols-[9.5rem_6.5rem_minmax(0,1fr)]">
                <Campo rotulo="Data" htmlFor={`at-data-${a.id}`}>
                  <Input id={`at-data-${a.id}`} type="date" value={a.data} onChange={(e) => mudar(a.id, { data: e.target.value })} {...inval(erros, `at-data-${a.id}`)} />
                </Campo>
                <Campo rotulo="Horário" htmlFor={`at-hora-${a.id}`}>
                  <Input id={`at-hora-${a.id}`} type="time" value={a.horario} onChange={(e) => mudar(a.id, { horario: e.target.value })} {...inval(erros, `at-data-${a.id}`)} />
                </Campo>
                <Campo rotulo="Atividade" htmlFor={`at-titulo-${a.id}`}>
                  <Input id={`at-titulo-${a.id}`} value={a.titulo} onChange={(e) => mudar(a.id, { titulo: e.target.value })} {...inval(erros, `at-titulo-${a.id}`)} />
                </Campo>
              </div>
              <MsgErro erros={erros} id={`at-data-${a.id}`} />
              <MsgErro erros={erros} id={`at-titulo-${a.id}`} />
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <Campo rotulo="Descrição" htmlFor={`at-desc-${a.id}`}>
                  <Input id={`at-desc-${a.id}`} value={a.descricao} onChange={(e) => mudar(a.id, { descricao: e.target.value })} />
                </Campo>
                <Campo rotulo="Local (opcional)" htmlFor={`at-local-${a.id}`}>
                  <Input id={`at-local-${a.id}`} value={a.local ?? ""} onChange={(e) => mudar(a.id, { local: e.target.value || undefined })} />
                </Campo>
              </div>
              <div className="flex justify-end gap-1">
                <Button type="button" variant="ghost" disabled={i === 0} aria-label={`Mover ${a.titulo || "atividade"} para cima`} onClick={() => mover(i, -1)}>↑</Button>
                <Button type="button" variant="ghost" disabled={i === ordenado.length - 1} aria-label={`Mover ${a.titulo || "atividade"} para baixo`} onClick={() => mover(i, 1)}>↓</Button>
                <Button type="button" variant="ghost" onClick={() => gravar(ordenado.filter((x) => x.id !== a.id))}>Remover</Button>
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
              <Input id="ev-regras-titulo" value={regras.titulo} onChange={(e) => definirRegras({ titulo: e.target.value })} {...inval(erros, "ev-regras-titulo")} />
              <MsgErro erros={erros} id="ev-regras-titulo" />
            </Campo>
            <Campo rotulo="Versão" htmlFor="ev-regras-versao">
              <Input id="ev-regras-versao" value={regras.versao} onChange={(e) => definirRegras({ versao: e.target.value })} />
            </Campo>
          </div>
        )}
        {regras && (regras.pdfDataUrl || regras.arquivoUrl) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
            <p className="min-w-0 truncate text-xs">{regras.nomeArquivo ?? "manual"} · {regras.formato.toUpperCase()}</p>
            <div className="flex gap-1">
              {regras.pdfDataUrl && (
                <Button type="button" variant="ghost" onClick={() => window.open(dataUrlParaBlobUrl(regras.pdfDataUrl!), "_blank", "noopener")}>Pré-visualizar</Button>
              )}
              <Button type="button" variant="ghost" onClick={() => set("regras", undefined)}>Remover</Button>
            </div>
          </div>
        )}
        <Campo rotulo={regras?.pdfDataUrl || regras?.arquivoUrl ? "Substituir arquivo" : "Arquivo (PDF ou DOCX)"} htmlFor="ev-regras-arquivo">
          <Input id="ev-regras-arquivo" type="file" accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
