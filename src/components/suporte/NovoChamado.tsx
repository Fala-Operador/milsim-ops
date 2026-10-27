// Formulário de abertura de chamado (inline, sem modal: não fecha por clique fora).
import { useRef, useState } from "react";
import { CalendarDays, LifeBuoy, Paperclip, Upload, X } from "lucide-react";
import { abrirChamadoSuporte, type AnexoEnvio } from "@/api/suporte.functions";
import { useSuporte } from "@/contexts/SuporteContext";
import { CATEGORIAS_SUPORTE, TIPOS_ANEXO, protocolo } from "@/lib/suporte";
import type { BaseDados, Chamado } from "@/lib/domain/types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo } from "@/components/ui";
import { lerArquivo, validarArquivo } from "./Conversa";
import { Label } from "@/components/ui/label";

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
    <div className="rolagem-discreta min-h-0 min-w-0 flex-1 p-4 @min-[760px]:p-6">
      <p className="rotulo-tecnico">Novo chamado</p>
      <h2 className="mt-1 font-display text-2xl font-bold uppercase leading-tight">Como podemos ajudar?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {anterior ? <>Continuação do protocolo <span className="font-mono">{protocolo(anterior)}</span>.</> : "Conte o que aconteceu. A administração responde por aqui e avisa você nas notificações."}
      </p>
      <div className="mt-4 space-y-3.5">
        <fieldset>
          <legend className="text-sm font-medium">Tipo de atendimento</legend>
          <RadioGroup className="mt-1 grid gap-2 @min-[560px]:grid-cols-2" value={f.tipo} disabled={!!anterior} onValueChange={(v) => setF({ ...f, tipo: v as typeof f.tipo })}>
            {([["evento", "Suporte do evento", "Sobre uma operação: a organização do evento e a administração atendem.", CalendarDays], ["plataforma", "Suporte da plataforma", "Conta, funcionamento ou outras questões: só a administração atende.", LifeBuoy]] as const).map(([v, t, d, Icone]) => (
              <Label key={v} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm font-normal text-inherit ${f.tipo === v ? "border-accent ring-1 ring-accent" : "border-border hover:border-muted-foreground/60"}`}>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${f.tipo === v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`} aria-hidden="true"><Icone className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{d}</span>
                </span>
                <RadioGroupItem value={v} className="mt-0.5" />
              </Label>
            ))}
          </RadioGroup>
        </fieldset>
        {f.tipo === "evento" && (
          <Campo rotulo="Evento" htmlFor="nc-eventoId" erro={erros.eventoId}>
            <NativeSelect id="nc-eventoId" value={f.eventoId} disabled={!!anterior} onChange={(e) => setF({ ...f, eventoId: e.target.value })}>
              <option value="">Selecione…</option>
              {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </NativeSelect>
          </Campo>
        )}
        <div className="grid gap-3 @min-[560px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Campo rotulo="Assunto" htmlFor="nc-assunto" erro={erros.assunto}>
            <Input id="nc-assunto" maxLength={140} value={f.assunto} onChange={(e) => setF({ ...f, assunto: e.target.value })} />
          </Campo>
          <Campo rotulo="Categoria" htmlFor="nc-categoria">
            <NativeSelect id="nc-categoria" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
              {CATEGORIAS_SUPORTE.map((c) => <option key={c}>{c}</option>)}
            </NativeSelect>
          </Campo>
        </div>
        <Campo rotulo="Descrição" htmlFor="nc-descricao" erro={erros.descricao}>
          <Textarea id="nc-descricao" rows={4} maxLength={4000} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
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
              <Button variant="plain" size="none" type="button" className="shrink-0" aria-label="Remover anexo" onClick={() => setAnexo(null)}><X className="h-3.5 w-3.5" /></Button>
            </p>
          ) : (
            <Button type="button" variant="plain" size="none" onClick={() => arquivo.current?.click()}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-3 text-left text-sm hover:border-muted-foreground/60 hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-ring">
              <Upload className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0"><span className="block font-medium">Anexar imagem ou PDF <span className="font-normal text-muted-foreground">(opcional)</span></span>
              <span className="block text-xs text-muted-foreground">JPEG, PNG, WebP ou PDF, até 5 MB. Não anexe documentos pessoais além do necessário.</span></span>
            </Button>
          )}
        </div>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onCancelar} disabled={enviando}>Cancelar</Button>
          <Button type="button" onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "Abrir chamado"}</Button>
        </div>
      </div>
    </div>
  );
}
