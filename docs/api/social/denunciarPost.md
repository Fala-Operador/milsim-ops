# `denunciarPost`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `denunciarPostFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `denunciarPost(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Denuncia uma publicação para a moderação do admin.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `postId` | string |  |
| `motivo` | "adulto" \| "violencia" \| "drogas" \| "ofensa" \| "spam" \| "dados_pessoais" \| "outro" |  |
| `detalhes?` | string (até 500) |  |

## Regras

- Uma denúncia em aberto por pessoa e publicação (repetir não duplica).

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Escolha o motivo da denúncia.
- Você não pode denunciar a própria publicação.
- Publicação indisponível.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { denunciarPost } from "@/api/social.functions";

await denunciarPost("sp-…", "adulto");
```

`data` enviado à server function (`denunciarPostFn({ data })`):

```json
{
  "postId": "sp-…",
  "motivo": "adulto"
}
```
