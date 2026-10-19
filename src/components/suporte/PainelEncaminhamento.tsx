// Comunicação interna administração ↔ organização de um chamado. Nunca aparece para o participante.
import { useState } from "react";
import { Send } from "lucide-react";
import { encaminharChamado } from "@/api/suporte.functions";
import { useSuporte } from "@/contexts/SuporteContext";
import { canalDe, encaminhamentos, type Encaminhamento } from "@/lib/suporte";
import { formatarDataHoraBR } from "@/lib/domain/money";
import type { BaseDados, Chamado, Usuario } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Conversa } from "./Conversa";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";

const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export function SituacaoEncaminhamento({ e }: { e: Encaminhamento }) {
  return e.situacao === "retorno_enviado" ? <Badge variant="success">Retorno enviado à administração</Badge> : <Badge variant="warning">Aguardando organizador</Badge>;
}

export function PainelEncaminhamento({ base, c, usuario }: { base: BaseDados; c: Chamado; usuario: Usuario }) {
  const { sinalizar } = useSuporte();
  const encs = encaminhamentos(base, c);
  const [selecionado, setSelecionado] = useState<string | undefined>(encs.at(-1)?.id);
  const [criando, setCriando] = useState(false);
  const [orientacao, setOrientacao] = useState("");
  const [anexos, setAnexos] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [idEnvio, setIdEnvio] = useState(novoId);
  const ev = c.eventoId ? base.eventos.find((e) => e.id === c.eventoId) : undefined;
  const org = ev ? base.organizacoes.find((o) => o.id === ev.organizacaoId) : undefined;
  const disponiveis = c.mensagens.filter((m) => canalDe(m) === "participante" && m.anexo);
  const atual = encs.find((e) => e.id === selecionado) ?? encs.at(-1);
  const fechado = c.status === "fechado";

  const enviar = async () => {
    if (ocupado) return;
    setOcupado(true); setErro("");
    try {
      const id = await encaminharChamado(c.id, idEnvio, orientacao, anexos);
      sinalizar(c.id);
      setSelecionado(id); setCriando(false); setOrientacao(""); setAnexos([]); setIdEnvio(novoId());
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao encaminhar."); } finally { setOcupado(false); }
  };

  if (!ev) {
    return <p className="p-4 text-sm text-muted-foreground">Chamado da plataforma: não há organização para encaminhar.</p>;
  }

  const formulario = (
    <div className="space-y-3 p-4 text-sm">
      <p className="font-medium">Encaminhar à organização {org?.nome ?? "do evento"}</p>
      <p className="text-xs text-muted-foreground">A organização não vê a conversa com o participante nem os dados pessoais. Escreva só o que for necessário.</p>
      <div>
        <Label htmlFor={`ori-${c.id}`} className="text-xs font-medium text-inherit">Orientação ao organizador</Label>
        <Textarea id={`ori-${c.id}`} rows={4} maxLength={4000} value={orientacao} onChange={(e) => setOrientacao(e.target.value)} />
      </div>
      {disponiveis.length > 0 && (
        <fieldset>
          <legend className="text-xs font-medium">Anexos a compartilhar (opcional)</legend>
          {disponiveis.map((m) => (
            <Label key={m.id} className="mt-1 flex items-center gap-2 text-xs font-normal text-inherit">
              <Checkbox checked={anexos.includes(m.id)} onCheckedChange={(marcado) => setAnexos((l) => (marcado === true ? [...l, m.id] : l.filter((x) => x !== m.id)))} />
              {m.anexo!.nome}
            </Label>
          ))}
        </fieldset>
      )}
      {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
      <div className="flex gap-2">
        {encs.length > 0 && <Button type="button" variant="outline" onClick={() => setCriando(false)}>Cancelar</Button>}
        <Button type="button" disabled={ocupado || !orientacao.trim()} onClick={enviar}><Send className="h-4 w-4" />Encaminhar ao organizador</Button>
      </div>
    </div>
  );

  if (!atual || criando) return fechado ? <p className="p-4 text-sm text-muted-foreground">Nenhum encaminhamento.</p> : <div className="min-h-0 flex-1 overflow-y-auto">{formulario}</div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-border px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {encs.length > 1 && (
            <NativeSelect aria-label="Encaminhamento" value={atual.id} onChange={(e) => setSelecionado(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground w-auto sm:text-xs">
              {encs.map((e, i) => <option key={e.id} value={e.id}>Encaminhamento {i + 1} · {formatarDataHoraBR(e.criadoEm)}</option>)}
            </NativeSelect>
          )}
          <SituacaoEncaminhamento e={atual} />
          {!fechado && <Button type="button" variant="ghost" className="ml-auto !py-1 text-xs" onClick={() => setCriando(true)}>Novo encaminhamento</Button>}
        </div>
        <p className="text-xs text-muted-foreground">Orientação enviada:</p>
        <p className="whitespace-pre-wrap rounded-md border border-border bg-background/60 px-3 py-2">{atual.orientacao}</p>
        {atual.anexos.length > 0 && <p className="text-xs text-muted-foreground">Anexos compartilhados: {atual.anexos.map((a) => a.nome).join(", ")}</p>}
      </div>
      <Conversa key={atual.id} base={base} chamado={c} usuarioId={usuario.id} somenteLeitura={fechado} encaminhamentoId={atual.id}
        rotuloEnviar="Enviar ao organizador" aviso="Comunicação interna: o participante não vê estas mensagens." textoVazio="Ainda sem respostas da organização." />
    </div>
  );
}
