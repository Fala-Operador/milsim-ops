# `fixarPublicacao`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `fixarPublicacaoFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `fixarPublicacao(…)` |
| Método | `POST` |
| Acesso | Gestão do evento: organização dona ou admin |

Fixa ou desafixa uma publicação no topo do fórum.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `pubId` | string |  |

## Regras

- Alterna: chamar de novo desafixa.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Apenas a organização do evento e a administração podem fazer isso.
- Conteúdo indisponível ou você não tem acesso a ele.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { fixarPublicacao } from "@/api/comunidade.functions";

await fixarPublicacao("pub-q1w2");
```

`data` enviado à server function (`fixarPublicacaoFn({ data })`):

```json
{
  "pubId": "pub-q1w2"
}
```

Resultado devolvido pela chamada:

```json
null
```
