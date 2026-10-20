# `placarMissoes`

[← Índice de APIs](../README.md) · Módulo: [Missões pré-evento](../README.md#missoes)

| | |
|---|---|
| Server function | `placarMissoesFn` em [`src/api/missoes.functions.ts`](../../../src/api/missoes.functions.ts) |
| Uso no navegador | `placarMissoes(…)` |
| Método | `POST` |
| Acesso | Inscrito confirmado no evento ou a gestão |

Placar dos exércitos (ao vivo ou congelado) e top 10 individual, calculados no servidor: o navegador não recebe as entregas dos outros.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |

## Regras

- Placar = pontos aprovados ÷ inscritos confirmados do exército + bônus das metas coletivas.
- Ranking individual mostra só o nome de exibição e o exército.
- Não aplica a visão (não usa `chamar`).

## Resposta

`{ encerrada, premios, exercitos[], ranking[], minhaPosicao? }`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- O placar é só para inscritos confirmados e a organização.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { placarMissoes } from "@/api/missoes.functions";

const placar = await placarMissoes("evt-mv76xwom-mgios");
```

`data` enviado à server function (`placarMissoesFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios"
}
```

Resultado devolvido pela chamada:

```json
{
  "encerrada": false,
  "premios": [
    {
      "colocacao": 1,
      "descricao": "Base norte"
    }
  ],
  "exercitos": [
    {
      "exercitoId": "ex-a",
      "nome": "Americanos",
      "pontos": 120,
      "inscritos": 12,
      "media": 10,
      "bonus": 5,
      "total": 15,
      "metas": [
        "Foto do squad"
      ],
      "colocacao": 1,
      "premio": "Base norte"
    }
  ],
  "ranking": [
    {
      "posicao": 1,
      "nome": "Falcão",
      "exercito": "Americanos",
      "pontos": 40,
      "missoes": 3,
      "eu": false
    }
  ]
}
```
