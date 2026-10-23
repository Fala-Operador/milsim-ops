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
        <Campo rotulo="Tipo sanguíneo" htmlFor={`${prefixo}-tipo`}>
          <NativeSelect id={`${prefixo}-tipo`} value={valor.tipoSanguineo ?? ""} onChange={(e) => set("tipoSanguineo", e.target.value)}>
            <option value="">Não informar</option>
            {TIPOS_SANGUINEOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </NativeSelect>
        </Campo>
        <Campo rotulo="Alergias" htmlFor={`${prefixo}-alergias`}>
          <Textarea id={`${prefixo}-alergias`} rows={2} maxLength={LIMITE_ALERGIAS} placeholder="Ex.: dipirona, picada de abelha. Deixe em branco se não tiver."
            value={valor.alergias ?? ""} onChange={(e) => set("alergias", e.target.value)} />
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Contato de emergência (nome)" htmlFor={`${prefixo}-contato`}>
          <Input id={`${prefixo}-contato`} maxLength={120} placeholder="Ex.: Maria (mãe)" value={valor.contatoNome ?? ""} onChange={(e) => set("contatoNome", e.target.value)} />
        </Campo>
        <Campo rotulo="Telefone do contato" htmlFor={`${prefixo}-telefone`}>
          <Input id={`${prefixo}-telefone`} inputMode="tel" autoComplete="off" placeholder="(11) 99999-9999"
            value={valor.contatoTelefone ?? ""} onChange={(e) => set("contatoTelefone", mascaraTelefone(e.target.value))} />
        </Campo>
      </div>
      <Label className="flex items-start gap-2 text-sm font-normal">
        <Checkbox checked={valor.compartilhar} onCheckedChange={(m) => set("compartilhar", m === true)} className="mt-1" />
        <span>
          Autorizo compartilhar minha ficha com a organização dos eventos em que eu tiver inscrição confirmada, para
          atendimento em emergência. Ela só fica visível de {DIAS_ANTES_DO_EVENTO} dias antes até o fim de cada evento.
        </span>
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
          ? "Ficha salva. A organização dos seus eventos confirmados poderá vê-la na semana do evento."
          : "Ficha salva. Sem a autorização, só você a vê.",
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a ficha.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
        <HeartPulse className="h-5 w-5" aria-hidden="true" /> Ficha de emergência
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Opcional. Ajuda a organização a agir rápido se algo acontecer em campo. São dados de saúde: você decide se a
        organização pode ver e pode apagar tudo a qualquer momento deixando os campos em branco.
      </p>
      <div className="mt-4">
        <CamposFicha valor={valor} onChange={(v) => { setValor(v); setErro(""); setAviso(""); }} />
      </div>
      {ficha?.compartilhar && ficha.consentimentoEm && (
        <p className="mt-3 text-xs text-muted-foreground">Autorização dada em {formatarDataHoraBR(ficha.consentimentoEm)}.</p>
      )}
      {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
      {aviso && <p role="status" className="mt-3 text-sm text-success">{aviso}</p>}
      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar ficha"}</Button>
      </div>
    </Card>
  );
}

/** Ficha mostrada à gestão do evento (inscritos e check-in). Sem ficha visível, avisa. */
export function ResumoFichaEmergencia({ ficha, compacto = false }: { ficha: FichaEmergencia | undefined; compacto?: boolean }) {
  if (!ficha) {
    return <p className="text-xs text-muted-foreground">Sem ficha de emergência compartilhada.</p>;
  }
  const linhas: [string, string][] = [
    ["Tipo sanguíneo", ficha.tipoSanguineo ?? "não informado"],
    ["Alergias", ficha.alergias ?? "nenhuma informada"],
    ["Contato", ficha.contatoNome ? `${ficha.contatoNome} · ${telefoneFormatado(ficha.contatoTelefone)}` : "não informado"],
  ];
  return (
    <div className={`rounded-md border border-destructive/40 bg-destructive/10 ${compacto ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}>
      <p className="flex items-center gap-1.5 font-medium text-destructive">
        <HeartPulse className="h-4 w-4 shrink-0" aria-hidden="true" /> Ficha de emergência
      </p>
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
