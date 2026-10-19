# `enviarRegistros`

[← Índice de APIs](../README.md) · Módulo: [Métricas](../README.md#analytics)

| | |
|---|---|
| Server function | `registrarAnalyticsFn` em [`src/api/analytics.functions.ts`](../../../src/api/analytics.functions.ts) |
| Uso no navegador | `enviarRegistros(…)` |
| Método | `POST` |
| Acesso | Pública (sem login) |

Recebe em lote os registros anônimos de métricas (exibição, clique, visita, início e conclusão de inscrição…). Chamada por `src/services/analytics.ts`, nunca diretamente pelas telas.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `registros` | RegistroAnalytics[] (até 50) | Cada um: `id`, `tipo`, `eventoId`, `visitanteId`, `sessaoId`, `origem`, `secaoId?`, `posicao?`, `campanhaId?`, `fluxoId?`, `inscricaoId?`, `em` (ms). |

## Regras

- Só ids aleatórios: nunca nome, e-mail, CPF ou conteúdo digitado.
- O servidor descarta registros de eventos inexistentes e acessos de admin e da própria organização.
- Campanha de outro evento é descartada (origem vira `direto`); o horário é limitado às últimas 24 h.
- Gravação append-only e idempotente por `id`.

## Resposta

Quantos registros foram aceitos (não usa `chamar`).

## Exemplo

```ts
// Uso interno: src/services/analytics.ts agrupa e envia.
import { enviarRegistros } from "@/api/analytics.functions";

await enviarRegistros([{ id: "r-1", tipo: "visita", eventoId: "evt-mv76xwom-mgios", visitanteId: "v-9k", sessaoId: "s-2", origem: "campanha", campanhaId: "cmp-insta1", em: Date.now() }]);
```

`data` enviado à server function (`registrarAnalyticsFn({ data })`):

```json
{
  "registros": [
    {
      "id": "r-1",
      "tipo": "visita",
      "eventoId": "evt-mv76xwom-mgios",
      "visitanteId": "v-9k",
      "sessaoId": "s-2",
      "origem": "campanha",
      "campanhaId": "cmp-insta1",
      "em": 1792430000000
    }
  ]
}
```

Resultado devolvido pela chamada:

```json
1
```
