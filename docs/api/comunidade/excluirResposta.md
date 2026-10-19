# `excluirResposta`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `excluirRespostaFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `excluirResposta(…)` |
| Método | `POST` |
| Acesso | Autor do conteúdo |

Remove a própria resposta.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `respostaId` | string |  |

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode excluir suas próprias respostas.
- Entre na sua conta para continuar.
- Conteúdo indisponível ou você não tem acesso a ele.

## Exemplo

```ts
import { excluirResposta } from "@/api/comunidade.functions";

await excluirResposta("res-a8");
```

`data` enviado à server function (`excluirRespostaFn({ data })`):

```json
{
  "respostaId": "res-a8"
}
```

Resultado devolvido pela chamada:

```json
null
```
