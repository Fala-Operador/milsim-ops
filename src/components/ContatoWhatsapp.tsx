// Contato do evento no WhatsApp: "Falar no WhatsApp" (número público do organizador) e
// "Entrar no grupo" — este só aparece quando a visão trouxe o link, ou seja, para inscritos
// confirmados e para quem gere o evento (regra em src/lib/contatoEvento.ts).
import { MessageCircle, Users } from "lucide-react";
import { linkContatoEvento } from "@/lib/contatoEvento";
import type { Evento } from "@/lib/domain/types";

const BOTAO =
  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

export function ContatoWhatsapp({ evento, className = "" }: { evento: Evento; className?: string }) {
  const contato = linkContatoEvento(evento);
  if (!contato && !evento.whatsappGrupoUrl) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {evento.whatsappGrupoUrl && (
        <a href={evento.whatsappGrupoUrl} target="_blank" rel="noopener noreferrer" className={`${BOTAO} bg-primary text-primary-foreground hover:opacity-90`}>
          <Users className="h-4 w-4" aria-hidden="true" />
          Entrar no grupo do WhatsApp
        </a>
      )}
      {contato && (
        <a href={contato} target="_blank" rel="noopener noreferrer" className={`${BOTAO} border border-border hover:bg-secondary`}>
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          Falar com o organizador no WhatsApp
        </a>
      )}
    </div>
  );
}
