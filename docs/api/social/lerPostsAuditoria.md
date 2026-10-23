# `lerPostsAuditoria`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `postsAuditoriaFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `lerPostsAuditoria(…)` |
| Método | `POST` |
| Acesso | Admin |

Auditoria: últimas publicações de toda a comunidade, da mais nova para a mais antiga.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `filtro` | "todos" \| "publicado" \| "oculto" \| "removido" | Situação da publicação. |
| `antes?` | string (ISO) | Cursor: data da última publicação da página anterior. |
| `antesId?` | string | Cursor: id da última publicação da página anterior. |

## Regras

- Sem filtro de visibilidade: inclui perfis e fóruns privados, respostas, ocultas e removidas pelo autor.
- Páginas de 20; o cursor (`proximo`) vem preenchido enquanto houver mais.
- Cada publicação traz o fórum (ou feed geral), se é resposta, o motivo da ocultação e as denúncias (total e pendentes).

## Resposta

`{ posts: PostAuditoriaDTO[]; proximo?: { antes, antesId } }`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Apenas administradores podem fazer isso.

## Exemplo

```ts
import { lerPostsAuditoria } from "@/api/social.functions";

const pagina = await lerPostsAuditoria("todos");
const proxima = await lerPostsAuditoria("todos", pagina.proximo);
```

`data` enviado à server function (`postsAuditoriaFn({ data })`):

```json
{
  "filtro": "oculto",
  "antes": "2026-10-23T15:00:00.000Z",
  "antesId": "spo-…"
}
```
