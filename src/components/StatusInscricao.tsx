import { Check, Circle, Clock, FileSearch, UserCheck, X, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui";
import { ROTULO_STATUS_INSCRICAO, statusEfetivo } from "@/lib/reservas";
import type { Inscricao, StatusInscricao as Status } from "@/lib/domain/types";
import type { RegistroCheckin } from "@/lib/checkin";

const VISUAL: Record<Status, { tom: "sucesso" | "aviso" | "perigo" | "padrao"; Icone: LucideIcon }> = {
  confirmada: { tom: "sucesso", Icone: Check },
  aguardando_pagamento: { tom: "aviso", Icone: Clock },
  em_analise: { tom: "aviso", Icone: FileSearch },
  cancelada: { tom: "perigo", Icone: X },
  estornada: { tom: "perigo", Icone: X },
  recusada: { tom: "perigo", Icone: X },
  expirada: { tom: "padrao", Icone: X },
};

/** Status da inscrição; com `reservaAte`, reserva vencida aparece como expirada antes da varredura. */
export function StatusInscricao({ status, reservaAte }: { status: Inscricao["status"]; reservaAte?: string | undefined }) {
  const efetivo = statusEfetivo({ status, reservaAte });
  const { tom, Icone } = VISUAL[efetivo];
  return <Badge tom={tom} aria-label={`Inscrição: ${ROTULO_STATUS_INSCRICAO[efetivo]}`}><Icone aria-hidden="true" />{ROTULO_STATUS_INSCRICAO[efetivo]}</Badge>;
}

export function StatusCheckin({ presenca }: { presenca: RegistroCheckin | undefined }) {
  return presenca
    ? <Badge tom="destaque" aria-label={`Check-in realizado às ${new Date(presenca.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}><UserCheck aria-hidden="true" />Check-in {new Date(presenca.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Badge>
    : <Badge aria-label="Check-in: sem check-in"><Circle aria-hidden="true" />Sem check-in</Badge>;
}