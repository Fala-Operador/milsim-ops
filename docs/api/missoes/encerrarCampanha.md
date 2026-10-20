# `encerrarCampanha`

[← Índice de APIs](../README.md) · Módulo: [Missões pré-evento](../README.md#missoes)

| | |
|---|---|
| Server function | `encerrarCampanhaFn` em [`src/api/missoes.functions.ts`](../../../src/api/missoes.functions.ts) |
| Uso no navegador | `encerrarCampanha(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin |

Congela o placar, aplica os prêmios e publica o resultado na comunidade. Depois disso, nada da campanha muda; o prêmio aparece no check-in do dia.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |

## Regras

- Exige avaliar todas as entregas em análise antes.
- Empate divide a colocação (e o prêmio).
- Idempotente.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Avalie as N entrega(s) em análise antes de encerrar.
- Só a organização do evento pode gerenciar as missões.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { encerrarCampanha } from "@/api/missoes.functions";

await encerrarCampanha("evt-mv76xwom-mgios");
```

`data` enviado à server function (`encerrarCampanhaFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios"
}
```

Resultado devolvido pela chamada:

```json
null
```
