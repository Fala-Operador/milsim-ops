# `marcarLidoServidor`

[← Índice de APIs](../README.md) · Módulo: [Central de Suporte](../README.md#suporte)

| | |
|---|---|
| Server function | `marcarChamadoLidoFn` em [`src/api/suporte.functions.ts`](../../../src/api/suporte.functions.ts) |
| Uso no navegador | `marcarLidoServidor(…)` |
| Método | `POST` |
| Acesso | Quem vê o chamado |

Registra até onde a pessoa leu o chamado (contador de não lidas). Fica no servidor e vale em todos os aparelhos.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `chamadoId` | string |  |
| `ate` | ISO 8601 | Data da última mensagem lida. |

## Regras

- Guarda as 200 leituras mais recentes por pessoa.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { marcarLidoServidor } from "@/api/suporte.functions";

await marcarLidoServidor("cha-5d1f…", "2026-10-19T17:05:00.000Z");
```

`data` enviado à server function (`marcarChamadoLidoFn({ data })`):

```json
{
  "chamadoId": "cha-5d1f…",
  "ate": "2026-10-19T17:05:00.000Z"
}
```

Resultado devolvido pela chamada:

```json
null
```
