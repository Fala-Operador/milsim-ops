# `criarCortesia`

[← Índice de APIs](../README.md) · Módulo: [Organizador](../README.md#organizador)

| | |
|---|---|
| Server function | `criarCortesiaFn` em [`src/api/organizador.functions.ts`](../../../src/api/organizador.functions.ts) |
| Uso no navegador | `criarCortesia(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin |

Emite uma cortesia (ingresso gratuito) de uso único para um e-mail convidado. Devolve o código para montar o link `/inscricao/<evento>?cortesia=<código>`.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |
| `nomeConvidado` | string |  |
| `emailConvidado` | string | Só esse e-mail consegue resgatar. |
| `tipoId` | string | Tipo de ingresso do convite. |
| `exercitoId?` | string |  |
| `validade` | ISO 8601 | Depois disso, a cortesia expira. |

## Regras

- O resgate não passa por lote nem cupom e não aceita benefício de recompensa.
- Uma cortesia, uma inscrição.

## Resposta

O código da cortesia (`CORT-…`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { criarCortesia } from "@/api/organizador.functions";

const codigo = await criarCortesia({
  eventoId: "evt-mv76xwom-mgios", nomeConvidado: "Carlos Lima", emailConvidado: "carlos@exemplo.com",
  tipoId: "tp-tatico", validade: "2026-11-10T23:59:00.000Z",
});
const link = `/inscricao/evt-mv76xwom-mgios?cortesia=${codigo}`;
```

`data` enviado à server function (`criarCortesiaFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios",
  "nomeConvidado": "Carlos Lima",
  "emailConvidado": "carlos@exemplo.com",
  "tipoId": "tp-tatico",
  "validade": "2026-11-10T23:59:00.000Z"
}
```

Resultado devolvido pela chamada:

```json
"CORT-7KQ2M9"
```
