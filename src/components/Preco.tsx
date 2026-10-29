// Valor de ingresso em reais com a parte inteira 3px maior que os centavos (linha numérica
// mental: o olho lê primeiro a grandeza). O texto continua sendo o mesmo de formatarBRL, então
// leitores de tela e copiar/colar não mudam.
import { localeAtual } from "@/i18n/dicionario";

const formatos = new Map<string, Intl.NumberFormat>();
function formato(): Intl.NumberFormat {
  const locale = localeAtual();
  let f = formatos.get(locale);
  if (!f) formatos.set(locale, (f = new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" })));
  return f;
}

export function Preco({ centavos, className }: { centavos: number; className?: string }) {
  const partes = formato().formatToParts(centavos / 100);
  const inicioDecimal = partes.findIndex((p) => p.type === "decimal");
  const fimInteiro = inicioDecimal === -1 ? partes.length : inicioDecimal;
  const primeiroDigito = partes.findIndex((p) => p.type === "integer");
  const antes = partes
    .slice(0, primeiroDigito)
    .map((p) => p.value)
    .join("");
  const inteiro = partes
    .slice(primeiroDigito, fimInteiro)
    .map((p) => p.value)
    .join("");
  const resto = partes
    .slice(fimInteiro)
    .map((p) => p.value)
    .join("");
  return (
    <span className={`whitespace-nowrap ${className ?? ""}`}>
      {antes}
      <span className="text-[calc(1em+3px)] leading-none">{inteiro}</span>
      {resto}
    </span>
  );
}
