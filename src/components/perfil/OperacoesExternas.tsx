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

const msg = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado.");
const UFS = Object.keys(NOMES_UF).sort((a, b) => NOMES_UF[a]!.localeCompare(NOMES_UF[b]!));
const hoje = () => new Date().toISOString().slice(0, 10);

/** Selo usado na lista, no mapa e no perfil público. */
export function BadgeRegistrada() {
  return <Badge variant="outline" className="gap-1 whitespace-nowrap"><MapPinned className="size-3" aria-hidden="true" />Registrada pelo operador</Badge>;
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
    if (!(await confirmar({ titulo: "Excluir operação?", descricao: `"${o.nome}" sairá das suas operações.`, confirmar: "Excluir", destrutivo: true }))) return;
    setErro("");
    try { await excluirOperacaoExterna(o.id); onMudou(); } catch (e) { setErro(msg(e)); }
  };

  return (
    <section aria-labelledby="titulo-externas" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="titulo-externas" className="font-display text-lg font-semibold uppercase">Operações fora da plataforma</h2>
          <p className="text-sm text-muted-foreground">
            {proprio
              ? "Registre eventos de que você participou fora do MilSim Ops. Eles aparecem no mapa, mas não contam para insígnias e recompensas."
              : "Registradas pelo próprio operador; não confirmadas pela plataforma."}
          </p>
        </div>
        {proprio && <Button onClick={() => { setErro(""); setForm(vazio()); }}><Plus className="size-4" aria-hidden="true" />Registrar operação</Button>}
      </div>
      {erro && !form && <p role="alert" className="text-sm text-destructive">{erro}</p>}

      {externas.length === 0 ? (
        <EstadoVazio titulo="Nenhuma operação registrada" descricao="Adicione as operações de que você participou antes de usar a plataforma, com uma foto." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {externas.map((o) => (
            <li key={o.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <img src={o.fotoUrl} alt={o.fotoAlt ?? `Foto da ${o.nome}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <div className="space-y-1 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{o.nome}</p>
                  {proprio && !o.visivel && <Badge variant="secondary" className="gap-1"><EyeOff className="size-3" aria-hidden="true" />Privada</Badge>}
                </div>
                <p className="text-muted-foreground">
                  {formatarDataBR(o.data)} · {o.cidade}/{o.uf}{o.modalidade ? ` · ${nomeModalidade(o.modalidade)}` : ""}
                </p>
                {o.organizacao && <p className="text-muted-foreground">{o.organizacao}</p>}
                <TextoLivre texto={o.descricao} className="line-clamp-3" />
                <div className="pt-1"><BadgeRegistrada /></div>
                {proprio && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    <Button variant="ghost" className="text-xs" onClick={() => { setErro(""); setForm(doDTO(o)); }}><Pencil className="size-3" aria-hidden="true" />Editar</Button>
                    <Button variant="ghost" className="text-xs" onClick={() => alternarVisivel(o)} aria-label={o.visivel ? `Ocultar ${o.nome} do perfil público` : `Mostrar ${o.nome} no perfil público`}>
                      {o.visivel ? <><Eye className="size-3" aria-hidden="true" />Visível</> : <><EyeOff className="size-3" aria-hidden="true" />Privada</>}
                    </Button>
                    <Button variant="ghost" className="text-xs" onClick={() => excluir(o)} aria-label={`Excluir ${o.nome}`}><Trash2 className="size-3" aria-hidden="true" /></Button>
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
    if (!f.foto) return setErro("Adicione uma foto da operação.");
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
    <Modal aberto titulo={f.id ? "Editar operação" : "Registrar operação"} onFechar={onFechar}>
      <div className="space-y-3">
        <div>
          {f.foto ? (
            <img src={f.foto} alt="Prévia da foto" className="aspect-[4/3] w-full rounded-md object-cover" />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">Foto obrigatória</div>
          )}
          <Label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
            <Camera className="size-4" aria-hidden="true" />{f.foto ? "Trocar foto" : "Escolher foto"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ""; void escolherFoto(a); }} />
          </Label>
        </div>
        <Campo rotulo="Texto alternativo da foto (opcional)" htmlFor="opx-alt">
          <Input id="opx-alt" maxLength={200} value={f.fotoAlt} onChange={(e) => set("fotoAlt", e.target.value)} placeholder="Ex.: equipe reunida antes da operação" />
        </Campo>
        <Campo rotulo="Nome da operação" htmlFor="opx-nome">
          <Input id="opx-nome" maxLength={120} value={f.nome} onChange={(e) => set("nome", e.target.value)} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Data" htmlFor="opx-data">
            <Input id="opx-data" type="date" max={hoje()} value={f.data} onChange={(e) => set("data", e.target.value)} />
          </Campo>
          <Campo rotulo="Modalidade (opcional)" htmlFor="opx-mod">
            <NativeSelect id="opx-mod" value={f.modalidade} onChange={(e) => set("modalidade", e.target.value)}>
              <option value="">Não informada</option>
              {MODALIDADES.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </NativeSelect>
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <Campo rotulo="Cidade" htmlFor="opx-cidade">
            <Input id="opx-cidade" maxLength={80} value={f.cidade} onChange={(e) => set("cidade", e.target.value)} />
          </Campo>
          <Campo rotulo="Estado" htmlFor="opx-uf">
            <NativeSelect id="opx-uf" value={f.uf} onChange={(e) => set("uf", e.target.value)}>
              <option value="">UF</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </NativeSelect>
          </Campo>
        </div>
        <Campo rotulo="Organização (opcional)" htmlFor="opx-org">
          <Input id="opx-org" maxLength={120} value={f.organizacao} onChange={(e) => set("organizacao", e.target.value)} />
        </Campo>
        <Campo rotulo={`Comentário (opcional, ${f.descricao.length}/400)`} htmlFor="opx-desc">
          <Textarea id="opx-desc" maxLength={400} rows={3} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} />
        </Campo>
        <div className="flex items-center gap-2">
          <Checkbox id="opx-vis" checked={f.visivel} onCheckedChange={(v) => set("visivel", v === true)} />
          <Label htmlFor="opx-vis" className="text-sm font-normal">Mostrar no meu perfil público (segue a privacidade do mapa)</Label>
        </div>
        <p className="rounded-md border border-border bg-secondary/40 p-2 text-xs text-muted-foreground">
          Operações registradas por você aparecem como "Registrada pelo operador" e não contam para insígnias e recompensas, que só valem para eventos com presença confirmada na plataforma.
        </p>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar operação"}</Button>
        </div>
      </div>
    </Modal>
  );
}
