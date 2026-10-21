# `definirTaxaComprador`

[← Índice de APIs](../README.md) · Módulo: [Repasse (Stripe Connect)](../README.md#repasses)

| | |
|---|---|
| Server function | `definirTaxaCompradorFn` em [`src/api/repasses.functions.ts`](../../../src/api/repasses.functions.ts) |
| Uso no navegador | `definirTaxaComprador(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Define a taxa de serviço (%) paga pelo comprador, somada ao valor do ingresso no checkout como um item separado ("Taxa de serviço"). Padrão 0%.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `percentual` | número (0–100) |  |

## Regras

- Entre 0% e 50%, com até duas casas decimais. Vale para reservas novas; vendas já feitas guardam a taxa do momento (`taxaCompradorCentavos` no pagamento).
- Fica com a plataforma: não muda o valor repassado à organização (numa venda repassada, entra no `application_fee_amount` junto da taxa da plataforma).
- Aparece na revisão da inscrição e no checkout; reembolso integral devolve também a taxa de serviço.
- Fica em `platform_settings.buyer_fee_percent` e é auditada (`taxa_comprador`).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { definirTaxaComprador } from "@/api/repasses.functions";

await definirTaxaComprador(3.5);
```

`data` enviado à server function (`definirTaxaCompradorFn({ data })`):

```json
{
  "percentual": 3.5
}
```

Resultado devolvido pela chamada:

```json
null
```
