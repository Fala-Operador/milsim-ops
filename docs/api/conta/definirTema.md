# `definirTema`

[← Índice de APIs](../README.md) · Módulo: [Conta](../README.md#conta)

| | |
|---|---|
| Server function | `definirTemaFn` em [`src/api/conta.functions.ts`](../../../src/api/conta.functions.ts) |
| Uso no navegador | `definirTema(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Guarda o tema da conta (claro ou escuro). Visitantes usam sempre o escuro.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `tema` | "dark" \| "light" |  |

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Tema inválido.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { definirTema } from "@/api/conta.functions";

await definirTema("light");
```

`data` enviado à server function (`definirTemaFn({ data })`):

```json
{
  "tema": "light"
}
```

Resultado devolvido pela chamada:

```json
null
```
