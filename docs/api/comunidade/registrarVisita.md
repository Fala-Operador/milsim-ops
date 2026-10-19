# `registrarVisita`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `registrarVisitaFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `registrarVisita(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada |

Registra a última visita da pessoa à comunidade do evento; base do contador de novidades por fórum.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |

## Regras

- Guarda só a data da última visita (`visitas_comunidade`).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { registrarVisita } from "@/api/comunidade.functions";

await registrarVisita("evt-mv76xwom-mgios");
```

`data` enviado à server function (`registrarVisitaFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios"
}
```

Resultado devolvido pela chamada:

```json
null
```
