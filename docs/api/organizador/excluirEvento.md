# `excluirEvento`

[← Índice de APIs](../README.md) · Módulo: [Organizador](../README.md#organizador)

| | |
|---|---|
| Server function | `excluirEventoFn` em [`src/api/organizador.functions.ts`](../../../src/api/organizador.functions.ts) |
| Uso no navegador | `excluirEvento(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin |

Exclui um evento sem inscrições (rascunhos ou eventos sem vendas). Leva junto cupons e cortesias.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |

## Regras

- Com inscrições confirmadas ou aguardando pagamento, a exclusão é recusada: cancele o evento.
- A exclusão é auditada.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Evento não encontrado.
- Há inscrições confirmadas ou aguardando pagamento. Cancele o evento em vez de excluí-lo.
- Você só pode gerenciar eventos da sua organização.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { excluirEvento } from "@/api/organizador.functions";

await excluirEvento("evt-rascunho-01");
```

`data` enviado à server function (`excluirEventoFn({ data })`):

```json
{
  "eventoId": "evt-rascunho-01"
}
```

Resultado devolvido pela chamada:

```json
null
```
