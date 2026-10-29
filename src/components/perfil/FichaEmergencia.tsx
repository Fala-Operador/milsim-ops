// Ficha de emergência: campos (usados no cadastro e no perfil) e o cartão de edição do perfil.
// Tudo opcional; a organização só vê com a autorização marcada, na janela do evento.
import { useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import { salvarFichaEmergencia } from "@/api/conta.functions";
import { erroFicha, LIMITE_ALERGIAS, telefoneFormatado, TIPOS_SANGUINEOS, DIAS_ANTES_DO_EVENTO, type DadosFicha } from "@/lib/fichaEmergencia";
import { mascaraTelefone } from "@/lib/domain/validators";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo } from "@/components/ui";
import type { FichaEmergencia } from "@/lib/domain/types";
import { tr } from "@/i18n/components/perfil/FichaEmergencia";

export const FICHA_VAZIA: DadosFicha = { tipoSanguineo: "", alergias: "", contatoNome: "", contatoTelefone: "", compartilhar: false };

export function dadosDaFicha(f: FichaEmergencia | undefined): DadosFicha {
  if (!f) return FICHA_VAZIA;
  return {
    tipoSanguineo: f.tipoSanguineo ?? "",
    alergias: f.alergias ?? "",
    contatoNome: f.contatoNome ?? "",
    contatoTelefone: f.contatoTelefone ? mascaraTelefone(f.contatoTelefone) : "",
    compartilhar: f.compartilhar,
  };
}

/** Campos da ficha (controlados). `prefixo` evita ids repetidos na página. */
export function CamposFicha({ valor, onChange, prefixo = "ficha" }: { valor: DadosFicha; onChange: (v: DadosFicha) => void; prefixo?: string }) {
  const set = <K extends keyof DadosFicha>(k: K, v: DadosFicha[K]) => onChange({ ...valor, [k]: v });
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Campo rotulo={tr("tipo_sanguineo")} htmlFor={`${prefixo}-tipo`}>
          <NativeSelect id={`${prefixo}-tipo`} value={valor.tipoSanguineo ?? ""} onChange={(e) => set("tipoSanguineo", e.target.value)}>
            <option value="">{tr("nao_informar")}</option>
            {TIPOS_SANGUINEOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </NativeSelect>
        </Campo>
        <Campo rotulo={tr("alergias")} htmlFor={`${prefixo}-alergias`}>
          <Textarea id={`${prefixo}-alergias`} rows={2} maxLength={LIMITE_ALERGIAS} placeholder={tr("ex_dipirona_picada_de_abelha_deixe")}
            value={valor.alergias ?? ""} onChange={(e) => set("alergias", e.target.value)} />
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo={tr("contato_de_emergencia_nome")} htmlFor={`${prefixo}-contato`}>
          <Input id={`${prefixo}-contato`} maxLength={120} placeholder={tr("ex_maria_mae")} value={valor.contatoNome ?? ""} onChange={(e) => set("contatoNome", e.target.value)} />
        </Campo>
        <Campo rotulo={tr("telefone_do_contato")} htmlFor={`${prefixo}-telefone`}>
          <Input id={`${prefixo}-telefone`} inputMode="tel" autoComplete="off" placeholder="(11) 99999-9999"
            value={valor.contatoTelefone ?? ""} onChange={(e) => set("contatoTelefone", mascaraTelefone(e.target.value))} />
        </Campo>
      </div>
      <Label className="flex items-start gap-2 text-sm font-normal">
        <Checkbox checked={valor.compartilhar} onCheckedChange={(m) => set("compartilhar", m === true)} className="mt-1" />
        <span>{tr("autorizo_compartilhar_minha_ficha_com_a", { DIAS_ANTES_DO_EVENTO })}</span>
      </Label>
    </div>
  );
}

/** Cartão da aba "Ficha de emergência" do perfil. */
export function CartaoFichaEmergencia({ ficha }: { ficha: FichaEmergencia | undefined }) {
  const [valor, setValor] = useState<DadosFicha>(() => dadosDaFicha(ficha));
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Atualiza o formulário quando a ficha muda fora dele (outra aba, outro aparelho).
  useEffect(() => setValor(dadosDaFicha(ficha)), [ficha]);

  const salvar = async () => {
    setErro("");
    setAviso("");
    const problema = erroFicha(valor);
    if (problema) return setErro(problema);
    setSalvando(true);
    try {
      await salvarFichaEmergencia(valor);
      setAviso(
        valor.compartilhar
          ? tr("ficha_salva_a_organizacao_dos_seus")
          : tr("ficha_salva_sem_a_autorizacao_so"),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : tr("nao_foi_possivel_salvar_a_ficha"));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
        <HeartPulse className="h-5 w-5" aria-hidden="true" />{" "}{tr("ficha_de_emergencia")}</h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">{tr("opcional_ajuda_a_organizacao_a_agir")}</p>
      <div className="mt-4">
        <CamposFicha valor={valor} onChange={(v) => { setValor(v); setErro(""); setAviso(""); }} />
      </div>
      {ficha?.compartilhar && ficha.consentimentoEm && (
        <p className="mt-3 text-xs text-muted-foreground">{tr("autorizacao_dada_em_consentimentoem", { consentimentoEm: formatarDataHoraBR(ficha.consentimentoEm) })}</p>
      )}
      {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
      {aviso && <p role="status" className="mt-3 text-sm text-success">{aviso}</p>}
      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={salvar} disabled={salvando}>{salvando ? tr("salvando") : tr("salvar_ficha")}</Button>
      </div>
    </Card>
  );
}

/** Ficha mostrada à gestão do evento (inscritos e check-in). Sem ficha visível, avisa. */
export function ResumoFichaEmergencia({ ficha, compacto = false }: { ficha: FichaEmergencia | undefined; compacto?: boolean }) {
  if (!ficha) {
    return <p className="text-xs text-muted-foreground">{tr("sem_ficha_de_emergencia_compartilhada")}</p>;
  }
  const linhas: [string, string][] = [
    [tr("tipo_sanguineo"), ficha.tipoSanguineo ?? tr("nao_informado")],
    [tr("alergias"), ficha.alergias ?? tr("nenhuma_informada")],
    [tr("contato"), ficha.contatoNome ? `${ficha.contatoNome} · ${telefoneFormatado(ficha.contatoTelefone)}` : tr("nao_informado")],
  ];
  return (
    <div className={`rounded-md border border-destructive/40 bg-destructive/10 ${compacto ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}>
      <p className="flex items-center gap-1.5 font-medium text-destructive">
        <HeartPulse className="h-4 w-4 shrink-0" aria-hidden="true" />{" "}{tr("ficha_de_emergencia")}</p>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {linhas.map(([r, v]) => (
          <div key={r} className="contents">
            <dt className="text-muted-foreground">{r}</dt>
            <dd className="min-w-0 break-words">
              {r === "Contato" && ficha.contatoTelefone ? (
                <a href={`tel:+55${ficha.contatoTelefone}`} className="underline underline-offset-2">{v}</a>
              ) : v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
