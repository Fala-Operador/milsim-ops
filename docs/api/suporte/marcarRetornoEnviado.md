# `marcarRetornoEnviado`

[← Índice de APIs](../README.md) · Módulo: [Central de Suporte](../README.md#suporte)

| | |
|---|---|
| Server function | `marcarRetornoFn` em [`src/api/suporte.functions.ts`](../../../src/api/suporte.functions.ts) |
| Uso no navegador | `marcarRetornoEnviado(…)` |
| Método | `POST` |
| Acesso | Organizador da organização destinatária do encaminhamento |

A organização sinaliza que já respondeu ao encaminhamento.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `chamadoId` | string |  |
| `encaminhamentoId` | string |  |

## Regras

- Idempotente: repetir não gera novo aviso.
- Os admins são notificados.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Chamado não encontrado.
- Chamado fechado: somente leitura.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { marcarRetornoEnviado } from "@/api/suporte.functions";

await marcarRetornoEnviado("cha-5d1f…", "msg-enc-1c9b");
```

`data` enviado à server function (`marcarRetornoFn({ data })`):

```json
{
  "chamadoId": "cha-5d1f…",
  "encaminhamentoId": "msg-enc-1c9b"
}
```

Resultado devolvido pela chamada:

```json
null
```
