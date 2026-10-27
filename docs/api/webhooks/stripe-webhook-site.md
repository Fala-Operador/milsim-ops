# `POST /api/stripe/webhook`

[← Índice de APIs](../README.md#webhooks) · Código: [`src/routes/api.stripe.webhook.ts`](../../../src/routes/api.stripe.webhook.ts) → `tratarEventoStripe` em [`src/server/pagamentos.server.ts`](../../../src/server/pagamentos.server.ts)

| | |
|---|---|
| Endpoint | `POST https://<site>/api/stripe/webhook` |
| Quem chama | Somente a Edge Function [`milsim-stripe-webhook`](stripe-webhook-edge.md) |
| Autenticação | Cabeçalho `x-milsim-assinatura` (HMAC-SHA256 com `MILSIM_WEBHOOK_SECRET`), conferido sobre o corpo bruto antes de qualquer leitura |

Único endpoint HTTP público do site. Recebe os eventos do Stripe já validados pela Edge
Function e aplica as regras de pagamento, reembolso e repasse.

## Eventos tratados

| Evento do Stripe | Efeito |
|---|---|
| `checkout.session.completed` | Pago (`payment_status = paid`): **confirma** a inscrição (gera o QR, lança a movimentação, notifica). Pagamento assíncrono ainda não compensado: marca `processando` (a vaga continua presa). |
| `checkout.session.async_payment_succeeded` | Confirma a inscrição. |
| `checkout.session.async_payment_failed` | Libera a reserva (vaga, cupom e benefício voltam); pagamento `falhou`. |
| `checkout.session.expired` | Libera a reserva; pagamento `expirado`. |
| `charge.refunded` | Registra o reembolso (integral ou parcial) na inscrição da cobrança. |

Sessões e cobranças da compra de um impulso (`metadata.impulsoId`) seguem a mesma tabela, aplicadas ao impulso: pago → `disponivel` (validade a partir do pagamento), assíncrono pendente → `processando`, expirada ou recusada → `cancelado`, reembolso integral → `reembolsado` e a campanha gerada por ele é encerrada.
| `charge.dispute.created` / `.updated` / `.closed` | Registra a **contestação** (chargeback) no pagamento da inscrição: status (`aberta`, `em_analise`, `ganha`, `perdida`, `encerrada`), valor e motivo. Na primeira vez, o responsável pela organização é notificado. Aparece em Financeiro e nas métricas. |
| `account.updated` (Connect) | Atualiza a situação da conta de recebimento da organização (cadastro, transferências, saques, pendências). |

- Tudo é **idempotente**: o mesmo evento pode chegar várias vezes, e o webhook e o retorno do
  checkout ([`sincronizarPagamento`](../inscricoes/sincronizarPagamento.md)) podem chegar em qualquer ordem.
- Só a sessão de checkout da própria reserva decide sobre ela (sessões antigas são ignoradas).
- Pagamento que chega depois de a reserva ter sido liberada, sem vaga possível ou com o evento
  fora do ar, é **reembolsado** em vez de confirmado.
- A cada evento recebido, reembolsos que falharam antes são tentados de novo (`processarEstornos`).

## Respostas

| Status | Quando |
|---|---|
| `200 { "recebido": true }` | Evento aplicado (ou ignorado por não se aplicar) |
| `400 Assinatura inválida.` | Cabeçalho ausente ou inválido |
| `400 Corpo inválido.` | Corpo não é JSON |
| `500 Falha ao processar.` | Erro ao aplicar; a Edge Function devolve erro ao Stripe, que reenvia depois |

## Exemplo

Simulação de uma chamada da Edge Function (Node 20+), útil para testar o site sem o Stripe:

```ts
import { createHmac } from "node:crypto";

const corpo = JSON.stringify({
  id: "evt_teste_1",
  type: "checkout.session.expired",
  data: { object: { id: "cs_test_a1B2…", status: "expired", payment_status: "unpaid", metadata: { inscricaoId: "ins-0f8c7a1e-…" } } },
});
const t = Math.floor(Date.now() / 1000);
const v1 = createHmac("sha256", process.env.MILSIM_WEBHOOK_SECRET!).update(`${t}.${corpo}`).digest("hex");

const r = await fetch("http://localhost:8080/api/stripe/webhook", {
  method: "POST",
  headers: { "content-type": "application/json", "x-milsim-assinatura": `t=${t},v1=${v1}` },
  body: corpo,
});
console.log(r.status, await r.json()); // 200 { recebido: true }
```
