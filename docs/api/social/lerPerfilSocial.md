# `lerPerfilSocial`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `perfilSocialFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `lerPerfilSocial(…)` |
| Método | `POST` |
| Acesso | Pública |

Cabeçalho social de um perfil: seguidores, seguindo, público/privado e a relação com quem vê.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `usuarioId` | string (UUID) |  |

## Regras

- `relacao`: `eu`, `nenhuma`, `pendente`, `seguindo` ou `bloqueado`.
- `postsVisiveis` indica se a aba Publicações mostra os posts.

## Resposta

`PerfilSocialDTO`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Perfil indisponível.

## Exemplo

```ts
import { lerPerfilSocial } from "@/api/social.functions";

await lerPerfilSocial("2f0c…");
```

`data` enviado à server function (`perfilSocialFn({ data })`):

```json
{
  "usuarioId": "2f0c…"
}
```
