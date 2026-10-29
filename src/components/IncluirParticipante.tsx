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
import { tr } from "@/i18n/components/IncluirParticipante";

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
      setErro(admin ? tr("selecione_ao_menos_um_participante_o") : tr("informe_o_e_mail_ou_cpf"));
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
      setAviso(lista.length === 1 ? tr("participante_incluido_codigo", { codigo: lista[0]!.codigo }) : tr("length_participantes_incluidos", { length: lista.length }));
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : tr("nao_foi_possivel_incluir_tente_novamente"));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Button variant="outline" className={className} onClick={abrir} disabled={encerrado} title={encerrado ? tr("evento_sem_inscricoes_possiveis") : undefined}>
        <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />{" "}{tr("incluir_participante")}{admin ? "s" : ""}
      </Button>
      {aviso && <span role="status" className="text-sm text-success">{aviso}</span>}
      <Modal aberto={aberto} titulo={admin ? tr("incluir_participantes") : tr("incluir_participante")} onFechar={() => setAberto(false)}>
        <p className="mb-4 text-sm text-muted-foreground">{tr("para_quem_combinou_o_pagamento_por")}</p>
        <div className="space-y-3">
          {admin ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{tr("participantes")}{" "}{selecionados.length > 0 && <span className="text-muted-foreground">{tr("length_selecionado", { length: selecionados.length })}{selecionados.length > 1 ? "s" : ""})</span>}
              </p>
              {selecionados.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label={tr("participantes_selecionados")}>
                  {selecionados.map((u) => (
                    <li key={u.id}>
                      <Badge variant="secondary" className="gap-1 pr-1">
                        {u.nomeCompleto}
                        <Button variant="plain" size="none" type="button" onClick={() => alternar(u)} aria-label={tr("remover_nomecompleto", { nomeCompleto: u.nomeCompleto })} className="rounded-sm p-0.5 hover:text-foreground">
                          <X className="size-3" aria-hidden="true" />
                        </Button>
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Command className="rounded-md border border-input bg-background">
                <CommandInput placeholder={tr("buscar_por_nome_ou_e_mail")} autoFocus />
                <CommandList className="max-h-56">
                  <CommandEmpty>{tr("nenhuma_conta_encontrada_quem_ja_esta")}</CommandEmpty>
                  {candidatos.map((u) => {
                    const marcado = selecionados.some((x) => x.id === u.id);
                    return (
                      <CommandItem key={u.id} value={`${u.nomeCompleto} ${u.email} ${u.id}`} onSelect={() => alternar(u)}>
                        <Check className={marcado ? "opacity-100" : "opacity-0"} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate">{u.nomeCompleto}{marcado && <span className="sr-only">{" "}{tr("selecionado")}</span>}</span>
                          <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandList>
              </Command>
            </div>
          ) : (
            <Campo rotulo={tr("e_mail_ou_cpf_da_conta")} htmlFor="inc-id">
              <Input id="inc-id" autoComplete="off" value={f.identificador} onChange={(e) => setF((p) => ({ ...p, identificador: e.target.value }))} autoFocus />
            </Campo>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo={tr("tipo_de_ingresso")} htmlFor="inc-tipo">
              <NativeSelect id="inc-tipo" value={f.tipoId} onChange={(e) => setF((p) => ({ ...p, tipoId: e.target.value }))}>
                <option value="">{tr("selecione")}</option>
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </NativeSelect>
            </Campo>
            <Campo rotulo={tr("exercito")} htmlFor="inc-ex">
              <NativeSelect id="inc-ex" value={f.exercitoId} onChange={(e) => setF((p) => ({ ...p, exercitoId: e.target.value }))}>
                <option value="">{tr("selecione")}</option>
                {evento.exercitos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </NativeSelect>
            </Campo>
          </div>
          <Campo rotulo={tr("observacao_opcional_fica_na_auditoria")} htmlFor="inc-obs" erro={erro}>
            <Textarea id="inc-obs" rows={3} maxLength={500} placeholder={tr("ex_pagou_via_pix_direto_ao")} value={f.observacao} onChange={(e) => setF((p) => ({ ...p, observacao: e.target.value }))} />
          </Campo>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAberto(false)} disabled={enviando}>{tr("cancelar")}</Button>
          <Button onClick={enviar} disabled={enviando}>
            {enviando ? tr("incluindo") : admin && selecionados.length > 1 ? tr("incluir_length", { length: selecionados.length }) : tr("incluir")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
