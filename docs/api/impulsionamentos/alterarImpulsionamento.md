# `alterarImpulsionamento`

[← Índice de APIs](../README.md) · Módulo: [Impulsionamento](../README.md#impulsionamentos)

| | |
|---|---|
| Server function | `alterarImpulsionamentoFn` em [`src/api/impulsionamentos.functions.ts`](../../../src/api/impulsionamentos.functions.ts) |
| Uso no navegador | `alterarImpulsionamento(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Pausa, retoma ou encerra uma campanha de impulsionamento.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id` | string |  |
| `acao` | "pausar" \| "retomar" \| "encerrar" |  |

## Regras

- Rascunho não pausa; encerrada não muda mais.
- Auditado.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Campanha não encontrada.
- Campanha já encerrada.
- Rascunhos não podem ser pausados.
- Somente a administração gerencia impulsionamentos.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { alterarImpulsionamento } from "@/api/impulsionamentos.functions";

await alterarImpulsionamento("imp-2b", "pausar");
```

`data` enviado à server function (`alterarImpulsionamentoFn({ data })`):

```json
{
  "id": "imp-2b",
  "acao": "pausar"
}
```

Resultado devolvido pela chamada:

```json
null
```
