# `confirmarInscricao`

[← Índice de APIs](../README.md) · Módulo: [Inscrições e pagamento](../README.md#inscricoes)

| | |
|---|---|
| Server function | `confirmarInscricaoFn` em [`src/api/inscricoes.functions.ts`](../../../src/api/inscricoes.functions.ts) |
| Uso no navegador | `confirmarInscricao(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa (sempre para si mesma) |

Inscreve a pessoa logada no evento. Sem valor a pagar (ou sem Stripe), confirma na hora; com valor, cria a **reserva** (`pendente`, 32 min) e devolve a URL do Stripe Checkout.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |
| `tipoId` | string | Tipo de ingresso. |
| `exercitoId` | string |  |
| `codigoCupom?` | string | Não combina com cortesia nem benefício. |
| `cortesiaId?` | string | Resgate de cortesia. |
| `voucherId?` | string | Benefício de recompensa (gamificação). |
| `clienteId?` | string (8–64, letras, números, hífen) | Chave de idempotência: a mesma chave em todas as tentativas do mesmo envio. |

## Regras

- Tudo é validado numa única transação: evento publicado, autorização de menores, inscrição única, tipo, exército, capacidades (evento, exército, tipo e lote), lote vigente e cupom/cortesia/benefício.
- **Idempotente** com `clienteId`: repetir a chamada devolve a mesma inscrição (e reabre o mesmo checkout), sem gastar o cupom de novo.
- Uma nova tentativa substitui a reserva pendente anterior da pessoa, salvo se o pagamento dela já estiver em processamento.
- A origem (`plataforma`/`cortesia`) e o titular são decididos pelo servidor.
- Com reserva, cupom e benefício ficam presos até o pagamento; se a reserva for liberada, voltam.

## Resposta

`{ inscricao, urlPagamento? }`. Com `urlPagamento`, redirecione para o Stripe.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Chave de operação inválida.
- Evento não encontrado.
- Evento não está disponível para inscrição.
- Usuário não encontrado.
- Participantes de 15 a 17 anos precisam da autorização do responsável aprovada antes de se inscrever.
- Você já possui uma inscrição ativa neste evento.
- Você já tem um pagamento em processamento para este evento. Aguarde a confirmação.
- Tipo de ingresso indisponível.
- Exército inválido.
- Evento esgotado.
- O [exército] não possui vagas.
- Este tipo de ingresso esgotou.
- Cortesia inválida.
- Cortesia já utilizada ou indisponível.
- Cortesia expirada.
- Esta cortesia foi emitida para outro e-mail.
- Cortesias não aceitam cupom.
- Cortesias não aceitam benefício de recompensa.
- Tipo de ingresso diferente do convite.
- A venda de ingressos deste evento ainda não está aberta. (ingresso pago com pagamento online e organização sem conta de recebimento ativa)
- As inscrições deste ingresso estão indisponíveis: [motivo].
- O benefício não pode ser combinado com cupom.
- Benefício indisponível ou fora da validade.
- A campanha deste benefício não está ativa.
- Este benefício não vale para este evento.
- Este benefício não vale para este tipo de ingresso.
- Cupom não encontrado para esta operação.
- Este cupom está inativo.
- Este cupom atingiu o limite de utilizações.
- Este cupom ainda não está valendo.
- Este cupom expirou.
- Este cupom não vale para o tipo de ingresso escolhido.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { confirmarInscricao } from "@/api/inscricoes.functions";

const clienteId = useRef(crypto.randomUUID()); // mesma chave em reenvios

const r = await confirmarInscricao({
  eventoId: "evt-mv76xwom-mgios", tipoId: "tp-tatico", exercitoId: "ex-alfa",
  codigoCupom: "OPERADOR15", clienteId: clienteId.current,
});
if (r.urlPagamento) window.location.assign(r.urlPagamento);
else navigate({ to: "/app/ingressos" });
```

`data` enviado à server function (`confirmarInscricaoFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios",
  "tipoId": "tp-tatico",
  "exercitoId": "ex-alfa",
  "codigoCupom": "OPERADOR15",
  "clienteId": "0f8c7a1e-5b2d-4c3e-9a11-7d6e5f4a3b2c"
}
```

Resultado devolvido pela chamada:

```json
{
  "inscricao": {
    "id": "ins-0f8c7a1e-5b2d-4c3e-9a11-7d6e5f4a3b2c",
    "status": "pendente",
    "valorCentavos": 7000,
    "descontoCentavos": 1050,
    "pagamento": {
      "provedor": "stripe",
      "status": "aguardando",
      "valorCentavos": 5950,
      "expiraEm": "2026-10-19T18:32:00.000Z"
    }
  },
  "urlPagamento": "https://checkout.stripe.com/c/pay/cs_test_…"
}
```
