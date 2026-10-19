# `criarCampanha`

[← Índice de APIs](../README.md) · Módulo: [Métricas](../README.md#analytics)

| | |
|---|---|
| Server function | `criarCampanhaFn` em [`src/api/analytics.functions.ts`](../../../src/api/analytics.functions.ts) |
| Uso no navegador | `criarCampanha(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin |

Cria uma campanha de rastreio (link com `?cmp=<id>`) para medir de onde vêm visitas e inscrições.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |
| `nome` | string (1–60) |  |
| `origem` | "instagram" \| "whatsapp" \| "parceiro" \| "lancamento" \| "outro" |  |

## Resposta

A `Campanha` criada (não usa `chamar`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você não pode criar campanhas para este evento.
- Informe o nome da campanha.
- Digite um nome para identificar a campanha.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { criarCampanha } from "@/api/analytics.functions";

const c = await criarCampanha("evt-mv76xwom-mgios", "Post do Instagram", "instagram");
const link = `${location.origin}/eventos/evt-mv76xwom-mgios?cmp=${c.id}`;
```

`data` enviado à server function (`criarCampanhaFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios",
  "nome": "Post do Instagram",
  "origem": "instagram"
}
```

Resultado devolvido pela chamada:

```json
{
  "id": "cmp-3f9a1c2b4d5e",
  "eventoId": "evt-mv76xwom-mgios",
  "nome": "Post do Instagram",
  "origem": "instagram",
  "criadoEm": "2026-10-19T17:00:00.000Z"
}
```
