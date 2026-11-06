# `comprarImpulso`

[← Índice de APIs](../README.md) · Módulo: [Impulsos das organizações](../README.md#impulsos)

| | |
|---|---|
| Server function | `comprarImpulsoFn` em [`src/api/impulsos.functions.ts`](../../../src/api/impulsos.functions.ts) |
| Uso no navegador | `comprarImpulso(…)` |
| Método | `POST` |
| Acesso | Organizador ativo (para a própria organização) |

Compra um impulso para a organização de quem chama e abre o pagamento no Stripe Checkout da plataforma.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `planoId` | "24h" \| "3d" \| "5d" \| "7d" \| "15d" \| "30d" | Tipo do impulso. |
| `metodoPagamento?` | `"card"` \| `"pix"` \| `"boleto"` | Forma de pagamento escolhida: o checkout abre só com ela. A tela pergunta quando há mais de uma ativa para o preço. |

## Regras

- Preço, duração e validade do tipo ficam gravados na compra (mudanças posteriores da administração não afetam).
- Tipo com preço 0 fica `disponivel` na hora, sem Stripe. Os demais ficam `aguardando_pagamento` e o checkout expira em 60 minutos; depois disso a compra não aparece mais.
- O pagamento vai todo para a conta da plataforma (sem repasse). Os meios são os ativos na configuração padrão do Stripe; `metodoPagamento` precisa estar entre os que aceitam o preço (com uma opção só, é ignorado).
- Se o Stripe falhar ao abrir o checkout, a compra é cancelada.
- Auditado (`impulso_reservado` ou `impulso_confirmado`).

## Resposta

`{ impulso, urlPagamento? }`: `urlPagamento` ausente quando o impulso já está disponível.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Somente a organização compra impulsos para os próprios eventos.
- Este tipo de impulso não está à venda no momento.
- Os pagamentos online ainda não estão ativados na plataforma.
- Esta forma de pagamento não está disponível para este valor. Escolha outra.
- Não foi possível abrir o pagamento agora. Tente novamente em instantes.

## Exemplo

```ts
import { comprarImpulso } from "@/api/impulsos.functions";

const { urlPagamento } = await comprarImpulso("7d", "pix");
if (urlPagamento) window.location.assign(urlPagamento);
```

`data` enviado à server function (`comprarImpulsoFn({ data })`):

```json
{
  "planoId": "7d",
  "metodoPagamento": "pix"
}
```

Resultado devolvido pela chamada:

```json
{
  "impulso": {
    "id": "ipc-m1x2-ab12c",
    "organizacaoId": "org-bravo",
    "planoId": "7d",
    "compradoPor": "usr-organizador",
    "duracaoHoras": 168,
    "precoCentavos": 4490,
    "validadeDias": 30,
    "status": "aguardando_pagamento",
    "criadoEm": "2026-10-21T02:00:00.000Z"
  },
  "urlPagamento": "https://checkout.stripe.com/c/pay/cs_live_..."
}
```
