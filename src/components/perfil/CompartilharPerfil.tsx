// Compartilha o link do perfil público de operador: no celular abre o compartilhamento nativo
// (WhatsApp, Telegram…); sem ele, copia o link. Quem recebe vê só os blocos liberados na privacidade.
import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "@/i18n/components/perfil/CompartilharPerfil";

export function CompartilharPerfil({ usuarioId }: { usuarioId: string }) {
  const [aviso, setAviso] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const avisar = (texto: string) => {
    setAviso(texto);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAviso(""), 4000);
  };

  const compartilhar = async () => {
    const url = `${window.location.origin}/operador/${usuarioId}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: tr("meu_perfil_no_milsim_ops"), text: tr("confira_meu_perfil_de_operador_no"), url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // a pessoa desistiu
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      avisar(tr("link_do_seu_perfil_copiado_e"));
    } catch {
      avisar(url);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button variant="outline" type="button" onClick={compartilhar}>
        <Share2 className="h-4 w-4" aria-hidden="true" />{" "}{tr("compartilhar_perfil")}</Button>
      {aviso && <span role="status" className="max-w-xs break-all text-right text-xs text-muted-foreground">{aviso}</span>}
    </span>
  );
}
