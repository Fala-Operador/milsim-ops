# `seguir`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `seguirFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `seguir(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Segue uma pessoa (ou pede para seguir, se o perfil é privado).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `usuarioId` | string (UUID) |  |

## Regras

- Perfil público: aprovado na hora e a pessoa recebe "Novo seguidor".
- Perfil privado: vira pedido e a pessoa recebe "Pedido para seguir".
- Bloqueio em qualquer sentido impede.

## Resposta

`"seguindo"` ou `"pendente"`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você não pode seguir a si mesmo.
- Perfil indisponível.
- Não é possível seguir esta conta.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { seguir } from "@/api/social.functions";

await seguir("2f0c…");
```

`data` enviado à server function (`seguirFn({ data })`):

```json
{
  "usuarioId": "2f0c…"
}
```
