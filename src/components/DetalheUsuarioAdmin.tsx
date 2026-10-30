// Painel lateral da administração com o cadastro completo de um usuário (Administração ›
// Usuários). A ficha de emergência não aparece: nem o admin a recebe na visão.
// Edição pelo mesmo formulário de "Meu perfil", no modo admin (CPF editável, auditado).
import { useState } from "react";
import { Pencil } from "lucide-react";
import { EditarDadosConta } from "@/components/perfil/EditarDadosConta";
import { idadeEmAnos, mascaraCep, mascaraCpf, mascaraTelefone } from "@/lib/domain/validators";
import type { Organizacao, Usuario } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { localeAtual } from "@/i18n/dicionario";
import { tr } from "@/i18n/components/DetalheUsuarioAdmin";

const ROTULO_PERFIL = {
  participante: () => tr("perfil_participante"),
  organizador: () => tr("perfil_organizador"),
  admin: () => tr("perfil_admin"),
} as const;

const ROTULO_AUTORIZACAO = {
  pendente: () => tr("autorizacao_pendente"),
  aprovada: () => tr("autorizacao_aprovada"),
  nao_aplicavel: () => tr("nao_se_aplica"),
} as const;

const dataHora = (iso: string) => new Date(iso).toLocaleDateString(localeAtual());
/** Data civil (AAAA-MM-DD) sem deslocamento de fuso. */
const dataCivil = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(localeAtual(), { timeZone: "UTC" });

function Grupo({ titulo, itens }: { titulo: string; itens: [string, string][] }) {
  return (
    <section className="mt-5">
      <h3 className="rotulo-tecnico mb-1">{titulo}</h3>
      <dl className="border-y border-border text-sm">
        {itens.map(([r, v]) => (
          <div key={r} className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
            <dt className="shrink-0 text-muted-foreground">{r}</dt>
            <dd className="min-w-0 break-words text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function DetalheUsuarioAdmin({ usuario, organizacao, onFechar, acoes }: {
  usuario: Usuario;
  organizacao?: Organizacao | undefined;
  onFechar: () => void;
  /** Ações que a lista já oferece (aprovar autorização, desativar). */
  acoes?: React.ReactNode;
}) {
  const [editando, setEditando] = useState(false);
  const end = usuario.endereco;
  const opcional = (v: string | undefined) => v || tr("nao_informado");

  return (
    <Sheet open onOpenChange={(aberto) => !aberto && !editando && onFechar()}>
      <SheetContent side="right" showCloseButton={false} className="flex w-full flex-col gap-0 overflow-y-auto border-border p-5 sm:max-w-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SheetTitle className="break-words">{usuario.nomeCompleto}</SheetTitle>
            <SheetDescription className="break-all">{usuario.email}</SheetDescription>
          </div>
          <Button variant="ghost" onClick={onFechar} aria-label={tr("fechar")}>✕</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          <Badge variant="secondary">{ROTULO_PERFIL[usuario.perfil]()}</Badge>
          <Badge variant={usuario.ativo ? "success" : "destructive"}>{usuario.ativo ? tr("ativo") : tr("inativo")}</Badge>
          {usuario.autorizacaoResponsavel === "pendente" && <Badge variant="warning">{tr("autorizacao_pendente")}</Badge>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
            <Pencil className="h-4 w-4" aria-hidden="true" />{" "}{tr("editar_dados")}
          </Button>
          {acoes}
        </div>

        <Grupo titulo={tr("dados_pessoais")} itens={[
          ["CPF", mascaraCpf(usuario.cpf)],
          [tr("nascimento"), tr("data_idade_anos", { data: dataCivil(usuario.dataNascimento), idade: idadeEmAnos(usuario.dataNascimento) })],
          [tr("whatsapp"), mascaraTelefone(usuario.whatsapp)],
          [tr("instagram"), opcional(usuario.instagram)],
          [tr("squad"), opcional(usuario.squad)],
        ]} />
        <Grupo titulo={tr("endereco")} itens={[
          [tr("cep"), mascaraCep(end.cep)],
          [tr("logradouro"), end.complemento ? `${end.logradouro}, ${end.numero} — ${end.complemento}` : `${end.logradouro}, ${end.numero}`],
          [tr("bairro"), end.bairro],
          [tr("cidade_uf"), `${end.cidade} / ${end.uf}`],
        ]} />
        <Grupo titulo={tr("conta")} itens={[
          [tr("organizacao"), organizacao?.nome ?? tr("nenhuma")],
          [tr("cadastro"), dataHora(usuario.criadoEm)],
          [tr("aceite_dos_termos"), tr("versao_em_data", { versao: usuario.aceiteTermosVersao, data: dataHora(usuario.aceiteTermosEm) })],
          [tr("autorizacao_do_responsavel"), ROTULO_AUTORIZACAO[usuario.autorizacaoResponsavel ?? "nao_aplicavel"]()],
          [tr("comunicacoes_promocionais"), usuario.autorizacaoPromocional ? tr("autorizadas") : tr("nao_autorizadas")],
          [tr("perfil_na_comunidade"), usuario.comunidadePrivada ? tr("privado") : tr("publico")],
        ]} />

        {editando && <EditarDadosConta key={usuario.id} usuario={usuario} admin aberto onFechar={() => setEditando(false)} />}
      </SheetContent>
    </Sheet>
  );
}
