# `usarImpulso`

[← Índice de APIs](../README.md) · Módulo: [Impulsos das organizações](../README.md#impulsos)

| | |
|---|---|
| Server function | `usarImpulsoFn` em [`src/api/impulsos.functions.ts`](../../../src/api/impulsos.functions.ts) |
| Uso no navegador | `usarImpulso(…)` |
| Método | `POST` |
| Acesso | Organizador ativo da organização do impulso |

Usa um impulso disponível numa operação da organização: cria uma campanha de impulsionamento ativa.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `impulsoId` | string |  |
| `eventoId` | string | Operação da própria organização. |

## Regras

- O impulso precisa estar `disponivel` e dentro da validade; a operação precisa estar publicada, não encerrada e ter imagem.
- A campanha aparece nas seções de destaque da página inicial, no topo da listagem e na lateral da comunidade geral, em todo o Brasil, com prioridade normal.
- Começa agora ou, se a operação já tem um impulso comprado em vigor ou agendado, quando o último terminar; termina na duração do impulso ou no fim da operação, o que vier primeiro (o tempo que sobra é perdido).
- Depois de usado, o impulso não troca de operação. A administração pode pausar ou encerrar a campanha como qualquer outra.
- Auditado (`impulso_usado`).

## Resposta

A campanha criada (`Impulsionamento`, com `impulsoId`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Impulso não encontrado.
- Este impulso expirou e não pode mais ser usado.
- Este impulso não está disponível para uso.
- Selecione uma operação da sua organização.
- A operação precisa estar publicada.
- A operação já terminou.
- A operação termina antes de os impulsos já agendados acabarem.
- A operação precisa de uma imagem para aparecer em destaque.

## Exemplo

```ts
import { usarImpulso } from "@/api/impulsos.functions";

await usarImpulso("ipc-m1x2-ab12c", "evt-serra-verde");
```

`data` enviado à server function (`usarImpulsoFn({ data })`):

```json
{
  "impulsoId": "ipc-m1x2-ab12c",
  "eventoId": "evt-serra-verde"
}
```

Resultado devolvido pela chamada:

```json
{
  "id": "imp-m1x3-cd34e",
  "eventoId": "evt-serra-verde",
  "nome": "Impulso de 7 dias (organização)",
  "objetivo": "divulgacao",
  "posicoes": [
    "sec-destaques",
    "listagem"
  ],
  "abrangencia": {
    "escopo": "nacional"
  },
  "inicioEm": "2026-10-21T02:05:00.000Z",
  "fimEm": "2026-10-28T02:05:00.000Z",
  "fuso": "America/Sao_Paulo",
  "prioridade": "normal",
  "ordem": 0,
  "status": "ativo",
  "criadoPor": "usr-organizador",
  "criadoEm": "2026-10-21T02:05:00.000Z",
  "atualizadoEm": "2026-10-21T02:05:00.000Z",
  "impulsoId": "ipc-m1x2-ab12c"
}
```
