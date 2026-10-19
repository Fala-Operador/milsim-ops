# `solicitarPrivacidade`

[← Índice de APIs](../README.md) · Módulo: [Conta](../README.md#conta)

| | |
|---|---|
| Server function | `solicitarPrivacidadeFn` em [`src/api/conta.functions.ts`](../../../src/api/conta.functions.ts) |
| Uso no navegador | `solicitarPrivacidade(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Abre uma solicitação de privacidade (LGPD) para a administração.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `tipo` | "acesso" \| "correcao" \| "exportacao" \| "exclusao" |  |
| `detalhes` | string (até 4000) |  |

## Regras

- Todos os admins recebem notificação.
- A resposta é dada por `responderPrivacidade` (admin).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Tipo de solicitação inválido.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { solicitarPrivacidade } from "@/api/conta.functions";

await solicitarPrivacidade("exportacao", "Quero uma cópia dos meus dados.");
```

`data` enviado à server function (`solicitarPrivacidadeFn({ data })`):

```json
{
  "tipo": "exportacao",
  "detalhes": "Quero uma cópia dos meus dados."
}
```

Resultado devolvido pela chamada:

```json
null
```
