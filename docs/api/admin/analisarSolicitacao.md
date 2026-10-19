# `analisarSolicitacao`

[← Índice de APIs](../README.md) · Módulo: [Administração](../README.md#admin)

| | |
|---|---|
| Server function | `analisarSolicitacaoFn` em [`src/api/admin.functions.ts`](../../../src/api/admin.functions.ts) |
| Uso no navegador | `analisarSolicitacao(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Analisa uma solicitação para virar organizador: inicia a análise, aprova, pede ajustes ou rejeita.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `solicitacaoId` | string |  |
| `acao` | "iniciar" \| "aprovar" \| "ajustes" \| "rejeitar" |  |
| `justificativa?` | string (até 1000) | Obrigatória para `ajustes` e `rejeitar`. |

## Regras

- Mapa de status: `iniciar` → `em_analise`, `aprovar` → `aprovada`, `ajustes` → `ajustes_solicitados`, `rejeitar` → `rejeitada`.
- Aprovar cria a **organização** (status `ativa`), promove a pessoa a `organizador` e libera `/organizacao`.
- A pessoa é notificada a cada mudança; toda ação fica na auditoria (`solicitacao_<acao>`).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe a justificativa.
- Solicitação não encontrada.
- Usuário não encontrado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { analisarSolicitacao } from "@/api/admin.functions";

await analisarSolicitacao("sol-x1y2", "aprovar");
await analisarSolicitacao("sol-z9", "ajustes", "Envie o Instagram oficial da organização.");
```

`data` enviado à server function (`analisarSolicitacaoFn({ data })`):

```json
{
  "solicitacaoId": "sol-z9",
  "acao": "ajustes",
  "justificativa": "Envie o Instagram oficial da organização."
}
```

Resultado devolvido pela chamada:

```json
null
```
