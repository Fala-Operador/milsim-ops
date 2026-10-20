# `avaliarEntrega`

[← Índice de APIs](../README.md) · Módulo: [Missões pré-evento](../README.md#missoes)

| | |
|---|---|
| Server function | `avaliarEntregaFn` em [`src/api/missoes.functions.ts`](../../../src/api/missoes.functions.ts) |
| Uso no navegador | `avaliarEntrega(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin |

Aprova (dá os pontos), pede ajustes (libera reenvio) ou recusa uma entrega. O participante é notificado.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `entregaId` | string |  |
| `decisao` | "aprovar" \| "ajustes" \| "recusar" |  |
| `comentario?` | string (até 500) | Obrigatório para ajustes e recusa. |

## Regras

- Pontos = os da missão no momento da aprovação.
- Depois do encerramento, nada muda.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entrega não encontrada.
- Esta entrega não está aguardando avaliação.
- Explique ao participante o motivo.
- Só a organização do evento pode gerenciar as missões.
- A campanha de missões deste evento já foi encerrada.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { avaliarEntrega } from "@/api/missoes.functions";

await avaliarEntrega("ent-77a", "ajustes", "A foto precisa mostrar o patch.");
```

`data` enviado à server function (`avaliarEntregaFn({ data })`):

```json
{
  "entregaId": "ent-77a",
  "decisao": "ajustes",
  "comentario": "A foto precisa mostrar o patch."
}
```

Resultado devolvido pela chamada:

```json
null
```
