# `criarPublicacao`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `criarPublicacaoFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `criarPublicacao(…)` |
| Método | `POST` |
| Acesso | Membro do evento (inscrição confirmada) ou gestão (organização do evento/admin); em fóruns "só gestão", apenas a gestão |

Publica no fórum (texto e até 4 imagens). A gestão pode marcar como **importante**, o que notifica todos com acesso.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |
| `texto` | string (até 2000) | Texto ou imagem é obrigatório. |
| `imagens` | { url, alt? }[] (até 4) | `url` em data URL; vai para o Storage. |
| `importante?` | boolean | Só tem efeito para a gestão. |

## Regras

- Fórum precisa estar ativo (não arquivado) e visível para a pessoa (público "todos" ou o exército dela).
- Participante suspenso no evento não publica.
- Notificações: importante → todos com acesso; comum → só quem segue o fórum. A organização é avisada.

## Resposta

A `Publicacao` criada.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Conteúdo indisponível ou você não tem acesso a ele.
- Entre na sua conta para continuar.
- O texto pode ter no máximo 2000 caracteres.
- Envie no máximo [limite] imagem(ns).
- Escreva um texto ou adicione uma imagem.

## Exemplo

```ts
import { criarPublicacao } from "@/api/comunidade.functions";

const pub = await criarPublicacao({
  forumId: "for-geral-mv76", texto: "Briefing às 7h no portão principal.",
  imagens: [{ url: "data:image/jpeg;base64,/9j/4AAQ…", alt: "Mapa do campo" }],
  importante: true,
});
```

`data` enviado à server function (`criarPublicacaoFn({ data })`):

```json
{
  "forumId": "for-geral-mv76",
  "texto": "Briefing às 7h no portão principal.",
  "imagens": [
    {
      "url": "data:image/jpeg;base64,/9j/4AAQ…",
      "alt": "Mapa do campo"
    }
  ],
  "importante": true
}
```

Resultado devolvido pela chamada:

```json
{
  "id": "pub-q1w2",
  "forumId": "for-geral-mv76",
  "importante": true,
  "imagens": [
    {
      "url": "https://<projeto>.supabase.co/storage/v1/object/public/midia/…",
      "alt": "Mapa do campo"
    }
  ]
}
```
