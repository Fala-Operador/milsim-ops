# `moverPublicacao`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `moverPublicacaoFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `moverPublicacao(…)` |
| Método | `POST` |
| Acesso | Gestão do evento: organização dona ou admin |

Move uma publicação para outro fórum do mesmo evento.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `pubId` | string |  |
| `forumDestinoId` | string |  |

## Regras

- Só entre fóruns com o mesmo público (evita expor conteúdo de um exército para outro).
- O destino não pode estar arquivado.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Fórum de destino inválido.
- Só é possível mover entre fóruns com o mesmo público.
- O fórum de destino está arquivado.
- Apenas a organização do evento e a administração podem fazer isso.
- Conteúdo indisponível ou você não tem acesso a ele.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { moverPublicacao } from "@/api/comunidade.functions";

await moverPublicacao("pub-q1w2", "for-logistica-mv76");
```

`data` enviado à server function (`moverPublicacaoFn({ data })`):

```json
{
  "pubId": "pub-q1w2",
  "forumDestinoId": "for-logistica-mv76"
}
```

Resultado devolvido pela chamada:

```json
null
```
