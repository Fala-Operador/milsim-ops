# `listarMetricas`

[← Índice de APIs](../README.md) · Módulo: [Métricas](../README.md#analytics)

| | |
|---|---|
| Server function | `listarAnalyticsFn` em [`src/api/analytics.functions.ts`](../../../src/api/analytics.functions.ts) |
| Uso no navegador | `listarMetricas(…)` |
| Método | `GET` |
| Acesso | Organizador (eventos da organização) ou admin (todos) |

Devolve os registros de métricas e as campanhas dos eventos que a pessoa gere. As fórmulas (CTR, conversão, conclusão) ficam em `src/lib/analytics.ts`.

## Entrada

Nenhuma.

## Regras

- Lê em páginas de 1000 registros.

## Resposta

`{ registros, campanhas }` (não usa `chamar`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Sem acesso às métricas.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { listarMetricas } from "@/api/analytics.functions";

const { registros, campanhas } = await listarMetricas();
```

Resultado devolvido pela chamada:

```json
{
  "registros": [
    {
      "id": "r-1",
      "tipo": "visita",
      "eventoId": "evt-mv76xwom-mgios",
      "origem": "campanha",
      "em": 1792430000000
    }
  ],
  "campanhas": [
    {
      "id": "cmp-insta1",
      "eventoId": "evt-mv76xwom-mgios",
      "nome": "Post do Instagram",
      "origem": "instagram"
    }
  ]
}
```
