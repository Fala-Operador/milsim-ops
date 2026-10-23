# `lerDenunciasPendentes`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `denunciasPendentesFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `lerDenunciasPendentes(…)` |
| Método | `POST` |
| Acesso | Admin |

Fila de moderação: denúncias pendentes com a publicação denunciada.

## Entrada

Nenhuma.

## Regras

- Até 100, das mais antigas para as mais novas.
- Mostra a publicação mesmo de perfil privado (o admin precisa julgar).

## Resposta

`DenunciaDTO[]`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Apenas administradores podem fazer isso.

## Exemplo

```ts
import { lerDenunciasPendentes } from "@/api/social.functions";

await lerDenunciasPendentes();
```
