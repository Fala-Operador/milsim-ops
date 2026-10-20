# `temporadaMissoes`

[← Índice de APIs](../README.md) · Módulo: [Missões pré-evento](../README.md#missoes)

| | |
|---|---|
| Server function | `temporadaMissoesFn` em [`src/api/missoes.functions.ts`](../../../src/api/missoes.functions.ts) |
| Uso no navegador | `temporadaMissoes(…)` |
| Método | `POST` |
| Acesso | Gestão da organização, admin ou quem já se inscreveu num evento dela |

Ranking da temporada: pontos de missões somados em todos os eventos da organização que começam no ano.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `organizacaoId` | string |  |
| `ano` | inteiro |  |

## Regras

- Top 20, com a posição de quem consulta.

## Resposta

`{ organizacao, ranking[], minhaPosicao? }` (não usa `chamar`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Temporada disponível para quem participa dos eventos desta organização.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { temporadaMissoes } from "@/api/missoes.functions";

const t = await temporadaMissoes("org-mv76sa2r-8frtq", 2027);
```

`data` enviado à server function (`temporadaMissoesFn({ data })`):

```json
{
  "organizacaoId": "org-mv76sa2r-8frtq",
  "ano": 2027
}
```

Resultado devolvido pela chamada:

```json
{
  "organizacao": "Fala Operador Podcast",
  "ranking": [
    {
      "posicao": 1,
      "nome": "Falcão",
      "pontos": 120,
      "missoes": 9,
      "eu": true
    }
  ],
  "minhaPosicao": 1
}
```
