# `metodosPagamentoStripe`

[← Índice de APIs](../README.md) · Módulo: [Repasse (Stripe Connect)](../README.md#repasses)

| | |
|---|---|
| Server function | `metodosPagamentoStripeFn` em [`src/api/repasses.functions.ts`](../../../src/api/repasses.functions.ts) |
| Uso no navegador | `metodosPagamentoStripe(atualizar?)` (não usa `chamar`) |
| Método | `GET` |
| Acesso | Somente admin |

Mostra em Admin → Pagamentos quais formas de pagamento o site enxerga no Stripe e, se a leitura falhou, o motivo. Serve para entender por que a escolha da forma de pagamento não aparece.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `atualizar?` | boolean | `true` consulta o Stripe de novo, ignorando o cache de 5 minutos. |

## Regras

- Mesma leitura de [`metodosPagamento`](../sessao/metodosPagamento.md), com o erro do Stripe sem chaves de API (nem mascaradas).
- Chave restrita (`rk_…`) precisa de permissão de leitura em "Payment Method Configurations"; sem ela, o erro aparece aqui.

## Resposta

`{ metodos: ("card" | "pix" | "boleto")[], erro?: string }`.

## Erros

- Apenas administradores podem fazer isso.

## Exemplo

```ts
import { metodosPagamentoStripe } from "@/api/repasses.functions";

const { metodos, erro } = await metodosPagamentoStripe(true);
```
