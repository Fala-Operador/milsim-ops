# `salvarPremios`

[← Índice de APIs](../README.md) · Módulo: [Missões pré-evento](../README.md#missoes)

| | |
|---|---|
| Server function | `salvarPremiosFn` em [`src/api/missoes.functions.ts`](../../../src/api/missoes.functions.ts) |
| Uso no navegador | `salvarPremios(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin |

Declara os prêmios do dia do evento por colocação do exército (ex.: "Começa com a base norte").

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |
| `premios` | { colocacao, descricao }[] | Colocação de 1 ao número de exércitos; descrição até 300; vazia = sem prêmio. |

## Regras

- Um prêmio por colocação.
- Os prêmios aparecem para os inscritos antes do encerramento.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Colocação de 1 a [nº de exércitos].
- Um prêmio por colocação.
- Só a organização do evento pode gerenciar as missões.
- A campanha de missões deste evento já foi encerrada.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { salvarPremios } from "@/api/missoes.functions";

await salvarPremios("evt-mv76xwom-mgios", [{ colocacao: 1, descricao: "Começa com a base norte + 1 respawn extra" }, { colocacao: 2, descricao: "Escolhe o horário do briefing" }]);
```

`data` enviado à server function (`salvarPremiosFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios",
  "premios": [
    {
      "colocacao": 1,
      "descricao": "Começa com a base norte + 1 respawn extra"
    }
  ]
}
```

Resultado devolvido pela chamada:

```json
null
```
