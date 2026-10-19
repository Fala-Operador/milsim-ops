# `editarPublicacao`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `editarPublicacaoFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `editarPublicacao(…)` |
| Método | `POST` |
| Acesso | Autor do conteúdo |

Edita texto e imagens da própria publicação.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `pubId` | string |  |
| `texto` | string (até 2000) |  |
| `imagens` | { url, alt? }[] (até 4) |  |

## Regras

- Não edita em fórum arquivado.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode editar suas próprias publicações.
- Conteúdo indisponível ou você não tem acesso a ele.
- Este fórum está arquivado.
- Entre na sua conta para continuar.
- O texto pode ter no máximo 2000 caracteres.
- Envie no máximo [limite] imagem(ns).
- Escreva um texto ou adicione uma imagem.

## Exemplo

```ts
import { editarPublicacao } from "@/api/comunidade.functions";

await editarPublicacao("pub-q1w2", "Briefing às 7h30 no portão principal.", []);
```

`data` enviado à server function (`editarPublicacaoFn({ data })`):

```json
{
  "pubId": "pub-q1w2",
  "texto": "Briefing às 7h30 no portão principal.",
  "imagens": []
}
```

Resultado devolvido pela chamada:

```json
null
```
