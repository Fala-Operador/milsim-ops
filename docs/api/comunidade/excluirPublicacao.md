# `excluirPublicacao`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `excluirPublicacaoFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `excluirPublicacao(…)` |
| Método | `POST` |
| Acesso | Autor do conteúdo |

Remove a própria publicação. Sem respostas, ela é apagada (com as curtidas); com respostas, o texto e as imagens são apagados e ela fica marcada como "removida pelo autor", para a conversa continuar legível.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `pubId` | string |  |

## Regras

- A gestão não exclui conteúdo de terceiros: oculta ([`ocultarConteudo`](ocultarConteudo.md)).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode excluir suas próprias publicações.
- Entre na sua conta para continuar.
- Conteúdo indisponível ou você não tem acesso a ele.

## Exemplo

```ts
import { excluirPublicacao } from "@/api/comunidade.functions";

await excluirPublicacao("pub-q1w2");
```

`data` enviado à server function (`excluirPublicacaoFn({ data })`):

```json
{
  "pubId": "pub-q1w2"
}
```

Resultado devolvido pela chamada:

```json
null
```
