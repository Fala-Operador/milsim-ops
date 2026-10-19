# `alterarStatusSecao`

[← Índice de APIs](../README.md) · Módulo: [Página inicial](../README.md#divulgacao)

| | |
|---|---|
| Server function | `alterarStatusSecaoFn` em [`src/api/divulgacao.functions.ts`](../../../src/api/divulgacao.functions.ts) |
| Uso no navegador | `alterarStatusSecao(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Publica, volta para rascunho ou desativa uma seção.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id` | string |  |
| `status` | "rascunho" \| "publicada" \| "desativada" |  |

## Regras

- Auditado.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Seção não encontrada.
- Somente administradores gerenciam a página inicial.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { alterarStatusSecao } from "@/api/divulgacao.functions";

await alterarStatusSecao("sec-nordeste", "desativada");
```

`data` enviado à server function (`alterarStatusSecaoFn({ data })`):

```json
{
  "id": "sec-nordeste",
  "status": "desativada"
}
```

Resultado devolvido pela chamada:

```json
null
```
