# `analisarDenuncia`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `analisarDenunciaFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `analisarDenuncia(…)` |
| Método | `POST` |
| Acesso | Gestão do evento: organização dona ou admin |

Registra a decisão sobre uma denúncia: procedente ou descartada. Ocultar o conteúdo é uma ação separada ([`ocultarConteudo`](ocultarConteudo.md)).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `denunciaId` | string |  |
| `decisao` | "procedente" \| "descartada" |  |

## Regras

- A decisão muda o status da denúncia e fica registrada na moderação.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Denúncia não encontrada.
- Apenas a organização do evento e a administração podem fazer isso.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { analisarDenuncia } from "@/api/comunidade.functions";

await analisarDenuncia("den-3", "procedente");
```

`data` enviado à server function (`analisarDenunciaFn({ data })`):

```json
{
  "denunciaId": "den-3",
  "decisao": "procedente"
}
```

Resultado devolvido pela chamada:

```json
null
```
