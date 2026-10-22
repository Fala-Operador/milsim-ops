# `definirTaxaComprador`

[← Índice de APIs](../README.md) · Módulo: [Repasse (Stripe Connect)](../README.md#repasses)

| | |
|---|---|
| Server function | `definirTaxaCompradorFn` em [`src/api/repasses.functions.ts`](../../../src/api/repasses.functions.ts) |
| Uso no navegador | `definirTaxaComprador(…)` |
| Método | `POST` |
| Acesso | Organizador da própria organização ou admin |

Define a taxa de serviço (%) que a organização cobra do comprador, somada ao valor do ingresso no checkout como um item separado ("Taxa de serviço"). Padrão 0%.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `organizacaoId` | string |  |
| `percentual` | número (0–100) |  |

## Regras

- Entre 0% e 50%, com até duas casas decimais. Vale para reservas novas; vendas já feitas guardam a taxa do momento (`taxaCompradorCentavos` no pagamento).
- Vai para a organização: não entra no `application_fee_amount`, então o Stripe a transfere junto com o ingresso.
- Aparece na revisão da inscrição e no checkout; reembolso integral devolve também a taxa de serviço.
- Fica em `organizations.buyer_fee_percent` e é auditada (`taxa_comprador`, entidade `organizacao`).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.
- Apenas a organização pode alterar a sua taxa de serviço.
- Organização não encontrada.

## Exemplo

```ts
import { definirTaxaComprador } from "@/api/repasses.functions";

await definirTaxaComprador("org-123", 3.5);
```

`data` enviado à server function (`definirTaxaCompradorFn({ data })`):

```json
{
  "organizacaoId": "org-123",
  "percentual": 3.5
}
```

Resultado devolvido pela chamada:

```json
null
```
