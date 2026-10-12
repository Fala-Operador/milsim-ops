// Serviço central de armazenamento local (único ponto de acesso ao localStorage).
// Componentes e contextos NUNCA acessam localStorage diretamente.

const PREFIXO = "milsim-demo:";

// No servidor (SSR) não há localStorage: leituras retornam vazio e escritas são ignoradas.
const semJanela = () => typeof window === "undefined";

export const storage = {
  ler<T>(chave: string): T | null {
    if (semJanela()) return null;
    try {
      const bruto = window.localStorage.getItem(PREFIXO + chave);
      if (!bruto) return null;
      return JSON.parse(bruto) as T;
    } catch {
      // Dados inválidos: descarta com segurança
      return null;
    }
  },
  gravar<T>(chave: string, valor: T): void {
    if (semJanela()) return;
    try {
      window.localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
    } catch {
      throw new Error(
        "Espaço de armazenamento insuficiente. Remova imagens grandes ou restaure a base demonstrativa.",
      );
    }
  },
  remover(chave: string): void {
    if (semJanela()) return;
    window.localStorage.removeItem(PREFIXO + chave);
  },
  limparTudo(): void {
    if (semJanela()) return;
    const chaves: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIXO)) chaves.push(k);
    }
    chaves.forEach((k) => window.localStorage.removeItem(k));
  },
};
