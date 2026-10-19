# `alternarCurtida`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `alternarCurtidaFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `alternarCurtida(…)` |
| Método | `POST` |
| Acesso | Membro do evento (inscrição confirmada) ou gestão (organização do evento/admin) |

Curte ou descurte uma publicação.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `pubId` | string |  |

## Regras

- Não curte publicação removida, em fórum arquivado ou estando suspenso.

## Resposta

`true` se ficou curtida, `false` se a curtida foi retirada.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Conteúdo indisponível ou você não tem acesso a ele.
- Você não pode curtir esta publicação no momento.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { alternarCurtida } from "@/api/comunidade.functions";

const curtiu = await alternarCurtida("pub-q1w2");
```

`data` enviado à server function (`alternarCurtidaFn({ data })`):

```json
{
  "pubId": "pub-q1w2"
}
```

Resultado devolvido pela chamada:

```json
true
```
