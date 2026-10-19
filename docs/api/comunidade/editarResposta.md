# `editarResposta`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `editarRespostaFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `editarResposta(…)` |
| Método | `POST` |
| Acesso | Autor do conteúdo |

Edita a própria resposta.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `respostaId` | string |  |
| `texto` | string (até 2000) |  |
| `imagem?` | { url, alt? } |  |

## Regras

- Não edita em fórum arquivado ou se a publicação ficou indisponível.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode editar suas próprias respostas.
- Não é possível editar agora.
- Entre na sua conta para continuar.
- O texto pode ter no máximo 2000 caracteres.
- Envie no máximo [limite] imagem(ns).
- Escreva um texto ou adicione uma imagem.
- Conteúdo indisponível ou você não tem acesso a ele.

## Exemplo

```ts
import { editarResposta } from "@/api/comunidade.functions";

await editarResposta("res-a8", "Confirmado, chego às 6h50.");
```

`data` enviado à server function (`editarRespostaFn({ data })`):

```json
{
  "respostaId": "res-a8",
  "texto": "Confirmado, chego às 6h50."
}
```

Resultado devolvido pela chamada:

```json
null
```
