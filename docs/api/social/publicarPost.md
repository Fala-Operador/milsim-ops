# `publicarPost`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `publicarPostFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `publicarPost(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Publica no feed geral ou responde a uma publicação.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `texto` | string | Até 220 caracteres (emoji conta como 1). Pode ser vazio se houver foto. |
| `fotos` | { dados, alt? }[] (até 4) | data URL JPG/PNG/WebP de até 5 MB; `alt` até 200. |
| `respondendoA?` | string | Id do post respondido (precisa estar visível). |
| `forumId?` | string | Publica neste fórum (ignorado em resposta, que herda o fórum do post respondido). |

## Regras

- Texto passa por `moderarTexto` (sexo, drogas, morte/violência real são recusados).
- Ritmo: 10 s entre posts e até 30 por hora.
- Fotos vão para o bucket público `midia`; post e fotos são gravados juntos (`social_create_post`).
- Em fórum (post novo ou resposta a post de fórum), só membro aprovado publica.
- Resposta notifica o autor do post respondido.

## Resposta

`PostDTO` publicado.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Escreva algo ou adicione uma foto.
- Use no máximo 220 caracteres.
- Adicione no máximo 4 fotos.
- Formato de foto inválido. Use JPG, PNG ou WebP.
- Cada foto pode ter no máximo 5 MB.
- Conteúdo sexual não é permitido na comunidade.
- Conteúdo sobre drogas ilícitas não é permitido na comunidade.
- Conteúdo de morte ou violência real não é permitido na comunidade.
- Espere alguns segundos antes de publicar de novo.
- Você atingiu o limite de publicações por hora. Tente mais tarde.
- Publicação indisponível.
- Entre no fórum para publicar nele.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { publicarPost } from "@/api/social.functions";

await publicarPost({ texto: "Domingo tem jogo em Itu!", fotos: [] });
```

`data` enviado à server function (`publicarPostFn({ data })`):

```json
{
  "texto": "Domingo tem jogo em Itu!",
  "fotos": []
}
```
