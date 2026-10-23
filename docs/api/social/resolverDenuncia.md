# `resolverDenuncia`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `resolverDenunciaFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `resolverDenuncia(…)` |
| Método | `POST` |
| Acesso | Admin |

Oculta a publicação denunciada ou descarta a denúncia.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `denunciaId` | string |  |
| `acao` | "ocultar" \| "descartar" |  |
| `motivo?` | string (até 300) | Obrigatório para ocultar; o autor recebe por notificação. |

## Regras

- Ocultar encerra todas as denúncias pendentes daquela publicação como procedentes.
- Descartar encerra só a denúncia informada.

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Denúncia não encontrada ou já resolvida.
- Informe o motivo para ocultar a publicação.
- Apenas administradores podem fazer isso.

## Exemplo

```ts
import { resolverDenuncia } from "@/api/social.functions";

await resolverDenuncia("sdn-…", "ocultar", "Conteúdo adulto");
```

`data` enviado à server function (`resolverDenunciaFn({ data })`):

```json
{
  "denunciaId": "sdn-…",
  "acao": "ocultar",
  "motivo": "Conteúdo adulto"
}
```
