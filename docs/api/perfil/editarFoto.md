# `editarFoto`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `editarFotoFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `editarFoto(…)` |
| Método | `POST` |
| Acesso | Dono do perfil (a própria conta) |

Edita legenda, texto alternativo e visibilidade de uma foto.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id` | string |  |
| `legenda?` | string |  |
| `alt?` | string |  |
| `visivel` | boolean |  |

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Foto não encontrada.
- Texto acima de [limite] caracteres.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { editarFoto } from "@/api/perfil.functions";

await editarFoto({ id: "fot-1", legenda: "Serra Verde 2026", visivel: false });
```

`data` enviado à server function (`editarFotoFn({ data })`):

```json
{
  "id": "fot-1",
  "legenda": "Serra Verde 2026",
  "visivel": false
}
```

Resultado devolvido pela chamada:

```json
null
```
