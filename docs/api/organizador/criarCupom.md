# `criarCupom`

[← Índice de APIs](../README.md) · Módulo: [Organizador](../README.md#organizador)

| | |
|---|---|
| Server function | `criarCupomFn` em [`src/api/organizador.functions.ts`](../../../src/api/organizador.functions.ts) |
| Uso no navegador | `criarCupom(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin |

Cria um cupom de desconto percentual para o evento.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |
| `codigo` | string (3–40) | Letras, números, hífen ou sublinhado; normalizado em maiúsculas. |
| `descontoPercentual` | inteiro (1–100) |  |
| `validoDe` | ISO 8601 |  |
| `validoAte` | ISO 8601 \| null | `null` = sem término. |
| `limiteUsos` | inteiro ≥ 1 \| null | `null` = ilimitado. |
| `tiposElegiveis` | string[] | Ao menos um tipo do evento. |
| `ativo` | boolean |  |

## Regras

- Código único por evento.
- O uso é contado na inscrição (e devolvido se a reserva for liberada).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Evento não encontrado.
- Use de 3 a 40 letras, números, hífen ou sublinhado, sem espaços.
- Já existe um cupom com este código nesta operação.
- O desconto deve ser um número inteiro maior que 0 e de até 100%.
- Selecione pelo menos um tipo de ingresso desta operação.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { criarCupom } from "@/api/organizador.functions";

await criarCupom({
  eventoId: "evt-mv76xwom-mgios", codigo: "OPERADOR15", descontoPercentual: 15,
  validoDe: "2026-10-20T00:00:00.000Z", validoAte: null, limiteUsos: 50,
  tiposElegiveis: ["tp-tatico"], ativo: true,
});
```

`data` enviado à server function (`criarCupomFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios",
  "codigo": "OPERADOR15",
  "descontoPercentual": 15,
  "validoDe": "2026-10-20T00:00:00.000Z",
  "validoAte": null,
  "limiteUsos": 50,
  "tiposElegiveis": [
    "tp-tatico"
  ],
  "ativo": true
}
```

Resultado devolvido pela chamada:

```json
null
```
