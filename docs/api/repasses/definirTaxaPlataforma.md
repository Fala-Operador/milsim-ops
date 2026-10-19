# `definirTaxaPlataforma`

[← Índice de APIs](../README.md) · Módulo: [Repasse (Stripe Connect)](../README.md#repasses)

| | |
|---|---|
| Server function | `definirTaxaPlataformaFn` em [`src/api/repasses.functions.ts`](../../../src/api/repasses.functions.ts) |
| Uso no navegador | `definirTaxaPlataforma(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Define a taxa da plataforma (%) retida em cada venda repassada às organizações.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `percentual` | número (0–100) |  |

## Regras

- Vale para reservas novas; vendas já feitas guardam a taxa do momento.
- Fica em `configuracoes_plataforma` e é auditada.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { definirTaxaPlataforma } from "@/api/repasses.functions";

await definirTaxaPlataforma(8.5);
```

`data` enviado à server function (`definirTaxaPlataformaFn({ data })`):

```json
{
  "percentual": 8.5
}
```

Resultado devolvido pela chamada:

```json
null
```
