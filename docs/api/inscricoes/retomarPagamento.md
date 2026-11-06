# `retomarPagamento`

[← Índice de APIs](../README.md) · Módulo: [Inscrições e pagamento](../README.md#inscricoes)

| | |
|---|---|
| Server function | `retomarPagamentoFn` em [`src/api/inscricoes.functions.ts`](../../../src/api/inscricoes.functions.ts) |
| Uso no navegador | `retomarPagamento(…)` |
| Método | `POST` |
| Acesso | Titular da reserva |

Volta à página de pagamento de uma reserva ainda aberta (botão "Concluir pagamento" em Meus ingressos).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `inscricaoId` | string |  |
| `metodoPagamento?` | `"card"` \| `"pix"` \| `"boleto"` | Outra forma de pagamento para a mesma reserva. Sem ela, reabre a sessão como está. |

## Regras

- Reaproveita a sessão de checkout aberta; se ela já foi paga (ou o pagamento assíncrono foi enviado), aplica o estado e avisa.
- Com `metodoPagamento` diferente do da sessão aberta, expira a sessão antiga **antes** de criar a nova no meio escolhido. Sessão expirada com a reserva ainda no prazo é substituída por outra; a vaga não é liberada.
- Reserva vencida não pode ser retomada: faça uma nova inscrição.

## Resposta

`{ inscricao, urlPagamento? }`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Reserva não encontrada.
- Esta reserva não está mais aguardando pagamento.
- O prazo desta reserva terminou. Faça uma nova inscrição.
- A venda de ingressos deste evento ainda não está aberta. (a conta de recebimento deixou de estar ativa depois da reserva)
- Esta forma de pagamento não está disponível para este valor. Escolha outra.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { retomarPagamento } from "@/api/inscricoes.functions";

const r = await retomarPagamento("ins-0f8c7a1e-…");
if (r.urlPagamento) window.location.assign(r.urlPagamento);
```

`data` enviado à server function (`retomarPagamentoFn({ data })`):

```json
{
  "inscricaoId": "ins-0f8c7a1e-…"
}
```

Resultado devolvido pela chamada:

```json
{
  "inscricao": {
    "id": "ins-0f8c7a1e-…",
    "status": "pendente"
  },
  "urlPagamento": "https://checkout.stripe.com/c/pay/cs_test_…"
}
```
