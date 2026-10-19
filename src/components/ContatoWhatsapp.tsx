// Contato do evento no WhatsApp: "Falar no WhatsApp" (número público do organizador) e
// "Entrar no grupo" — este só aparece quando a visão trouxe o link, ou seja, para inscritos
// confirmados e para quem gere o evento (regra em src/lib/contatoEvento.ts).
import { MessageCircle, Users } from "lucide-react";
import { linkContatoEvento } from "@/lib/contatoEvento";
import type { Evento } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";


export function ContatoWhatsapp({ evento, className = "" }: { evento: Evento; className?: string }) {
  const contato = linkContatoEvento(evento);
  if (!contato && !evento.whatsappGrupoUrl) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {evento.whatsappGrupoUrl && (
        <Button asChild className="px-3">
          <a href={evento.whatsappGrupoUrl} target="_blank" rel="noopener noreferrer">
            <Users className="h-4 w-4" aria-hidden="true" />
            Entrar no grupo do WhatsApp
          </a>
        </Button>
      )}
      {contato && (
        <Button asChild variant="outline" className="px-3">
          <a href={contato} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Falar com o organizador no WhatsApp
          </a>
        </Button>
      )}
    </div>
  );
}
