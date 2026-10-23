# `editarForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `editarForumFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `editarForum(…)` |
| Método | `POST` |
| Acesso | Dono do fórum |

Altera nome, descrição e visibilidade.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |
| `nome` | string | 3 a 60 caracteres; único entre os fóruns ativos. |
| `descricao?` | string | Até 300 caracteres. |
| `visibilidade` | "publico" \| "privado" |  |
| `foto?` | string (data URL) \| null | Nova foto (JPG, PNG ou WebP de até 5 MB); `null` remove; ausente mantém a atual. |

## Regras

- Tornar público aceita os pedidos pendentes.

## Resposta

`ForumDTO` atualizado.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Só o dono do fórum pode editar.
- Dê um nome com pelo menos 3 caracteres.
- O nome pode ter até 60 caracteres.
- A descrição pode ter até 300 caracteres.
- Escolha se o fórum é público ou privado.
- Conteúdo sexual não é permitido na comunidade. (e as demais mensagens de moderação de texto)
- Já existe um fórum ativo com esse nome.
- Formato de foto inválido. Use JPG, PNG ou WebP.
- A foto pode ter no máximo 5 MB.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { editarForum } from "@/api/social.functions";

await editarForum("frm-…", { nome: "Time Alfa", visibilidade: "publico" });
```

`data` enviado à server function (`editarForumFn({ data })`):

```json
{
  "forumId": "frm-…",
  "nome": "Time Alfa",
  "visibilidade": "publico"
}
```
