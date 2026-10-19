# `salvarEvento`

[← Índice de APIs](../README.md) · Módulo: [Organizador](../README.md#organizador)

| | |
|---|---|
| Server function | `salvarEventoFn` em [`src/api/organizador.functions.ts`](../../../src/api/organizador.functions.ts) |
| Uso no navegador | `salvarEvento(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin (criação: organizador da própria organização ou admin) |

Cria ou atualiza um evento. O editor envia o evento **completo**; status, organização e data de criação são decididos pelo servidor.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id` | string | Id do evento (gerado no navegador para eventos novos). |
| `organizacaoId` | string |  |
| `nome` | string (até 200) |  |
| `capacidadeTotal` | inteiro (0–100000) |  |
| `…demais campos de `Evento`` |  | Exércitos, tipos, lotes, cronograma, regras, imagem, endereço, `whatsappContato`, `whatsappGrupoUrl` etc. (`src/lib/domain/types.ts`). |

## Regras

- Evento novo nasce em `rascunho`; o status só muda por publicar/cancelar.
- A capacidade total e a de cada exército não podem ficar abaixo da ocupação atual (confirmadas + reservas de pagamento vigentes).
- Nomes de exército não se repetem. Evento publicado precisa de modalidade.
- WhatsApp: número normalizado com DDI; o link do grupo só aceita convites `https://chat.whatsapp.com/…`.
- Troca de modalidade é auditada.

## Resposta

O `Evento` gravado (com os campos normalizados).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Capacidade total abaixo da ocupação atual.
- Capacidade do [exército] abaixo da ocupação atual.
- Há exércitos com nomes duplicados.
- Eventos publicados precisam de uma modalidade principal.
- Você só pode gerenciar eventos da sua organização.
- Você só pode criar eventos da sua organização.
- WhatsApp inválido. Informe DDD e número, ex.: (11) 99999-9999.
- Use o link de convite do grupo, no formato https://chat.whatsapp.com/…
- Entre na sua conta para continuar.

## Exemplo

```ts
import { salvarEvento } from "@/api/organizador.functions";

const salvo = await salvarEvento({ ...evento, nome: "Tempestade do deserto 2", whatsappContato: "(83) 99999-0000" });
```

`data` enviado à server function (`salvarEventoFn({ data })`):

```json
{
  "id": "evt-mv76xwom-mgios",
  "organizacaoId": "org-mv76sa2r-8frtq",
  "nome": "Tempestade do deserto 2",
  "capacidadeTotal": 120,
  "whatsappContato": "(83) 99999-0000",
  "whatsappGrupoUrl": "https://chat.whatsapp.com/AbCdEf123456GhIj",
  "…": "demais campos do evento"
}
```

Resultado devolvido pela chamada:

```json
{
  "id": "evt-mv76xwom-mgios",
  "status": "rascunho",
  "whatsappContato": "5583999990000",
  "whatsappGrupoUrl": "https://chat.whatsapp.com/AbCdEf123456GhIj"
}
```
