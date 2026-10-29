import { Check, Circle } from "lucide-react";
import { requisitosSenha } from "@/lib/domain/senha";
import { tr } from "@/i18n/components/RequisitosSenha";

/** Checklist ao vivo dos requisitos da senha (e, se `confirmacao` vier, da confirmação). */
export function RequisitosSenha({ id, senha, confirmacao }: { id?: string; senha: string; confirmacao?: string }) {
  const itens: Array<{ chave: string; texto: string; ok: boolean }> = requisitosSenha(senha).map((r) => ({
    chave: r.id, texto: r.texto, ok: r.ok,
  }));
  if (confirmacao !== undefined) {
    itens.push({ chave: "confirmacao", texto: tr("as_duas_senhas_sao_iguais"), ok: senha.length > 0 && senha === confirmacao });
  }
  return (
    <ul id={id} className="space-y-1 text-sm" aria-live="polite">
      {itens.map((r) => (
        <Requisito key={r.chave} ok={r.ok}>{r.texto}</Requisito>
      ))}
    </ul>
  );
}

function Requisito({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icone = ok ? Check : Circle;
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-success" : "text-muted-foreground"}`}>
      <Icone className="size-4 shrink-0" aria-hidden="true" />
      <span>{children}<span className="sr-only">{ok ? ` ${tr("atendido")}` : ` ${tr("pendente")}`}</span></span>
    </li>
  );
}
