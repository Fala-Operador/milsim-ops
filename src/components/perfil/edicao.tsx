// Edição do perfil social e da privacidade (somente o proprietário).
import { useState } from "react";
import { salvarPerfil, salvarPrivacidade } from "@/api/perfil.functions";
import { arquivoParaDataUrl } from "@/lib/imagens";
import { FotoPerfil } from "@/components/FotoPerfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo, Modal } from "@/components/ui";
import type { PerfilDTO } from "@/lib/perfilSocial";
import type { PrivacidadePerfil, VisibilidadeBloco } from "@/lib/domain/types";
import { Label } from "@/components/ui/label";
import { tr } from "@/i18n/components/perfil/edicao";

const msg = (e: unknown) => (e instanceof Error ? e.message : tr("nao_foi_possivel_salvar"));

export function EditarPerfil({ perfil, aberto, onFechar, onSalvo }: { perfil: PerfilDTO; aberto: boolean; onFechar: () => void; onSalvo: () => void }) {
  const s = perfil.social ?? {};
  const [callsign, setCallsign] = useState(s.callsign ?? "");
  const [bio, setBio] = useState(s.bio ?? "");
  const [squad, setSquad] = useState(s.squad ?? "");
  const [instagram, setInstagram] = useState(s.instagram ?? "");
  const [capa, setCapa] = useState<string | null | undefined>(undefined);
  const [destaque, setDestaque] = useState(perfil.insignias?.find((i) => i.nome === perfil.destaque?.nome)?.id ?? "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const conquistadas = (perfil.insignias ?? []).filter((i) => i.estado === "conquistada");
  const previaCapa = capa === undefined ? s.capaUrl : capa;

  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      await salvarPerfil({ callsign, bio, squad, instagram, capa, insigniaDestaque: destaque || null });
      onSalvo(); onFechar();
    } catch (e) { setErro(msg(e)); } finally { setSalvando(false); }
  };

  return (
    <Modal aberto={aberto} titulo={tr("editar_perfil")} onFechar={onFechar}>
      <div className="space-y-4">
        <p className="rounded-md border border-border bg-elevated p-3 text-xs text-muted-foreground">{tr("estes_sao_dados_do")}{" "}<strong>{tr("perfil_social")}</strong>{tr("seus_dados_de_conta_cpf_nascimento")}</p>
        <div><p className="mb-2 text-sm font-medium">{tr("foto_quadrada_com_recorte")}</p><FotoPerfil /></div>
        <div>
          <p className="mb-2 text-sm font-medium">{tr("capa")}</p>
          <div className="topo-bg h-24 overflow-hidden rounded-md border border-border bg-secondary">
            {previaCapa && <img src={previaCapa} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary font-normal text-inherit">{tr("escolher_imagem")}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (!f) return;
                try { setCapa(await arquivoParaDataUrl(f, 1600)); } catch (err) { setErro(msg(err)); }
              }} />
            </Label>
            {previaCapa && <Button type="button" variant="ghost" onClick={() => setCapa(null)}>{tr("remover_capa")}</Button>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo={tr("callsign")} htmlFor="callsign"><Input id="callsign" maxLength={30} value={callsign} onChange={(e) => setCallsign(e.target.value)} placeholder={tr("ex_falcao")} /></Campo>
          <Campo rotulo={tr("squad_opcional")} htmlFor="squad"><Input id="squad" maxLength={60} value={squad} onChange={(e) => setSquad(e.target.value)} /></Campo>
          <Campo rotulo={tr("instagram_opcional")} htmlFor="insta"><Input id="insta" maxLength={31} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario" /></Campo>
          <Campo rotulo={tr("insignia_em_destaque")} htmlFor="destaque">
            <NativeSelect id="destaque" value={destaque} onChange={(e) => setDestaque(e.target.value)} disabled={!conquistadas.length}>
              <option value="">{conquistadas.length ? tr("nenhuma") : tr("nenhuma_conquistada_ainda")}</option>
              {conquistadas.map((i) => <option key={i.id} value={i.id}>{i.icone} {i.nome}</option>)}
            </NativeSelect>
          </Campo>
        </div>
        <Campo rotulo={tr("biografia_curta_length_280", { length: bio.length })} htmlFor="bio"><Textarea id="bio" maxLength={280} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} /></Campo>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar}>{tr("cancelar")}</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? tr("salvando") : tr("salvar_perfil")}</Button>
        </div>
      </div>
    </Modal>
  );
}

const BLOCOS: { chave: keyof PrivacidadePerfil; rotulo: string; descricao: string }[] = [
  { chave: "historico", get rotulo() { return tr("historico_de_operacoes"); }, get descricao() { return tr("operacoes_concluidas_nunca_o_seu_exercit"); } },
  { chave: "mapa", get rotulo() { return tr("mapa"); }, get descricao() { return tr("estados_onde_voce_participou"); } },
  { chave: "insignias", get rotulo() { return tr("insignias"); }, get descricao() { return tr("conquistas_e_progresso"); } },
  { chave: "equipamentos", get rotulo() { return tr("equipamentos"); }, get descricao() { return tr("so_os_marcados_como_visiveis_notas"); } },
  { chave: "fotos", get rotulo() { return tr("fotos"); }, get descricao() { return tr("so_as_fotos_marcadas_como_visiveis"); } },
];

export function Privacidade({ perfil, aberto, onFechar, onSalvo }: { perfil: PerfilDTO; aberto: boolean; onFechar: () => void; onSalvo: () => void }) {
  const [p, setP] = useState<PrivacidadePerfil>(perfil.privacidade!);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    setSalvando(true); setErro("");
    try { await salvarPrivacidade(p); onSalvo(); onFechar(); } catch (e) { setErro(msg(e)); } finally { setSalvando(false); }
  };
  return (
    <Modal aberto={aberto} titulo={tr("privacidade_do_perfil")} onFechar={onFechar}>
      {!perfil.introVista && (
        <div className="mb-4 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
          <p className="font-medium">{tr("o_que_outras_pessoas_podem_ver")}</p>
          <p className="mt-1 text-muted-foreground">{tr("seu_nome_de_exibicao_e_foto")}{" "}<strong>{tr("somente_para_voce")}</strong>{tr("voce_escolhe_bloco_a_bloco_o")}</p>
        </div>
      )}
      <div className="space-y-3">
        {BLOCOS.map((b) => (
          <div key={b.chave} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{b.rotulo}</p>
              <p className="text-xs text-muted-foreground">{b.descricao}</p>
            </div>
            <div className="w-56">
              <NativeSelect aria-label={tr("quem_ve_rotulo", { rotulo: b.rotulo })} value={p[b.chave]} onChange={(e) => setP({ ...p, [b.chave]: e.target.value as VisibilidadeBloco })}>
                <option value="eu">{tr("somente_eu")}</option>
                <option value="autenticados">{tr("participantes_com_conta")}</option>
              </NativeSelect>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{tr("com_o_perfil_privado_comunidades_os")}</p>
      {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onFechar}>{tr("cancelar")}</Button>
        <Button onClick={salvar} disabled={salvando}>{salvando ? tr("salvando") : tr("salvar_privacidade")}</Button>
      </div>
    </Modal>
  );
}
