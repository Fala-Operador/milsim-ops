# `aprovarAutorizacaoResponsavel`

[← Índice de APIs](../README.md) · Módulo: [Administração](../README.md#admin)

| | |
|---|---|
| Server function | `aprovarAutorizacaoFn` em [`src/api/admin.functions.ts`](../../../src/api/admin.functions.ts) |
| Uso no navegador | `aprovarAutorizacaoResponsavel(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Aprova a autorização do responsável de um participante de 15 a 17 anos, liberando inscrições.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `usuarioId` | string |  |

## Regras

- O participante é notificado (salvo se silenciou notificações).
- Ação auditada (`aprovar_autorizacao_responsavel`).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Usuário não encontrado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { aprovarAutorizacaoResponsavel } from "@/api/admin.functions";

await aprovarAutorizacaoResponsavel("190a6b05-…");
```

`data` enviado à server function (`aprovarAutorizacaoFn({ data })`):

```json
{
  "usuarioId": "190a6b05-…"
}
```

Resultado devolvido pela chamada:

```json
null
```
