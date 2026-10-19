# `responder`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `responderFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `responder(…)` |
| Método | `POST` |
| Acesso | Membro do evento (inscrição confirmada) ou gestão (organização do evento/admin); em fóruns com respostas "só gestão", apenas a gestão |

Responde a uma publicação (texto e uma imagem opcional).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `pubId` | string |  |
| `texto` | string (até 2000) |  |
| `imagem?` | { url, alt? } | Uma imagem. |

## Regras

- Não responde publicação oculta, removida ou com respostas fechadas (exceto a gestão).
- O autor da publicação é notificado.

## Resposta

A `Resposta` criada.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Conteúdo indisponível ou você não tem acesso a ele.
- Respostas indisponíveis para esta publicação.
- Entre na sua conta para continuar.
- O texto pode ter no máximo 2000 caracteres.
- Envie no máximo [limite] imagem(ns).
- Escreva um texto ou adicione uma imagem.

## Exemplo

```ts
import { responder } from "@/api/comunidade.functions";

await responder("pub-q1w2", "Confirmado, estarei lá.");
```

`data` enviado à server function (`responderFn({ data })`):

```json
{
  "pubId": "pub-q1w2",
  "texto": "Confirmado, estarei lá."
}
```

Resultado devolvido pela chamada:

```json
{
  "id": "res-a8",
  "publicacaoId": "pub-q1w2",
  "texto": "Confirmado, estarei lá."
}
```
