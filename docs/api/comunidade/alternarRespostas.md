# `alternarRespostas`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `alternarRespostasFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `alternarRespostas(…)` |
| Método | `POST` |
| Acesso | Gestão do evento: organização dona ou admin |

Fecha ou reabre as respostas de uma publicação.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `pubId` | string |  |

## Regras

- Com respostas fechadas, só a gestão responde.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Apenas a organização do evento e a administração podem fazer isso.
- Conteúdo indisponível ou você não tem acesso a ele.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { alternarRespostas } from "@/api/comunidade.functions";

await alternarRespostas("pub-q1w2");
```

`data` enviado à server function (`alternarRespostasFn({ data })`):

```json
{
  "pubId": "pub-q1w2"
}
```

Resultado devolvido pela chamada:

```json
null
```
