# `responderPrivacidade`

[← Índice de APIs](../README.md) · Módulo: [Administração](../README.md#admin)

| | |
|---|---|
| Server function | `responderPrivacidadeFn` em [`src/api/admin.functions.ts`](../../../src/api/admin.functions.ts) |
| Uso no navegador | `responderPrivacidade(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Responde e conclui uma solicitação de privacidade (LGPD).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `solicitacaoId` | string |  |
| `resposta` | string (até 2000) | Obrigatória. |

## Regras

- A solicitação vira `respondida` e o solicitante é notificado com a resposta.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe a resposta.
- Solicitação não encontrada.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { responderPrivacidade } from "@/api/admin.functions";

await responderPrivacidade("priv-a1", "Exportação enviada para o seu e-mail.");
```

`data` enviado à server function (`responderPrivacidadeFn({ data })`):

```json
{
  "solicitacaoId": "priv-a1",
  "resposta": "Exportação enviada para o seu e-mail."
}
```

Resultado devolvido pela chamada:

```json
null
```
