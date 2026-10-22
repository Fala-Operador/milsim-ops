// Inclusão manual de participantes (pagamento combinado por fora) pela organização ou pelo admin.
// Admin escolhe várias pessoas pelo nome (a visão dele tem todos os usuários); a organização
// informa o e-mail ou CPF de uma conta, pois não recebe a lista de usuários da plataforma.
import { useMemo, useState } from "react";
import { Check, UserPlus, X } from "lucide-react";
import { incluirParticipantes } from "@/api/inscricoes.functions";
import { useAuth } from "@/contexts/AuthContext";
import { carregarBase } from "@/services/db";
import { LIMITE_INCLUSAO_MANUAL } from "@/services/inscricoes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo, Modal } from "@/components/ui";
import type { Evento, Usuario } from "@/lib/domain/types";

const VAZIO = { identificador: "", tipoId: "", exercitoId: "", observacao: "" };

export function IncluirParticipante({ evento, className }: { evento: Evento; className?: string | undefined }) {
  const { usuario } = useAuth();
  const admin = usuario?.perfil === "admin";
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState(VAZIO);
  const [selecionados, setSelecionados] = useState<Usuario[]>([]);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const tipos = evento.tipos.filter((t) => !t.arquivado);
  const encerrado = evento.status !== "publicado" && evento.status !== "inscricoes_encerradas";

  // Admin: contas ativas que ainda não têm inscrição ativa (confirmada ou reserva) no evento.
  const candidatos = useMemo(() => {
    if (!admin || !aberto) return [];
    const base = carregarBase();
    const inscritos = new Set(
      base.inscricoes
        .filter((i) => i.eventoId === evento.id && (i.status === "confirmada" || i.status === "pendente"))
        .map((i) => i.usuarioId),
    );
    return base.usuarios
      .filter((u) => u.ativo && !inscritos.has(u.id))
      .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR"));
  }, [admin, aberto, evento.id]);

  const abrir = () => {
    setF({ ...VAZIO, tipoId: tipos.length === 1 ? tipos[0]!.id : "", exercitoId: evento.exercitos.length === 1 ? evento.exercitos[0]!.id : "" });
    setSelecionados([]);
    setErro("");
    setAviso("");
    setAberto(true);
  };

  const alternar = (u: Usuario) => {
    setErro("");
    setSelecionados((atual) =>
      atual.some((x) => x.id === u.id)
        ? atual.filter((x) => x.id !== u.id)
        : atual.length >= LIMITE_INCLUSAO_MANUAL
          ? atual
          : [...atual, u],
    );
  };

  const enviar = async () => {
    const semPessoa = admin ? selecionados.length === 0 : !f.identificador.trim();
    if (semPessoa || !f.tipoId || !f.exercitoId) {
      setErro(admin ? "Selecione ao menos um participante, o tipo de ingresso e o exército." : "Informe o e-mail ou CPF, o tipo de ingresso e o exército.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      const lista = await incluirParticipantes({
        eventoId: evento.id,
        tipoId: f.tipoId,
        exercitoId: f.exercitoId,
        observacao: f.observacao.trim() || undefined,
        ...(admin ? { usuarioIds: selecionados.map((u) => u.id) } : { identificador: f.identificador }),
      });
      setAviso(lista.length === 1 ? `Participante incluído (${lista[0]!.codigo}).` : `${lista.length} participantes incluídos.`);
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível incluir. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Button variant="outline" className={className} onClick={abrir} disabled={encerrado} title={encerrado ? "Evento sem inscrições possíveis." : undefined}>
        <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" /> Incluir participante{admin ? "s" : ""}
      </Button>
      {aviso && <span role="status" className="text-sm text-success">{aviso}</span>}
      <Modal aberto={aberto} titulo={admin ? "Incluir participantes" : "Incluir participante"} onFechar={() => setAberto(false)}>
        <p className="mb-4 text-sm text-muted-foreground">
          Para quem combinou o pagamento por fora. A inscrição entra como cortesia (sem valor no Financeiro), respeita as
          vagas e não depende de lote aberto. Cada pessoa é notificada.
        </p>
        <div className="space-y-3">
          {admin ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">
                Participantes {selecionados.length > 0 && <span className="text-muted-foreground">({selecionados.length} selecionado{selecionados.length > 1 ? "s" : ""})</span>}
              </p>
              {selecionados.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Participantes selecionados">
                  {selecionados.map((u) => (
                    <li key={u.id}>
                      <Badge variant="secondary" className="gap-1 pr-1">
                        {u.nomeCompleto}
                        <Button variant="plain" size="none" type="button" onClick={() => alternar(u)} aria-label={`Remover ${u.nomeCompleto}`} className="rounded-sm p-0.5 hover:text-foreground">
                          <X className="size-3" aria-hidden="true" />
                        </Button>
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Command className="rounded-md border border-input bg-background">
                <CommandInput placeholder="Buscar por nome ou e-mail" autoFocus />
                <CommandList className="max-h-56">
                  <CommandEmpty>Nenhuma conta encontrada (quem já está inscrito não aparece).</CommandEmpty>
                  {candidatos.map((u) => {
                    const marcado = selecionados.some((x) => x.id === u.id);
                    return (
                      <CommandItem key={u.id} value={`${u.nomeCompleto} ${u.email} ${u.id}`} onSelect={() => alternar(u)}>
                        <Check className={marcado ? "opacity-100" : "opacity-0"} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate">{u.nomeCompleto}{marcado && <span className="sr-only"> (selecionado)</span>}</span>
                          <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandList>
              </Command>
            </div>
          ) : (
            <Campo rotulo="E-mail ou CPF da conta" htmlFor="inc-id">
              <Input id="inc-id" autoComplete="off" value={f.identificador} onChange={(e) => setF((p) => ({ ...p, identificador: e.target.value }))} autoFocus />
            </Campo>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Tipo de ingresso" htmlFor="inc-tipo">
              <NativeSelect id="inc-tipo" value={f.tipoId} onChange={(e) => setF((p) => ({ ...p, tipoId: e.target.value }))}>
                <option value="">Selecione</option>
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </NativeSelect>
            </Campo>
            <Campo rotulo="Exército" htmlFor="inc-ex">
              <NativeSelect id="inc-ex" value={f.exercitoId} onChange={(e) => setF((p) => ({ ...p, exercitoId: e.target.value }))}>
                <option value="">Selecione</option>
                {evento.exercitos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </NativeSelect>
            </Campo>
          </div>
          <Campo rotulo="Observação (opcional, fica na auditoria)" htmlFor="inc-obs" erro={erro}>
            <Textarea id="inc-obs" rows={3} maxLength={500} placeholder="Ex.: pagou via PIX direto ao organizador em 20/10" value={f.observacao} onChange={(e) => setF((p) => ({ ...p, observacao: e.target.value }))} />
          </Campo>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAberto(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={enviar} disabled={enviando}>
            {enviando ? "Incluindo..." : admin && selecionados.length > 1 ? `Incluir ${selecionados.length}` : "Incluir"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
