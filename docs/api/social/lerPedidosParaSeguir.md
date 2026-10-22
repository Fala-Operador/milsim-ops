# `lerPedidosParaSeguir`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `pedidosParaSeguirFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `lerPedidosParaSeguir(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Pedidos para seguir aguardando a aprovação da própria conta.

## Entrada

Nenhuma.

## Regras

- Até 100, os mais recentes primeiro.

## Resposta

`{ id, nome, fotoUrl?, pedidoEm }[]`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { lerPedidosParaSeguir } from "@/api/social.functions";

await lerPedidosParaSeguir();
```
