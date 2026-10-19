# `ocultarConteudo`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `ocultarConteudoFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `ocultarConteudo(…)` |
| Método | `POST` |
| Acesso | Gestão do evento: organização dona ou admin |

Oculta (ou volta a mostrar) uma publicação ou resposta. Conteúdo oculto só aparece para a gestão.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `alvo` | "publicacao" \| "resposta" |  |
| `alvoId` | string |  |
| `justificativa` | string (até 1000) | Obrigatória. |
| `ocultar` | boolean | `false` reexibe. |

## Regras

- Nada é apagado; a ação fica na moderação com a justificativa.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe a justificativa.
- Apenas a organização do evento e a administração podem fazer isso.
- Conteúdo indisponível ou você não tem acesso a ele.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { ocultarConteudo } from "@/api/comunidade.functions";

await ocultarConteudo("publicacao", "pub-q1w2", "Dados pessoais expostos.");
```

`data` enviado à server function (`ocultarConteudoFn({ data })`):

```json
{
  "alvo": "publicacao",
  "alvoId": "pub-q1w2",
  "justificativa": "Dados pessoais expostos.",
  "ocultar": true
}
```

Resultado devolvido pela chamada:

```json
null
```
