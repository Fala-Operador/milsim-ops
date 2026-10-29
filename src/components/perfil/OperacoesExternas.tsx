// Operações de que o operador participou fora da plataforma, registradas por ele com foto.
// Aparecem no mapa e no perfil como "Registrada pelo operador"; não contam para insígnias
// (regras em src/services/perfilOperador.ts e src/lib/perfilSocial.ts).
import { useState } from "react";
import { Camera, Eye, EyeOff, MapPinned, Pencil, Plus, Trash2 } from "lucide-react";
import { excluirOperacaoExterna, salvarOperacaoExterna } from "@/api/perfil.functions";
import { arquivoParaDataUrl } from "@/lib/imagens";
import { MODALIDADES, nomeModalidade } from "@/lib/modalidades";
import { NOMES_UF } from "@/lib/participacao";
import { formatarDataBR } from "@/lib/domain/money";
import type { OperacaoExternaDTO } from "@/lib/perfilSocial";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Campo, EstadoVazio, Modal, TextoLivre } from "@/components/ui";
import { useConfirmacao } from "@/contexts/ConfirmacaoContext";
import { tr } from "@/i18n/components/perfil/OperacoesExternas";

const msg = (e: unknown) => (e instanceof Error ? e.message : tr("algo_deu_errado"));
const UFS = Object.keys(NOMES_UF).sort((a, b) => NOMES_UF[a]!.localeCompare(NOMES_UF[b]!));
const hoje = () => new Date().toISOString().slice(0, 10);

/** Selo usado na lista, no mapa e no perfil público. */
export function BadgeRegistrada() {
  return <Badge variant="outline" className="gap-1 whitespace-nowrap"><MapPinned className="size-3" aria-hidden="true" />{tr("registrada_pelo_operador")}</Badge>;
}

interface Formulario {
  id?: string | undefined;
  nome: string; data: string; cidade: string; uf: string; organizacao: string; modalidade: string;
  foto: string; fotoAlt: string; descricao: string; visivel: boolean;
}
const vazio = (): Formulario => ({ nome: "", data: "", cidade: "", uf: "", organizacao: "", modalidade: "", foto: "", fotoAlt: "", descricao: "", visivel: true });
const doDTO = (o: OperacaoExternaDTO): Formulario => ({
  id: o.id, nome: o.nome, data: o.data, cidade: o.cidade, uf: o.uf, organizacao: o.organizacao ?? "", modalidade: o.modalidade ?? "",
  foto: o.fotoUrl, fotoAlt: o.fotoAlt ?? "", descricao: o.descricao ?? "", visivel: o.visivel,
});

