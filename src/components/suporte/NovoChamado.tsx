// Formulário de abertura de chamado (inline, sem modal: não fecha por clique fora).
import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { abrirChamadoSuporte, type AnexoEnvio } from "@/api/suporte.functions";
import { useSuporte } from "@/contexts/SuporteContext";
import { CATEGORIAS_SUPORTE, TIPOS_ANEXO, protocolo } from "@/lib/suporte";
import type { BaseDados, Chamado } from "@/lib/domain/types";
import { AreaTexto, Botao, Campo, Entrada, Selecao } from "@/components/ui";
import { lerArquivo, validarArquivo } from "./Conversa";

const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export function NovoChamado({ base, usuarioId, eventoInicial, anterior, onCriado, onCancelar }: {
  base: BaseDados; usuarioId: string; eventoInicial?: string | undefined; anterior?: Chamado | undefined;
  onCriado: (id: string) => void; onCancelar: () => void;
}) {
  const { sinalizar } = useSuporte();
  const eventosValidos = new Set(base.inscricoes.filter((i) => i.usuarioId === usuarioId).map((i) => i.eventoId));
  if (eventoInicial) eventosValidos.add(eventoInicial);
  const eventos = base.eventos.filter((e) => eventosValidos.has(e.id));
  const [f, setF] = useState({
    tipo: (anterior ? (anterior.eventoId ? "evento" : "plataforma") : eventoInicial ? "evento" : "plataforma") as "evento" | "plataforma",
    eventoId: anterior?.eventoId ?? eventoInicial ?? "",
    assunto: anterior ? `Continuação: ${anterior.assunto}`.slice(0, 140) : "",
    categoria: anterior?.categoria ?? (eventoInicial ? "Logística" : "Conta"),
    descricao: "",
  });
  const [anexo, setAnexo] = useState<AnexoEnvio | null>(null);
  const [erros, setErros] = useState<{ eventoId?: string; assunto?: string; descricao?: string }>({});
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const clienteId = useRef(novoId()); // mesmo id em cliques repetidos = um chamado só
  const arquivo = useRef<HTMLInputElement>(null);

  const enviar = async () => {
    if (enviando) return;
    const e: { eventoId?: string; assunto?: string; descricao?: string } = {};
    if (f.tipo === "evento" && !f.eventoId) e.eventoId = "Escolha o evento.";
    if (!f.assunto.trim()) e.assunto = "Informe o assunto.";
    if (!f.descricao.trim()) e.descricao = "Descreva a solicitação.";
    setErros(e);
    if (Object.keys(e).length) { document.getElementById(`nc-${Object.keys(e)[0]}`)?.focus(); return; }
    setEnviando(true); setErro("");
    try {
      const c = await abrirChamadoSuporte({
        clienteId: clienteId.current, tipo: f.tipo, eventoId: f.tipo === "evento" ? f.eventoId : undefined,
        assunto: f.assunto, categoria: f.categoria, descricao: f.descricao, vinculadoA: anterior?.id, anexo: anexo ?? undefined,
      });
      sinalizar(c.id);
      onCriado(c.id);
    } catch (er) { setErro(er instanceof Error ? er.message : "Não foi possível abrir o chamado."); } finally { setEnviando(false); }
  };

  return (
    <div className="rolagem-discreta min-h-0 min-w-0 flex-1 p-4">
      <h2 className="font-display text-lg font-semibold">Nova solicitação de suporte</h2>
      {anterior && <p className="mt-1 text-sm text-muted-foreground">Vinculada ao protocolo {protocolo(anterior)}.</p>}
      <div className="mt-4 space-y-3">
        <fieldset>
          <legend className="text-sm font-medium">Tipo de atendimento</legend>
          <div className="mt-1 grid gap-2 @min-[560px]:grid-cols-2">
            {([["evento", "Suporte do evento", "Sobre uma operação: a organização do evento e a administração atendem."], ["plataforma", "Suporte da plataforma", "Conta, funcionamento ou outras questões: só a administração atende."]] as const).map(([v, t, d]) => (
              <label key={v} className={`cursor-pointer rounded-md border p-3 text-sm ${f.tipo === v ? "border-primary bg-primary/10" : "border-border"}`}>
                <input type="radio" name="nc-tipo" className="mr-2" checked={f.tipo === v} disabled={!!anterior} onChange={() => setF({ ...f, tipo: v })} />
                <span className="font-medium">{t}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{d}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {f.tipo === "evento" && (
          <Campo rotulo="Evento" htmlFor="nc-eventoId" erro={erros.eventoId}>
            <Selecao id="nc-eventoId" value={f.eventoId} disabled={!!anterior} onChange={(e) => setF({ ...f, eventoId: e.target.value })}>
              <option value="">Selecione…</option>
              {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Selecao>
          </Campo>
        )}
        <div className="grid gap-3 @min-[560px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Campo rotulo="Assunto" htmlFor="nc-assunto" erro={erros.assunto}>
            <Entrada id="nc-assunto" maxLength={140} value={f.assunto} onChange={(e) => setF({ ...f, assunto: e.target.value })} />
          </Campo>
          <Campo rotulo="Categoria" htmlFor="nc-categoria">
            <Selecao id="nc-categoria" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
              {CATEGORIAS_SUPORTE.map((c) => <option key={c}>{c}</option>)}
            </Selecao>
          </Campo>
        </div>
        <Campo rotulo="Descrição" htmlFor="nc-descricao" erro={erros.descricao}>
          <AreaTexto id="nc-descricao" rows={5} maxLength={4000} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
        </Campo>
        <div>
          <input ref={arquivo} type="file" accept={TIPOS_ANEXO.join(",")} className="sr-only" tabIndex={-1}
            onChange={async (e) => {
              const file = e.target.files?.[0]; e.target.value = "";
              if (!file) return;
              const v = validarArquivo(file);
              if (v) { setErro(v); return; }
              setErro(""); setAnexo({ nome: file.name, dataUrl: await lerArquivo(file) });
            }} />
          {anexo ? (
            <p className="inline-flex max-w-full items-center gap-2 rounded-md border border-border px-2 py-1 text-xs">
              <Paperclip className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 truncate">{anexo.nome}</span>
              <button type="button" className="shrink-0" aria-label="Remover anexo" onClick={() => setAnexo(null)}><X className="h-3.5 w-3.5" /></button>
            </p>
          ) : (
            <Botao type="button" variante="contorno" className="!py-1 text-xs" onClick={() => arquivo.current?.click()}><Paperclip className="h-3.5 w-3.5" />Anexar (opcional)</Botao>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Imagem (JPEG, PNG, WebP) ou PDF, até 5 MB. Não anexe documentos pessoais além do necessário.</p>
        </div>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao type="button" variante="contorno" onClick={onCancelar} disabled={enviando}>Cancelar</Botao>
          <Botao type="button" onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "Abrir chamado"}</Botao>
        </div>
      </div>
    </div>
  );
}
