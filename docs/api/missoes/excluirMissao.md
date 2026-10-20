# `excluirMissao`

[← Índice de APIs](../README.md) · Módulo: [Missões pré-evento](../README.md#missoes)

| | |
|---|---|
| Server function | `excluirMissaoFn` em [`src/api/missoes.functions.ts`](../../../src/api/missoes.functions.ts) |
| Uso no navegador | `excluirMissao(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin |

Exclui uma missão sem entregas.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `missaoId` | string |  |

## Regras

- Missão com entregas não pode ser excluída (o placar depende delas).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Missão não encontrada.
- Esta missão já tem entregas e não pode ser excluída.
- Só a organização do evento pode gerenciar as missões.
- A campanha de missões deste evento já foi encerrada.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { excluirMissao } from "@/api/missoes.functions";

await excluirMissao("mis-mv9q1z-k3a8");
```

`data` enviado à server function (`excluirMissaoFn({ data })`):

```json
{
  "missaoId": "mis-mv9q1z-k3a8"
}
```

Resultado devolvido pela chamada:

```json
null
```
