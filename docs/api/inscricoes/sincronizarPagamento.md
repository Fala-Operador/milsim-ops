# `sincronizarPagamento`

[← Índice de APIs](../README.md) · Módulo: [Inscrições e pagamento](../README.md#inscricoes)

| | |
|---|---|
| Server function | `sincronizarPagamentoFn` em [`src/api/inscricoes.functions.ts`](../../../src/api/inscricoes.functions.ts) |
| Uso no navegador | `sincronizarPagamento(…)` |
| Método | `POST` |
| Acesso | Titular da sessão de checkout |

Chamada no retorno do Stripe Checkout (`/app/ingressos?pagamento=sucesso&sessao=cs_…`): consulta o Stripe e aplica o resultado, sem depender do webhook.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `sessaoId` | string (até 300) | Id da Checkout Session (`cs_…`). |

## Regras

- Idempotente: webhook e retorno podem chegar em qualquer ordem; o pagamento é aplicado uma vez.
- Pagamento que chega sem vaga possível (reserva já liberada e evento lotado) é reembolsado.

## Resposta

`{ inscricao?, situacao }`; `situacao` é o status do pagamento (`aguardando`, `processando`, `pago`, `expirado`, `falhou`…) ou `desconhecida`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { sincronizarPagamento } from "@/api/inscricoes.functions";

const sessao = new URLSearchParams(location.search).get("sessao");
if (sessao) {
  const { situacao } = await sincronizarPagamento(sessao);
}
```

`data` enviado à server function (`sincronizarPagamentoFn({ data })`):

```json
{
  "sessaoId": "cs_test_a1B2c3…"
}
```

Resultado devolvido pela chamada:

```json
{
  "inscricao": {
    "id": "ins-0f8c7a1e-…",
    "status": "confirmada"
  },
  "situacao": "pago"
}
```
