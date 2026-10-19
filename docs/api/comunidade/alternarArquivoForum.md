# `alternarArquivoForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `alternarArquivoForumFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `alternarArquivoForum(…)` |
| Método | `POST` |
| Acesso | Gestão do evento: organização dona ou admin |

Arquiva ou reativa um fórum. Fórum arquivado é só leitura.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Fórum não encontrado.
- Apenas a organização do evento e a administração podem fazer isso.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { alternarArquivoForum } from "@/api/comunidade.functions";

await alternarArquivoForum("for-logistica-mv76");
```

`data` enviado à server function (`alternarArquivoForumFn({ data })`):

```json
{
  "forumId": "for-logistica-mv76"
}
```

Resultado devolvido pela chamada:

```json
null
```
