# `reenviarConfirmacao`

[← Índice de APIs](../README.md) · Módulo: [Sessão e leitura](../README.md#sessao)

| | |
|---|---|
| Server function | `reenviarConfirmacaoFn` em [`src/api/sessao.functions.ts`](../../../src/api/sessao.functions.ts) |
| Uso no navegador | `reenviarConfirmacao(…)` |
| Método | `POST` |
| Acesso | Pública |

Reenvia o e-mail de confirmação de cadastro.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `email` | string |  |
| `captcha?` | string | Token do Cloudflare Turnstile. |

## Regras

- Sempre responde sucesso, sem revelar se existe cadastro pendente com o e-mail.
- Intervalo mínimo entre e-mails: 1 minuto (Supabase Auth).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Aguarde um minuto para pedir outro e-mail.
- Não conseguimos confirmar que você não é um robô. Refaça a verificação e tente de novo.

## Exemplo

```ts
import { reenviarConfirmacao } from "@/api/sessao.functions";

await reenviarConfirmacao("operador@exemplo.com", token);
```

`data` enviado à server function (`reenviarConfirmacaoFn({ data })`):

```json
{
  "email": "operador@exemplo.com",
  "captcha": "0.xxxx"
}
```
