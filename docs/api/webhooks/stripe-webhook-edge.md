# `milsim-stripe-webhook` (Edge Function)

[← Índice de APIs](../README.md#webhooks) · Código: [`supabase/functions/milsim-stripe-webhook/index.ts`](../../../supabase/functions/milsim-stripe-webhook/index.ts)

| | |
|---|---|
| Endpoint | `POST https://<ref>.supabase.co/functions/v1/milsim-stripe-webhook` |
| Quem chama | Stripe (eventos da conta da plataforma e das contas Connect) |
| Autenticação | Assinatura `Stripe-Signature` (HMAC-SHA256), sem JWT do Supabase (`--no-verify-jwt`) |
| Publicação | `supabase functions deploy milsim-stripe-webhook --no-verify-jwt` (o deploy do GitHub Actions publica sozinho) |

Endpoint cadastrado no painel do Stripe. Confere a assinatura do Stripe com os segredos
guardados **só no Supabase** e repassa o evento, intacto, para a API do site
([`POST /api/stripe/webhook`](stripe-webhook-site.md)), assinado com um segredo interno. Nenhuma
regra de negócio roda aqui.

## Configuração (Supabase → Edge Functions → Secrets)

| Segredo | Valor |
|---|---|
| `STRIPE_PAYMENTS_WEBHOOK_SIGNING_SECRET` | `whsec_…` do endpoint "Events on your account" |
| `STRIPE_CONNECT_WEBHOOK_SIGNING_SECRET` | `whsec_…` do endpoint "Events on Connected accounts" |
| `STRIPE_WEBHOOK_FORWARD_URL` | `https://<site>/api/stripe/webhook` |
| `STRIPE_WEBHOOK_FORWARD_SECRET` | segredo aleatório, igual ao configurado no site |

`STRIPE_WEBHOOK_SECRET` e a função `stripe-webhook` pertencem à integração Stripe Sync do
Supabase (sincroniza dados do Stripe para o schema `stripe`). Por isso esta função tem outro nome
e não lê esse segredo. O destino do Stripe Sync no Stripe (`metadata.managed_by = stripe-sync`)
aponta para `/functions/v1/stripe-webhook` e não deve apontar para esta função.

Eventos que precisam estar marcados no Stripe: `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
`checkout.session.expired`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`,
`charge.dispute.closed` e, no endpoint de Connect, `account.updated`.

## Regras

- Só aceita `POST`.
- Assinatura no formato do Stripe (`t=…,v1=…` sobre `"<t>.<corpo>"`), com tolerância de 5 minutos
  contra replay e comparação em tempo constante. Vale qualquer um dos dois segredos.
- Repassa com o cabeçalho `x-milsim-assinatura` no mesmo formato, calculado com
  `MILSIM_WEBHOOK_SECRET`, e espera até 25 s pela resposta do site.
- Qualquer falha devolve erro ao Stripe, que **tenta de novo** mais tarde; o tratamento no site é idempotente.

## Respostas

| Status | Quando |
|---|---|
| `200 { "recebido": true }` | Evento repassado e aceito pelo site |
| `400 Assinatura inválida.` | Cabeçalho ausente, fora da tolerância ou assinatura errada |
| `405 Método não permitido.` | Método diferente de `POST` |
| `500 Função não configurada.` | Falta algum segredo ou a URL do site |
| `502 Falha ao repassar o evento.` | O site respondeu com erro ou não respondeu |

## Exemplo

Teste local com a Stripe CLI, encaminhando para a função publicada:

```bash
stripe listen --forward-to https://<ref>.supabase.co/functions/v1/milsim-stripe-webhook
stripe trigger checkout.session.completed
```

Requisição que o Stripe envia (resumida):

```http
POST /functions/v1/milsim-stripe-webhook HTTP/1.1
Content-Type: application/json
Stripe-Signature: t=1792430000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd

{"id":"evt_1Q…","type":"checkout.session.completed","data":{"object":{"id":"cs_test_a1B2…","payment_status":"paid","metadata":{"inscricaoId":"ins-0f8c7a1e-…"}}}}
```

Resposta:

```json
{ "recebido": true }
```