export function OperacoesExternas({ externas, proprio, onMudou }: { externas?: OperacaoExternaDTO[] | undefined; proprio: boolean; onMudou: () => void }) {
  const [form, setForm] = useState<Formulario | null>(null);
  const { confirmar } = useConfirmacao();
  const [erro, setErro] = useState("");
  if (!externas) return null;
  if (!proprio && externas.length === 0) return null;

  const alternarVisivel = async (o: OperacaoExternaDTO) => {
    setErro("");
    try { await salvarOperacaoExterna({ ...doDTO(o), visivel: !o.visivel }); onMudou(); } catch (e) { setErro(msg(e)); }
  };
  const excluir = async (o: OperacaoExternaDTO) => {
    if (!(await confirmar({ titulo: tr("excluir_operacao"), descricao: tr("nome_saira_das_suas_operacoes", { nome: o.nome }), confirmar: tr("excluir"), destrutivo: true }))) return;
    setErro("");
    try { await excluirOperacaoExterna(o.id); onMudou(); } catch (e) { setErro(msg(e)); }
  };

  return (
    <section aria-labelledby="titulo-externas" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="titulo-externas" className="font-display text-lg font-semibold uppercase">{tr("operacoes_fora_da_plataforma")}</h2>
          <p className="text-sm text-muted-foreground">
            {proprio
              ? tr("registre_eventos_de_que_voce_participou")
              : tr("registradas_pelo_proprio_operador_nao_co")}
          </p>
        </div>
        {proprio && <Button onClick={() => { setErro(""); setForm(vazio()); }}><Plus className="size-4" aria-hidden="true" />{tr("registrar_operacao")}</Button>}
      </div>
      {erro && !form && <p role="alert" className="text-sm text-destructive">{erro}</p>}

      {externas.length === 0 ? (
        <EstadoVazio titulo={tr("nenhuma_operacao_registrada")} descricao={tr("adicione_as_operacoes_de_que_voce")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {externas.map((o) => (
            <li key={o.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <img src={o.fotoUrl} alt={o.fotoAlt ?? tr("foto_da_nome", { nome: o.nome })} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <div className="space-y-1 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{o.nome}</p>
                  {proprio && !o.visivel && <Badge variant="secondary" className="gap-1"><EyeOff className="size-3" aria-hidden="true" />{tr("privada")}</Badge>}
                </div>
                <p className="text-muted-foreground">
                  {formatarDataBR(o.data)} · {o.cidade}/{o.uf}{o.modalidade ? ` · ${nomeModalidade(o.modalidade)}` : ""}
                </p>
                {o.organizacao && <p className="text-muted-foreground">{o.organizacao}</p>}
                <TextoLivre texto={o.descricao} className="line-clamp-3" />
                <div className="pt-1"><BadgeRegistrada /></div>
                {proprio && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    <Button variant="ghost" className="text-xs" onClick={() => { setErro(""); setForm(doDTO(o)); }}><Pencil className="size-3" aria-hidden="true" />{tr("editar")}</Button>
                    <Button variant="ghost" className="text-xs" onClick={() => alternarVisivel(o)} aria-label={o.visivel ? tr("ocultar_nome_do_perfil_publico", { nome: o.nome }) : tr("mostrar_nome_no_perfil_publico", { nome: o.nome })}>
                      {o.visivel ? <><Eye className="size-3" aria-hidden="true" />{tr("visivel")}</> : <><EyeOff className="size-3" aria-hidden="true" />{tr("privada")}</>}
                    </Button>
                    <Button variant="ghost" className="text-xs" onClick={() => excluir(o)} aria-label={tr("excluir_nome", { nome: o.nome })}><Trash2 className="size-3" aria-hidden="true" /></Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && <FormOperacao inicial={form} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); onMudou(); }} />}
    </section>
  );
}

function FormOperacao({ inicial, onFechar, onSalvo }: { inicial: Formulario; onFechar: () => void; onSalvo: () => void }) {
  const [f, setF] = useState<Formulario>(inicial);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((x) => ({ ...x, [k]: v }));

  const escolherFoto = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro("");
    try { set("foto", await arquivoParaDataUrl(arquivo, 1600)); } catch (e) { setErro(msg(e)); }
  };
  const salvar = async () => {
    setErro("");
    if (!f.foto) return setErro(tr("adicione_uma_foto_da_operacao"));
    setSalvando(true);
    try {
      await salvarOperacaoExterna({
        id: f.id, nome: f.nome, data: f.data, cidade: f.cidade, uf: f.uf, organizacao: f.organizacao || undefined,
        modalidade: f.modalidade || undefined, foto: f.foto, fotoAlt: f.fotoAlt || undefined, descricao: f.descricao || undefined, visivel: f.visivel,
      });
      onSalvo();
    } catch (e) {
      setErro(msg(e));
      setSalvando(false);
    }
  };

  return (
    <Modal aberto titulo={f.id ? tr("editar_operacao") : tr("registrar_operacao")} onFechar={onFechar}>
      <div className="space-y-3">
        <div>
          {f.foto ? (
            <img src={f.foto} alt={tr("previa_da_foto")} className="aspect-[4/3] w-full rounded-md object-cover" />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">{tr("foto_obrigatoria")}</div>
          )}
          <Label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
            <Camera className="size-4" aria-hidden="true" />{f.foto ? tr("trocar_foto") : tr("escolher_foto")}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ""; void escolherFoto(a); }} />
          </Label>
        </div>
        <Campo rotulo={tr("texto_alternativo_da_foto_opcional")} htmlFor="opx-alt">
          <Input id="opx-alt" maxLength={200} value={f.fotoAlt} onChange={(e) => set("fotoAlt", e.target.value)} placeholder={tr("ex_equipe_reunida_antes_da_operacao")} />
        </Campo>
        <Campo rotulo={tr("nome_da_operacao")} htmlFor="opx-nome">
          <Input id="opx-nome" maxLength={120} value={f.nome} onChange={(e) => set("nome", e.target.value)} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo={tr("data")} htmlFor="opx-data">
            <Input id="opx-data" type="date" max={hoje()} value={f.data} onChange={(e) => set("data", e.target.value)} />
          </Campo>
          <Campo rotulo={tr("modalidade_opcional")} htmlFor="opx-mod">
            <NativeSelect id="opx-mod" value={f.modalidade} onChange={(e) => set("modalidade", e.target.value)}>
              <option value="">{tr("nao_informada")}</option>
              {MODALIDADES.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </NativeSelect>
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <Campo rotulo={tr("cidade")} htmlFor="opx-cidade">
            <Input id="opx-cidade" maxLength={80} value={f.cidade} onChange={(e) => set("cidade", e.target.value)} />
          </Campo>
          <Campo rotulo={tr("estado")} htmlFor="opx-uf">
            <NativeSelect id="opx-uf" value={f.uf} onChange={(e) => set("uf", e.target.value)}>
              <option value="">{tr("uf")}</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </NativeSelect>
          </Campo>
        </div>
        <Campo rotulo={tr("organizacao_opcional")} htmlFor="opx-org">
          <Input id="opx-org" maxLength={120} value={f.organizacao} onChange={(e) => set("organizacao", e.target.value)} />
        </Campo>
        <Campo rotulo={tr("comentario_opcional_length_400", { length: f.descricao.length })} htmlFor="opx-desc">
          <Textarea id="opx-desc" maxLength={400} rows={3} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} />
        </Campo>
        <div className="flex items-center gap-2">
          <Checkbox id="opx-vis" checked={f.visivel} onCheckedChange={(v) => set("visivel", v === true)} />
          <Label htmlFor="opx-vis" className="text-sm font-normal">{tr("mostrar_no_meu_perfil_publico_segue")}</Label>
        </div>
        <p className="rounded-md border border-border bg-secondary/40 p-2 text-xs text-muted-foreground">{tr("operacoes_registradas_por_voce_aparecem")}</p>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar} disabled={salvando}>{tr("cancelar")}</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? tr("salvando") : tr("salvar_operacao")}</Button>
        </div>
      </div>
    </Modal>
  );
}
