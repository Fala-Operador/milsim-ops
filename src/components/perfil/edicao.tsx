// Edição do perfil social e da privacidade (somente o proprietário).
import { useState } from "react";
import { salvarPerfil, salvarPrivacidade } from "@/api/perfil.functions";
import { arquivoParaDataUrl } from "@/lib/imagens";
import { FotoPerfil } from "@/components/FotoPerfil";
import { AreaTexto, Botao, Campo, Entrada, Modal, Selecao } from "@/components/ui";
import type { PerfilDTO } from "@/lib/perfilSocial";
import type { PrivacidadePerfil, VisibilidadeBloco } from "@/lib/domain/types";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível salvar.");

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
    <Modal aberto={aberto} titulo="Editar perfil" onFechar={onFechar}>
      <div className="space-y-4">
        <p className="rounded-md border border-border bg-elevated p-3 text-xs text-muted-foreground">
          Estes são dados do <strong>perfil social</strong>. Seus dados de conta (CPF, nascimento, endereço, telefone, e-mail) nunca aparecem aqui.
        </p>
        <div><p className="mb-2 text-sm font-medium">Foto (quadrada, com recorte)</p><FotoPerfil /></div>
        <div>
          <p className="mb-2 text-sm font-medium">Capa</p>
          <div className="topo-bg h-24 overflow-hidden rounded-md border border-border bg-secondary">
            {previaCapa && <img src={previaCapa} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary">
              Escolher imagem
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (!f) return;
                try { setCapa(await arquivoParaDataUrl(f, 1600)); } catch (err) { setErro(msg(err)); }
              }} />
            </label>
            {previaCapa && <Botao type="button" variante="fantasma" onClick={() => setCapa(null)}>Remover capa</Botao>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Callsign" htmlFor="callsign"><Entrada id="callsign" maxLength={30} value={callsign} onChange={(e) => setCallsign(e.target.value)} placeholder="Ex.: Falcão" /></Campo>
          <Campo rotulo="Squad (opcional)" htmlFor="squad"><Entrada id="squad" maxLength={60} value={squad} onChange={(e) => setSquad(e.target.value)} /></Campo>
          <Campo rotulo="Instagram (opcional)" htmlFor="insta"><Entrada id="insta" maxLength={31} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario" /></Campo>
          <Campo rotulo="Insígnia em destaque" htmlFor="destaque">
            <Selecao id="destaque" value={destaque} onChange={(e) => setDestaque(e.target.value)} disabled={!conquistadas.length}>
              <option value="">{conquistadas.length ? "Nenhuma" : "Nenhuma conquistada ainda"}</option>
              {conquistadas.map((i) => <option key={i.id} value={i.id}>{i.icone} {i.nome}</option>)}
            </Selecao>
          </Campo>
        </div>
        <Campo rotulo={`Biografia curta (${bio.length}/280)`} htmlFor="bio"><AreaTexto id="bio" maxLength={280} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} /></Campo>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar perfil"}</Botao>
        </div>
      </div>
    </Modal>
  );
}

const BLOCOS: { chave: keyof PrivacidadePerfil; rotulo: string; descricao: string }[] = [
  { chave: "historico", rotulo: "Histórico de operações", descricao: "Operações concluídas (nunca o seu exército)." },
  { chave: "mapa", rotulo: "Mapa", descricao: "Estados onde você participou." },
  { chave: "insignias", rotulo: "Insígnias", descricao: "Conquistas e progresso." },
  { chave: "equipamentos", rotulo: "Equipamentos", descricao: "Só os marcados como visíveis. Notas fiscais nunca aparecem." },
  { chave: "fotos", rotulo: "Fotos", descricao: "Só as fotos marcadas como visíveis." },
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
    <Modal aberto={aberto} titulo="Privacidade do perfil" onFechar={onFechar}>
      {!perfil.introVista && (
        <div className="mb-4 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
          <p className="font-medium">O que outras pessoas podem ver</p>
          <p className="mt-1 text-muted-foreground">
            Seu nome de exibição e foto aparecem como na comunidade. Todo o resto começa visível <strong>somente para você</strong>.
            Você escolhe, bloco a bloco, o que mostrar a participantes com conta. Visitantes sem conta não veem esses blocos.
            Operações que você ocultar não entram em contadores, mapa nem insígnias públicas.
          </p>
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
              <Selecao aria-label={`Quem vê: ${b.rotulo}`} value={p[b.chave]} onChange={(e) => setP({ ...p, [b.chave]: e.target.value as VisibilidadeBloco })}>
                <option value="eu">Somente eu</option>
                <option value="autenticados">Participantes com conta</option>
              </Selecao>
            </div>
          </div>
        ))}
      </div>
      {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="contorno" onClick={onFechar}>Cancelar</Botao>
        <Botao onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar privacidade"}</Botao>
      </div>
    </Modal>
  );
}
