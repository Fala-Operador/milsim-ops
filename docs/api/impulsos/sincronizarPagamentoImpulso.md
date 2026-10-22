# `sincronizarPagamentoImpulso`

[← Índice de APIs](../README.md) · Módulo: [Impulsos das organizações](../README.md#impulsos)

| | |
|---|---|
| Server function | `sincronizarPagamentoImpulsoFn` em [`src/api/impulsos.functions.ts`](../../../src/api/impulsos.functions.ts) |
| Uso no navegador | `sincronizarPagamentoImpulso(…)` |
| Método | `POST` |
| Acesso | Organizador ativo da organização do impulso |

Retorno do checkout (`/organizacao/impulsos?pagamento=sucesso&sessao=cs_...`): consulta a sessão no Stripe e aplica o resultado, sem depender do webhook.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `sessaoId` | string | Checkout Session (`cs_...`). |

## Regras

- Pago: o impulso fica `disponivel` e vale por `validadeDias` a partir do pagamento (`expiraEm`); a pessoa que comprou é notificada.
- Pagamento assíncrono não compensado: `processando`. Sessão expirada ou recusada: `cancelado`.
- Idempotente (o webhook aplica o mesmo resultado).

## Resposta

O impulso atualizado (ou `undefined`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Pagamento não encontrado.
- Não foi possível consultar o pagamento agora.

## Exemplo

```ts
import { sincronizarPagamentoImpulso } from "@/api/impulsos.functions";

const impulso = await sincronizarPagamentoImpulso("cs_live_...");
```

`data` enviado à server function (`sincronizarPagamentoImpulsoFn({ data })`):

```json
{
  "sessaoId": "cs_live_..."
}
```

Resultado devolvido pela chamada:

```json
{
  "id": "ipc-m1x2-ab12c",
  "organizacaoId": "org-bravo",
  "planoId": "7d",
  "compradoPor": "usr-organizador",
  "duracaoHoras": 168,
  "precoCentavos": 4490,
  "validadeDias": 30,
  "status": "disponivel",
  "criadoEm": "2026-10-21T02:00:00.000Z",
  "pagoEm": "2026-10-21T02:03:00.000Z",
  "expiraEm": "2026-11-20T02:03:00.000Z"
}
```
