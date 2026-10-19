# `corrigirParticipacao`

[← Índice de APIs](../README.md) · Módulo: [Gamificação](../README.md#gamificacao)

| | |
|---|---|
| Server function | `corrigirParticipacaoFn` em [`src/api/gamificacao.functions.ts`](../../../src/api/gamificacao.functions.ts) |
| Uso no navegador | `corrigirParticipacao(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Corrige a presença de alguém num evento (validar sem check-in ou invalidar), com justificativa. Afeta insígnias e recompensas.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `usuarioId` | string |  |
| `eventoId` | string |  |
| `tipo` | "invalidar" \| "validar" |  |
| `justificativa` | string (até 1000) | Obrigatória. |

## Regras

- Só para quem tem inscrição confirmada no evento.
- Ninguém corrige a própria participação.
- Auditado; a progressão é recalculada.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Descreva a justificativa da correção.
- Não é possível corrigir a própria participação.
- A pessoa não tem inscrição confirmada neste evento.
- Apenas administradores podem fazer isso.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { corrigirParticipacao } from "@/api/gamificacao.functions";

await corrigirParticipacao({ usuarioId: "4d27de58-…", eventoId: "evt-serra-verde", tipo: "validar", justificativa: "Check-in feito em papel por falta de sinal." });
```

`data` enviado à server function (`corrigirParticipacaoFn({ data })`):

```json
{
  "usuarioId": "4d27de58-…",
  "eventoId": "evt-serra-verde",
  "tipo": "validar",
  "justificativa": "Check-in feito em papel por falta de sinal."
}
```

Resultado devolvido pela chamada:

```json
null
```
