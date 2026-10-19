# `linkAnexo`

[← Índice de APIs](../README.md) · Módulo: [Central de Suporte](../README.md#suporte)

| | |
|---|---|
| Server function | `linkAnexoFn` em [`src/api/suporte.functions.ts`](../../../src/api/suporte.functions.ts) |
| Uso no navegador | `linkAnexo(…)` |
| Método | `POST` |
| Acesso | Quem pode ver aquela mensagem (organização: só anexos compartilhados com ela) |

Gera um link assinado de curta duração para abrir ou baixar um anexo do chamado.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `chamadoId` | string |  |
| `mensagemId` | string |  |
| `baixar` | boolean |  |

## Regras

- O acesso é conferido antes de assinar; o bucket é privado.

## Resposta

A URL assinada (não usa `chamar`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Anexo não encontrado.
- Chamado não encontrado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { linkAnexo } from "@/api/suporte.functions";

const url = await linkAnexo("cha-5d1f…", "msg-k3");
window.open(url, "_blank", "noopener");
```

`data` enviado à server function (`linkAnexoFn({ data })`):

```json
{
  "chamadoId": "cha-5d1f…",
  "mensagemId": "msg-k3",
  "baixar": false
}
```

Resultado devolvido pela chamada:

```json
"https://<projeto>.supabase.co/storage/v1/object/sign/documentos/suporte/cha-5d1f…/8e2a….pdf?token=…"
```
