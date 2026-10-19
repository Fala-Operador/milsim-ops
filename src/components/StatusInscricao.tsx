import { Check, Circle, Clock, UserCheck, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { ROTULO_STATUS_INSCRICAO, statusEfetivo } from "@/lib/reservas";
import type { Inscricao, StatusInscricao as Status } from "@/lib/domain/types";
import type { RegistroCheckin } from "@/lib/checkin";

export function StatusInscricao({ status }: { status: Inscricao["status"] }) {
  const Icone = status === "confirmada" ? Check : status === "pendente" ? Clock : X;
  const tom = status === "confirmada" ? "sucesso" : status === "pendente" ? "aviso" : "perigo";
  return (
    <Badge tom={tom} aria-label={`Inscrição: ${ROTULO_STATUS_INSCRICAO[status]}`}>
      <Icone aria-hidden="true" />
      {ROTULO_STATUS_INSCRICAO[status]}
    </Badge>
  );
}

export function StatusCheckin({ presenca }: { presenca: RegistroCheckin | undefined }) {
  return presenca ? (
    <Badge
      tom="destaque"
      aria-label={`Check-in realizado às ${new Date(presenca.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
    >
      <UserCheck aria-hidden="true" />
      Check-in{" "}
      {new Date(presenca.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </Badge>
  ) : (
    <Badge aria-label="Check-in: sem check-in">
      <Circle aria-hidden="true" />
      Sem check-in
    </Badge>
  );
}
