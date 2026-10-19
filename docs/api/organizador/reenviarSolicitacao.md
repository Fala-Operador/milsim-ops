# `reenviarSolicitacao`

[← Índice de APIs](../README.md) · Módulo: [Organizador](../README.md#organizador)

| | |
|---|---|
| Server function | `reenviarSolicitacaoFn` em [`src/api/organizador.functions.ts`](../../../src/api/organizador.functions.ts) |
| Uso no navegador | `reenviarSolicitacao(…)` |
| Método | `POST` |
| Acesso | Dono da solicitação |

Reenvia uma solicitação que recebeu pedido de ajustes, com os dados corrigidos.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `solicitacaoId` | string |  |
| `dados.nomeOrganizacao` | string |  |
| `dados.instagram?` | string |  |
| `dados.telefone` | string |  |

## Regras

- Só solicitações em `ajustes_solicitados` podem ser reenviadas; voltam para `pendente`.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Esta solicitação não pode ser reenviada.
- Solicitação não encontrada.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { reenviarSolicitacao } from "@/api/organizador.functions";

await reenviarSolicitacao("sol-z9", { nomeOrganizacao: "Fala Operador Podcast", instagram: "@falaoperador", telefone: "(83) 99999-0000" });
```

`data` enviado à server function (`reenviarSolicitacaoFn({ data })`):

```json
{
  "solicitacaoId": "sol-z9",
  "dados": {
    "nomeOrganizacao": "Fala Operador Podcast",
    "instagram": "@falaoperador",
    "telefone": "(83) 99999-0000"
  }
}
```

Resultado devolvido pela chamada:

```json
null
```
