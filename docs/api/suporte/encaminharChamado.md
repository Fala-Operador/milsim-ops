# `encaminharChamado`

[← Índice de APIs](../README.md) · Módulo: [Central de Suporte](../README.md#suporte)

| | |
|---|---|
| Server function | `encaminharChamadoFn` em [`src/api/suporte.functions.ts`](../../../src/api/suporte.functions.ts) |
| Uso no navegador | `encaminharChamado(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Encaminha um chamado de evento para a organização responsável, com orientação e os anexos escolhidos.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `chamadoId` | string |  |
| `clienteId` | string (8–64) | Idempotência. |
| `orientacao` | string (até 4000) | O que a organização deve verificar. |
| `anexos` | string[] (até 20) | Ids das mensagens cujos anexos serão compartilhados. |

## Regras

- Só chamados do tipo evento.
- A organização vê só o encaminhamento (sem a descrição original, a conversa ou anexos não compartilhados).
- Status exibido passa a "Aguardando organizador" até o retorno.

## Resposta

O id do encaminhamento.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Descreva a demanda para o organizador.
- Orientação muito longa.
- Somente a administração encaminha chamados.
- Chamado fechado: somente leitura.
- Somente chamados de evento podem ser encaminhados à organização.
- Anexo não encontrado.
- Identificador inválido.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { encaminharChamado } from "@/api/suporte.functions";

await encaminharChamado("cha-5d1f…", crypto.randomUUID(), "Confirme se o pagamento entrou no Stripe.", ["msg-k3"]);
```

`data` enviado à server function (`encaminharChamadoFn({ data })`):

```json
{
  "chamadoId": "cha-5d1f…",
  "clienteId": "1c9b…",
  "orientacao": "Confirme se o pagamento entrou no Stripe.",
  "anexos": [
    "msg-k3"
  ]
}
```

Resultado devolvido pela chamada:

```json
"msg-enc-1c9b"
```
