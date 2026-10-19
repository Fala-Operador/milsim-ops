# `cancelarInscricao`

[← Índice de APIs](../README.md) · Módulo: [Inscrições e pagamento](../README.md#inscricoes)

| | |
|---|---|
| Server function | `cancelarInscricaoFn` em [`src/api/inscricoes.functions.ts`](../../../src/api/inscricoes.functions.ts) |
| Uso no navegador | `cancelarInscricao(…)` |
| Método | `POST` |
| Acesso | Titular, organização do evento ou admin |

Cancela uma inscrição confirmada (estorno integral) ou libera uma reserva pendente.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `inscricaoId` | string |  |
| `motivo` | string (até 1000) | Obrigatório. |

## Regras

- Confirmada → `estornada`: invalida o QR, libera a vaga, registra o estorno e notifica. O histórico é preservado.
- Pagamento online: marca `estorno_pendente` e, depois de gravar, cria o reembolso no Stripe (idempotente). Falhas ficam registradas e são repetidas.
- Reserva pendente: é liberada (cupom e benefício voltam) e o checkout aberto é expirado. Com pagamento em processamento, não pode cancelar.

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe a justificativa do cancelamento.
- O pagamento desta reserva já está em processamento. Aguarde a confirmação para cancelar.
- Inscrição não encontrada ou já cancelada.
- Inscrição não encontrada.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { cancelarInscricao } from "@/api/inscricoes.functions";

await cancelarInscricao("ins-0f8c7a1e-…", "Não poderei comparecer.");
```

`data` enviado à server function (`cancelarInscricaoFn({ data })`):

```json
{
  "inscricaoId": "ins-0f8c7a1e-…",
  "motivo": "Não poderei comparecer."
}
```

Resultado devolvido pela chamada:

```json
null
```
