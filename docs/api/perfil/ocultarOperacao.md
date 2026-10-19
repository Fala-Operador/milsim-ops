# `ocultarOperacao`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `ocultarOperacaoFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `ocultarOperacao(…)` |
| Método | `POST` |
| Acesso | Dono do perfil (a própria conta) |

Oculta (ou volta a mostrar) uma operação no histórico público do perfil.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |
| `oculta` | boolean |  |

## Regras

- Só afeta a exibição; a participação continua contando para insígnias.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { ocultarOperacao } from "@/api/perfil.functions";

await ocultarOperacao("evt-serra-verde", true);
```

`data` enviado à server function (`ocultarOperacaoFn({ data })`):

```json
{
  "eventoId": "evt-serra-verde",
  "oculta": true
}
```

Resultado devolvido pela chamada:

```json
null
```
