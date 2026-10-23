# `confirmarEmail`

[← Índice de APIs](../README.md) · Módulo: [Sessão e leitura](../README.md#sessao)

| | |
|---|---|
| Server function | `confirmarEmailFn` em [`src/api/sessao.functions.ts`](../../../src/api/sessao.functions.ts) |
| Uso no navegador | `confirmarEmail(…)` |
| Método | `POST` |
| Acesso | Pública (quem tem o link do e-mail) |

Confirma o e-mail do cadastro a partir do link e já abre a sessão.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `tokenHash` | string | Do link `?token_hash=…&type=email` (modelo próprio; vale em qualquer aparelho). |
| `codigo` | string | Alternativa: `?code=…` do modelo padrão do Supabase (PKCE, mesmo navegador do cadastro). |

## Regras

- Envie `tokenHash` **ou** `codigo`.
- O link vale por 1 hora e uma única vez; a página reaproveita a mesma validação se montar de novo.
- Conta desativada não entra.

## Resposta

`null`; a pessoa sai logada (visão aplicada).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Link de confirmação inválido ou expirado. Peça um novo.
- Conta inativa.

## Exemplo

```ts
import { confirmarEmail } from "@/api/sessao.functions";

await confirmarEmail({ tokenHash: "pkce_…" });
```

`data` enviado à server function (`confirmarEmailFn({ data })`):

```json
{
  "tokenHash": "pkce_…"
}
```
