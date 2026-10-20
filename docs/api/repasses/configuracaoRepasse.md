# `configuracaoRepasse`

[← Índice de APIs](../README.md) · Módulo: [Repasse (Stripe Connect)](../README.md#repasses)

| | |
|---|---|
| Server function | `configuracaoRepasseFn` em [`src/api/repasses.functions.ts`](../../../src/api/repasses.functions.ts) |
| Uso no navegador | `configuracaoRepasse(…)` |
| Método | `GET` |
| Acesso | Pública |

Informa se os pagamentos online (Stripe) e os painéis embutidos do Stripe estão ativos. A taxa da plataforma chega pela visão (`configuracoes`).

## Entrada

Nenhuma.

## Regras

- `pagamentoOnline` é `true` quando `STRIPE_SECRET_KEY` está configurada no servidor.
- `componentesStripe` é `true` quando, além disso, `STRIPE_PUBLISHABLE_KEY` está configurada (painéis de saques e pagamentos em Financeiro).

## Resposta

`{ pagamentoOnline, componentesStripe }` (não usa `chamar`).

## Exemplo

```ts
import { configuracaoRepasse } from "@/api/repasses.functions";

const { pagamentoOnline } = await configuracaoRepasse();
```

Resultado devolvido pela chamada:

```json
{
  "pagamentoOnline": true,
  "componentesStripe": true
}
```
