# `destacarEntrega`

[← Índice de APIs](../README.md) · Módulo: [Missões pré-evento](../README.md#missoes)

| | |
|---|---|
| Server function | `destacarEntregaFn` em [`src/api/missoes.functions.ts`](../../../src/api/missoes.functions.ts) |
| Uso no navegador | `destacarEntrega(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin |

Publica uma entrega aprovada em "Avisos oficiais" da comunidade do evento (com o nome de exibição e o exército).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `entregaId` | string |  |

## Regras

- Só com a autorização do participante (`permiteDestaque`).
- Idempotente: destacar de novo não duplica o post.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entrega não encontrada.
- O participante não autorizou destacar esta entrega.
- Só entregas aprovadas podem ser destacadas.
- Esta entrega não tem foto nem texto para destacar.
- A comunidade do evento não está disponível.
- Só a organização do evento pode gerenciar as missões.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { destacarEntrega } from "@/api/missoes.functions";

await destacarEntrega("ent-77a");
```

`data` enviado à server function (`destacarEntregaFn({ data })`):

```json
{
  "entregaId": "ent-77a"
}
```

Resultado devolvido pela chamada:

```json
null
```
