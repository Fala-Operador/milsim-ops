# `enviarMensagemSuporte`

[← Índice de APIs](../README.md) · Módulo: [Central de Suporte](../README.md#suporte)

| | |
|---|---|
| Server function | `enviarMensagemSuporteFn` em [`src/api/suporte.functions.ts`](../../../src/api/suporte.functions.ts) |
| Uso no navegador | `enviarMensagemSuporte(…)` |
| Método | `POST` |
| Acesso | Solicitante, admin ou organização que recebeu encaminhamento |

Envia uma mensagem no chamado (com anexo opcional). Mensagens de encaminhamento (`encaminhamentoId`) vão para o canal interno entre administração e organização.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `chamadoId` | string |  |
| `clienteId` | string (8–64) | Idempotência: o mesmo id não duplica a mensagem. |
| `corpo` | string (até 4000) |  |
| `anexo?` | { nome, dataUrl } |  |
| `encaminhamentoId?` | string | Conversa interna de um encaminhamento. |

## Regras

- O canal interno nunca chega ao participante.
- A organização responde só à administração (no encaminhamento).
- Mensagem do participante em `aguardando_participante` volta o chamado para `em_atendimento`; a primeira resposta da administração tira de `aberto`.
- Chamado resolvido: o participante reabre antes de escrever; fechado é só leitura.

## Resposta

A `MensagemChamado` criada.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Escreva a mensagem.
- Mensagem muito longa.
- Chamado fechado: somente leitura.
- Chamado não encontrado.
- A organização responde apenas à administração.
- Identificador inválido.
- Este chamado foi resolvido. Reabra o chamado para enviar uma nova mensagem.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { enviarMensagemSuporte } from "@/api/suporte.functions";

await enviarMensagemSuporte("cha-5d1f…", crypto.randomUUID(), "Segue o comprovante.", { nome: "comprovante.pdf", dataUrl });
```

`data` enviado à server function (`enviarMensagemSuporteFn({ data })`):

```json
{
  "chamadoId": "cha-5d1f…",
  "clienteId": "8e2a…",
  "corpo": "Segue o comprovante.",
  "anexo": {
    "nome": "comprovante.pdf",
    "dataUrl": "data:application/pdf;base64,JVBERi0x…"
  }
}
```

Resultado devolvido pela chamada:

```json
{
  "id": "msg-k3",
  "tipo": "mensagem",
  "canal": "participante"
}
```
