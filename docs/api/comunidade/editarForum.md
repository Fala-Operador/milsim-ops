# `editarForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `editarForumFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `editarForum(…)` |
| Método | `POST` |
| Acesso | Gestão do evento: organização dona ou admin |

Edita nome, descrição, regras e permissões de um fórum.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |
| `dados` | objeto | Mesmos campos de `criarForum`. |

## Regras

- O público não muda depois que o fórum tem publicações (evita exposição involuntária).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Fórum não encontrado.
- Não é possível mudar o público de um fórum com publicações (evita exposição involuntária).
- Apenas a organização do evento e a administração podem fazer isso.
- Informe o nome do fórum.
- Informe uma descrição.
- Público inválido.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { editarForum } from "@/api/comunidade.functions";

await editarForum("for-logistica-mv76", { nome: "Logística e caronas", descricao: "…", publico: "todos", publicacao: "membros", respostas: "membros" });
```

`data` enviado à server function (`editarForumFn({ data })`):

```json
{
  "forumId": "for-logistica-mv76",
  "dados": {
    "nome": "Logística e caronas",
    "descricao": "…",
    "publico": "todos",
    "publicacao": "membros",
    "respostas": "membros"
  }
}
```

Resultado devolvido pela chamada:

```json
null
```
