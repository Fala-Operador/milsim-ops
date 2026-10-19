# `responderChamado` (legada)

[← Índice de APIs](../README.md) · Módulo: [Conta](../README.md#conta)

| | |
|---|---|
| Server function | `responderChamadoFn` em [`src/api/conta.functions.ts`](../../../src/api/conta.functions.ts) |
| Uso no navegador | `responderChamado(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

**Legada.** Respondia chamado no modelo antigo. Use [`enviarMensagemSuporte`](../suporte/enviarMensagemSuporte.md).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `chamadoId` | string |  |
| `corpo` | string (até 4000) |  |

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Escreva a mensagem.
- Chamado não encontrado.
- Você não participa deste chamado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { responderChamado } from "@/api/conta.functions";

await responderChamado("cha-123", "Obrigado!");
```

`data` enviado à server function (`responderChamadoFn({ data })`):

```json
{
  "chamadoId": "cha-123",
  "corpo": "Obrigado!"
}
```

Resultado devolvido pela chamada:

```json
null
```
