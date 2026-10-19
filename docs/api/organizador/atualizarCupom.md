# `atualizarCupom`

[← Índice de APIs](../README.md) · Módulo: [Organizador](../README.md#organizador)

| | |
|---|---|
| Server function | `atualizarCupomFn` em [`src/api/organizador.functions.ts`](../../../src/api/organizador.functions.ts) |
| Uso no navegador | `atualizarCupom(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin |

Atualiza um cupom (o código e o evento não mudam).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `cupomId` | string |  |
| `dados` | objeto | Mesmos campos de `criarCupom`, sem `eventoId` e `codigo`. |

## Regras

- As mesmas validações da criação.
- Desativar não afeta inscrições já feitas.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Cupom não encontrado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { atualizarCupom } from "@/api/organizador.functions";

await atualizarCupom("cup-k2", { descontoPercentual: 10, validoDe: "2026-10-20T00:00:00.000Z", validoAte: "2026-11-30T23:59:00.000Z", limiteUsos: null, tiposElegiveis: ["tp-tatico"], ativo: true });
```

`data` enviado à server function (`atualizarCupomFn({ data })`):

```json
{
  "cupomId": "cup-k2",
  "dados": {
    "descontoPercentual": 10,
    "validoDe": "2026-10-20T00:00:00.000Z",
    "validoAte": "2026-11-30T23:59:00.000Z",
    "limiteUsos": null,
    "tiposElegiveis": [
      "tp-tatico"
    ],
    "ativo": true
  }
}
```

Resultado devolvido pela chamada:

```json
null
```
