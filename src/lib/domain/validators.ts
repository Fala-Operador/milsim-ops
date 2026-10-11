// Validações e regras compartilhadas (CPF, CNPJ, idade, normalização).

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function cpfValido(cpf: string): boolean {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (base: string, pesos: number[]) => {
    const soma = base
      .split("")
      .reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const p1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  return (
    digito(d.slice(0, 9), p1) === Number(d[9]) &&
    digito(d.slice(0, 10), p2) === Number(d[10])
  );
}

export function cnpjValido(cnpj: string): boolean {
  const d = somenteDigitos(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base
      .split("")
      .reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return (
    calc(d.slice(0, 12), p1) === Number(d[12]) &&
    calc(d.slice(0, 13), p2) === Number(d[13])
  );
}

export function telefoneValido(telefone: string): boolean {
  const d = somenteDigitos(telefone);
  return d.length === 10 || d.length === 11;
}

/** Idade em anos completos, calculada pela data civil (sem fuso). */
export function idadeEmAnos(dataNascimento: string, referencia?: Date): number {
  const [ano, mes, dia] = dataNascimento.split("-").map(Number);
  const ref = referencia ?? new Date();
  let idade = ref.getFullYear() - ano;
  const aindaNaoFezAniversario =
    ref.getMonth() + 1 < mes ||
    (ref.getMonth() + 1 === mes && ref.getDate() < dia);
  if (aindaNaoFezAniversario) idade -= 1;
  return idade;
}

export const IDADE_MINIMA = 15;

export function mascaraCpf(v: string): string {
  const d = somenteDigitos(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function mascaraTelefone(v: string): string {
  const d = somenteDigitos(v).slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

export function mascaraCep(v: string): string {
  const d = somenteDigitos(v).slice(0, 8);
  return d.replace(/(\d{5})(\d{0,3})/, "$1-$2").trim();
}

/** Mascara CPF para listagens autorizadas: ***.***.789-00 */
export function mascararCpf(cpf: string): string {
  const d = somenteDigitos(cpf);
  if (d.length !== 11) return "***.***.***-**";
  return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function mascararTelefone(tel: string): string {
  const d = somenteDigitos(tel);
  if (d.length < 4) return "(**) ****-****";
  return `(**) *****-${d.slice(-4)}`;
}
