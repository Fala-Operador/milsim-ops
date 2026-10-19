# `suspenderUsuario`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `suspenderUsuarioFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `suspenderUsuario(…)` |
| Método | `POST` |
| Acesso | Gestão do evento: organização dona ou admin |

Suspende um participante na comunidade do evento: ele continua lendo, mas não publica, responde nem curte.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |
| `usuarioId` | string |  |
| `justificativa` | string (até 1000) | Obrigatória. |

## Regras

- Vale só para a comunidade daquele evento.
- Auditado na moderação.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe a justificativa.
- Apenas a organização do evento e a administração podem fazer isso.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { suspenderUsuario } from "@/api/comunidade.functions";

await suspenderUsuario("evt-mv76xwom-mgios", "3bbdfd0d-…", "Ofensas repetidas.");
```

`data` enviado à server function (`suspenderUsuarioFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios",
  "usuarioId": "3bbdfd0d-…",
  "justificativa": "Ofensas repetidas."
}
```

Resultado devolvido pela chamada:

```json
null
```
