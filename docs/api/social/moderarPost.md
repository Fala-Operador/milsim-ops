# `moderarPost`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `moderarPostFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `moderarPost(…)` |
| Método | `POST` |
| Acesso | Admin |

Oculta uma publicação (sem precisar de denúncia) ou restaura uma publicação ocultada. Usada na auditoria.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `postId` | string |  |
| `acao` | "ocultar" \| "restaurar" |  |
| `motivo?` | string (até 300) | Obrigatório para ocultar; o autor recebe por notificação. |

## Regras

- Ocultar só vale para publicação publicada; encerra as denúncias pendentes dela como procedentes e avisa o autor.
- Restaurar só vale para publicação ocultada: volta a aparecer para quem pode ver o autor (sem aviso).
- Publicação removida pelo autor não é restaurada.

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe o motivo para ocultar a publicação.
- Publicação indisponível.
- Só publicações ocultadas podem ser restauradas.
- Apenas administradores podem fazer isso.

## Exemplo

```ts
import { moderarPost } from "@/api/social.functions";

await moderarPost("spo-…", "ocultar", "Conteúdo adulto");
await moderarPost("spo-…", "restaurar");
```

`data` enviado à server function (`moderarPostFn({ data })`):

```json
{
  "postId": "spo-…",
  "acao": "ocultar",
  "motivo": "Conteúdo adulto"
}
```
