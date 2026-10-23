# `criarForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `criarForumFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `criarForum(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Cria um fórum; quem cria vira o dono.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `nome` | string | 3 a 60 caracteres; único entre os fóruns ativos. |
| `descricao?` | string | Até 300 caracteres. |
| `visibilidade` | "publico" \| "privado" |  |
| `foto?` | string (data URL) | Foto quadrada opcional: JPG, PNG ou WebP de até 5 MB (enviada ao bucket `midia`). |

## Regras

- Até 3 fóruns ativos por conta.
- Nome e descrição passam pela moderação de texto.

## Resposta

`ForumDTO` criado.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Dê um nome com pelo menos 3 caracteres.
- O nome pode ter até 60 caracteres.
- A descrição pode ter até 300 caracteres.
- Escolha se o fórum é público ou privado.
- Conteúdo sexual não é permitido na comunidade. (e as demais mensagens de moderação de texto)
- Já existe um fórum ativo com esse nome.
- Formato de foto inválido. Use JPG, PNG ou WebP.
- A foto pode ter no máximo 5 MB.
- Você já tem 3 fóruns ativos. Arquive um para criar outro.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { criarForum } from "@/api/social.functions";

await criarForum({ nome: "Time Alfa SP", visibilidade: "privado" });
```

`data` enviado à server function (`criarForumFn({ data })`):

```json
{
  "nome": "Time Alfa SP",
  "visibilidade": "privado"
}
```
