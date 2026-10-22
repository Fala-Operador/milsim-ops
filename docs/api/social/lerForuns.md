# `lerForuns`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `forunsFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `lerForuns(…)` |
| Método | `POST` |
| Acesso | Pública |

Lista de fóruns ativos (os da pessoa primeiro, depois os mais movimentados).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `busca?` | string (até 60) | Parte do nome. |
| `meus?` | boolean | Só os fóruns em que a pessoa é membro ou pediu para entrar. |
| `offset?` | number | Paginação (30 por página). |

## Regras

- Fórum privado aparece (nome e descrição); o conteúdo não.
- `pedidosPendentes` só vem preenchido para dono e moderadores.
- Fóruns de quem bloqueou (ou foi bloqueado por) quem vê ficam de fora.

## Resposta

`ForumDTO[]`.

## Erros

Nenhum erro de regra específico (falhas de banco viram mensagem genérica com código).

## Exemplo

```ts
import { lerForuns } from "@/api/social.functions";

await lerForuns({ busca: "time" });
```

`data` enviado à server function (`forunsFn({ data })`):

```json
{
  "busca": "time"
}
```
