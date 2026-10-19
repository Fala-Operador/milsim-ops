# `excluirFoto`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `excluirFotoFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `excluirFoto(…)` |
| Método | `POST` |
| Acesso | Dono do perfil (a própria conta) |

Remove uma foto da galeria.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id` | string |  |

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Foto não encontrada.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { excluirFoto } from "@/api/perfil.functions";

await excluirFoto("fot-1");
```

`data` enviado à server function (`excluirFotoFn({ data })`):

```json
{
  "id": "fot-1"
}
```

Resultado devolvido pela chamada:

```json
null
```
