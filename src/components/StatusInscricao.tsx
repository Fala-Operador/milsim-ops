import { Check, Circle, Clock, UserCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ROTULO_STATUS_INSCRICAO } from "@/lib/inscritos";
import type { Inscricao } from "@/lib/domain/types";
import type { RegistroCheckin } from "@/lib/checkin";
import { tr } from "@/i18n/components/StatusInscricao";
import { localeAtual } from "@/i18n/dicionario";

export function StatusInscricao({ status }: { status: Inscricao["status"] }) {
  const Icone = status === "confirmada" ? Check : status === "pendente" ? Clock : X;
  const tom = status === "confirmada" ? "success" : status === "pendente" ? "warning" : "destructive";
  return (
    <Badge variant={tom} aria-label={tr("inscricao_valor", { valor: ROTULO_STATUS_INSCRICAO[status] })}>
      <Icone aria-hidden="true" />
      {ROTULO_STATUS_INSCRICAO[status]}
    </Badge>
  );
}

export function StatusCheckin({ presenca }: { presenca: RegistroCheckin | undefined }) {
  return presenca ? (
    <Badge
      variant="accent"
      aria-label={tr("check_in_realizado_as", { hora: new Date(presenca.em).toLocaleTimeString(localeAtual(), { hour: "2-digit", minute: "2-digit" }) })}
    >
      <UserCheck aria-hidden="true" />{tr("check_in")}{" "}
      {new Date(presenca.em).toLocaleTimeString(localeAtual(), { hour: "2-digit", minute: "2-digit" })}
    </Badge>
  ) : (
    <Badge aria-label={tr("check_in_sem_check_in")}>
      <Circle aria-hidden="true" />{tr("sem_check_in")}</Badge>
  );
}
