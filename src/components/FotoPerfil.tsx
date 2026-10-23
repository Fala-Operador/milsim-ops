// Foto de perfil da conta: escolher, recortar/editar e salvar; ou remover.
import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirmacao } from "@/contexts/ConfirmacaoContext";
import { definirFoto } from "@/api/conta.functions";
import { nomeExibicao } from "@/services/comunidade";
import { EditorFoto } from "@/components/EditorFoto";
import { TIPOS_FOTO, erroArquivoFoto } from "@/lib/recorteFoto";
import { Button } from "@/components/ui/button";

export function FotoPerfil() {
  const { usuario } = useAuth();
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const { confirmar } = useConfirmacao();
  if (!usuario) return null;

  const aoEscolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!f) return;
    const erro = erroArquivoFoto(f);
    if (erro) return setAviso({ tom: "erro", texto: erro });
    setAviso(null);
    setArquivo(f);
  };

  const remover = async () => {
    if (!(await confirmar({ titulo: "Remover a sua foto de perfil?", confirmar: "Remover", destrutivo: true }))) return;
    setRemovendo(true);
    try {
      await definirFoto(null);
      setAviso({ tom: "ok", texto: "Foto removida." });
    } catch (e) {
      setAviso({ tom: "erro", texto: e instanceof Error ? e.message : "Não foi possível remover a foto." });
    } finally {
      setRemovendo(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      {usuario.fotoUrl ? (
        <img src={usuario.fotoUrl} alt="Sua foto de perfil" className="h-24 w-24 shrink-0 rounded-full border border-border object-cover" />
      ) : (
        <span aria-hidden="true" className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-3xl font-semibold text-secondary-foreground">
          {nomeExibicao(usuario).slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Aparece na comunidade dos eventos. JPG, PNG ou WebP — você ajusta o recorte antes de salvar.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => entrada.current?.click()}>
            <Camera className="h-4 w-4" /> {usuario.fotoUrl ? "Trocar foto" : "Adicionar foto"}
          </Button>
          {usuario.fotoUrl && (
            <Button type="button" variant="ghost" onClick={remover} disabled={removendo}>
              <Trash2 className="h-4 w-4" /> Remover
            </Button>
          )}
        </div>
        {aviso && (
          <p role={aviso.tom === "erro" ? "alert" : "status"} className={`text-sm ${aviso.tom === "erro" ? "text-destructive" : "text-success"}`}>
            {aviso.texto}
          </p>
        )}
      </div>
      <input ref={entrada} type="file" accept={TIPOS_FOTO.join(",")} className="hidden" onChange={aoEscolher} aria-label="Escolher foto de perfil" />
      {arquivo && (
        <EditorFoto
          arquivo={arquivo}
          onCancelar={() => setArquivo(null)}
          onConfirmar={async (dataUrl) => {
            await definirFoto(dataUrl);
            setArquivo(null);
            setAviso({ tom: "ok", texto: "Foto atualizada." });
          }}
        />
      )}
    </div>
  );
}
