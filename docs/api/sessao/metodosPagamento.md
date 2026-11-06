# `metodosPagamento`

[← Índice de APIs](../README.md) · Módulo: [Sessão e leitura](../README.md#sessao)

| | |
|---|---|
| Server function | `metodosPagamentoFn` em [`src/api/sessao.functions.ts`](../../../src/api/sessao.functions.ts) |
| Uso no navegador | `metodosPagamentoFn()` (sem wrapper, não usa `chamar`) |
| Método | `GET` |
| Acesso | Pública |

Lista as formas de pagamento ativas no Stripe, para a escolha antes do checkout nas telas que não carregam o evento (Meus ingressos e Impulsionar). A página de inscrição recebe a mesma lista por [`obterEvento`](obterEvento.md).

## Entrada

Nenhuma.

## Regras

- Lê a configuração padrão da plataforma (`GET /v1/payment_method_configurations`) e devolve, entre `card`, `pix` e `boleto`, os que têm `available: true`. Cache de 5 minutos no servidor (1 minuto quando a leitura falha).
- Vazia sem Stripe configurado ou se a leitura falhar; então não há escolha e o checkout usa os meios do painel.
- A tela filtra pelo total com `metodosParaValor` (`src/lib/stripe.ts`) e só pergunta quando sobra mais de uma; o componente é `useEscolhaFormaPagamento` (`src/components/FormaPagamento.tsx`).

## Resposta

`("card" | "pix" | "boleto")[]`.

## Exemplo

```ts
import { metodosPagamentoFn } from "@/api/sessao.functions";
import { metodosParaValor } from "@/lib/stripe";

const opcoes = metodosParaValor(await metodosPagamentoFn(), 4490); // ["card", "pix"]
```
