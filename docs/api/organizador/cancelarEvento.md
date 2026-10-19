# `cancelarEvento`

[← Índice de APIs](../README.md) · Módulo: [Organizador](../README.md#organizador)

| | |
|---|---|
| Server function | `cancelarEventoFn` em [`src/api/organizador.functions.ts`](../../../src/api/organizador.functions.ts) |
| Uso no navegador | `cancelarEvento(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin |

Cancela o evento: estorna todas as inscrições ativas, libera as reservas e reembolsa no Stripe o que foi pago online.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |
| `justificativa` | string (até 1000) | Obrigatória. |

## Regras

- Inscrições confirmadas viram `estornada`, com movimentação de estorno e notificação; reservas pendentes são liberadas.
- Depois de gravar, a API expira os checkouts abertos e cria os reembolsos no Stripe (fora da transação, idempotente por inscrição).
- Benefícios de recompensa usados voltam para os participantes.

## Resposta

`{ canceladas }`: quantas inscrições foram estornadas.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe a justificativa.
- Evento não encontrado.
- Você só pode gerenciar eventos da sua organização.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { cancelarEvento } from "@/api/organizador.functions";

const { canceladas } = await cancelarEvento("evt-mv76xwom-mgios", "Chuva forte prevista para o fim de semana.");
```

`data` enviado à server function (`cancelarEventoFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios",
  "justificativa": "Chuva forte prevista para o fim de semana."
}
```

Resultado devolvido pela chamada:

```json
{
  "canceladas": 37
}
```
