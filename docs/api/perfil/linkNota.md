# `linkNota`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `linkNotaFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `linkNota(…)` |
| Método | `POST` |
| Acesso | Dono do equipamento |

Gera um link assinado de 60 segundos para ver ou baixar a nota fiscal.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `equipamentoId` | string |  |
| `baixar` | boolean | `true` força o download com o nome original. |

## Regras

- Ninguém além do dono (nem organizador, nem admin) consegue o link.

## Resposta

A URL assinada (não usa `chamar`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Documento não encontrado.
- Equipamento não encontrado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { linkNota } from "@/api/perfil.functions";

const url = await linkNota("eqp-7h2k", false);
window.open(url, "_blank", "noopener,noreferrer");
```

`data` enviado à server function (`linkNotaFn({ data })`):

```json
{
  "equipamentoId": "eqp-7h2k",
  "baixar": false
}
```

Resultado devolvido pela chamada:

```json
"https://<projeto>.supabase.co/storage/v1/object/sign/documentos/<usuario>/<uuid>.pdf?token=…"
```
