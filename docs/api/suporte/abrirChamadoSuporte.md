# `abrirChamadoSuporte`

[← Índice de APIs](../README.md) · Módulo: [Central de Suporte](../README.md#suporte)

| | |
|---|---|
| Server function | `abrirChamadoSuporteFn` em [`src/api/suporte.functions.ts`](../../../src/api/suporte.functions.ts) |
| Uso no navegador | `abrirChamadoSuporte(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Abre um chamado na Central de Suporte, sobre um evento ou sobre a plataforma, com anexo opcional.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `clienteId` | string (8–64) | Id gerado no navegador; reenviar com o mesmo id não duplica o chamado. |
| `tipo` | "evento" \| "plataforma" |  |
| `eventoId?` | string | Obrigatório quando `tipo = evento`. |
| `assunto` | string (até 140) |  |
| `categoria` | string | Inscrição, Pagamento, Logística, Regras, Conta, Funcionamento ou Outro. |
| `descricao` | string (até 4000) |  |
| `vinculadoA?` | string | Chamado anterior relacionado. |
| `anexo?` | { nome, dataUrl } | JPEG, PNG, WebP ou PDF, até 5 MB; vai para o bucket privado `documentos` (`suporte/…`). |

## Regras

- A triagem é só da administração; a organização do evento só vê o que for encaminhado a ela.
- Os admins são notificados.

## Resposta

O `Chamado` criado (protocolo derivado do id).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe o assunto.
- Descreva a solicitação.
- Descrição muito longa.
- Categoria inválida.
- Escolha o evento.
- Identificador inválido.
- Evento não encontrado.
- Chamado anterior não encontrado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { abrirChamadoSuporte } from "@/api/suporte.functions";

const clienteId = useRef(crypto.randomUUID());
await abrirChamadoSuporte({
  clienteId: clienteId.current, tipo: "evento", eventoId: "evt-mv76xwom-mgios",
  assunto: "Pagamento não confirmado", categoria: "Pagamento",
  descricao: "Paguei com PIX e o ingresso continua pendente.",
});
```

`data` enviado à server function (`abrirChamadoSuporteFn({ data })`):

```json
{
  "clienteId": "5d1f0c7e-4a3b-4c2d-9e8f-1a2b3c4d5e6f",
  "tipo": "evento",
  "eventoId": "evt-mv76xwom-mgios",
  "assunto": "Pagamento não confirmado",
  "categoria": "Pagamento",
  "descricao": "Paguei com PIX e o ingresso continua pendente."
}
```

Resultado devolvido pela chamada:

```json
{
  "id": "cha-5d1f0c7e4a3b4c2d9e8f1a2b",
  "status": "aberto",
  "tipo": "evento"
}
```
