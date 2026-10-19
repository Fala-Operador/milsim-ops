# `reativarUsuario`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `reativarUsuarioFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `reativarUsuario(…)` |
| Método | `POST` |
| Acesso | Gestão do evento: organização dona ou admin |

Retira a suspensão de um participante na comunidade do evento.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |
| `usuarioId` | string |  |

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Apenas a organização do evento e a administração podem fazer isso.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { reativarUsuario } from "@/api/comunidade.functions";

await reativarUsuario("evt-mv76xwom-mgios", "3bbdfd0d-…");
```

`data` enviado à server function (`reativarUsuarioFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios",
  "usuarioId": "3bbdfd0d-…"
}
```

Resultado devolvido pela chamada:

```json
null
```
