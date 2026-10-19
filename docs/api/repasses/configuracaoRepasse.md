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
- `componentesStripe` é `true` quando, além disso, `STRIPE_PUBLISHABLE_KEY` está configurada e combina com a chave secreta (mesmo modo e mesma conta Stripe). Com chaves trocadas fica `false` e o recebimento volta a abrir no site do Stripe.
- `avisoChaves` explica o que não combina entre as chaves (ausente quando está tudo certo); aparece em Administração → Pagamentos.

## Resposta

`{ pagamentoOnline, componentesStripe, avisoChaves? }` (não usa `chamar`).

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
