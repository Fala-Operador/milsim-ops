# `enviarFilaCheckin`

[← Índice de APIs](../README.md) · Módulo: [Check-in](../README.md#checkin)

| | |
|---|---|
| Server function | `sincronizarCheckinsFn` em [`src/api/checkin.functions.ts`](../../../src/api/checkin.functions.ts) |
| Uso no navegador | `enviarFilaCheckin(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin (o próprio operador dos registros) |

Envia a fila de check-ins feita no aparelho da portaria (funciona offline, guardada no IndexedDB) e devolve o resultado de cada operação.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `ops` | RegistroCheckin[] (até 500) | Cada um: `id`, `eventoId`, `inscricaoId`, `tipo` (`entrada`/`reversao`), `revertidoId?`, `origem` (`qr`/`codigo`/`manual`), `motivo?`, `operadorId`, `operadorNome`, `dispositivoId`, `em`, `sync`. |

## Regras

- Idempotente por `id`: reenviar não duplica.
- Segunda entrada da mesma inscrição, inscrição cancelada/estornada ou ingresso de outro evento viram **conflito** (com explicação).
- Registros de outro operador são recusados (cada um sincroniza a própria fila).
- Check-in manual exige motivo; reverter exige justificativa.
- Presença confirmada ou revertida recalcula insígnias e recompensas.

## Resposta

A lista de operações com `sync` = `sincronizado` ou `conflito` (e `conflito` explicando).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você não tem acesso ao check-in deste evento.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { enviarFilaCheckin } from "@/api/checkin.functions";

const resultado = await enviarFilaCheckin(filaPendente);
const conflitos = resultado.filter((r) => r.sync === "conflito");
```

`data` enviado à server function (`sincronizarCheckinsFn({ data })`):

```json
{
  "ops": [
    {
      "id": "chk-a1",
      "eventoId": "evt-mv76xwom-mgios",
      "inscricaoId": "ins-0f8c…",
      "tipo": "entrada",
      "origem": "qr",
      "operadorId": "14c8b8e6-…",
      "operadorNome": "Italo",
      "dispositivoId": "dsp-77",
      "em": "2027-05-27T09:12:00.000Z",
      "sync": "pendente"
    }
  ]
}
```

Resultado devolvido pela chamada:

```json
[
  {
    "id": "chk-a1",
    "sync": "sincronizado"
  }
]
```
