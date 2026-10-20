# `saldoRecebimento`

[← Índice de APIs](../README.md) · Módulo: [Repasse (Stripe Connect)](../README.md#repasses)

| | |
|---|---|
| Server function | `saldoRecebimentoFn` em [`src/api/repasses.functions.ts`](../../../src/api/repasses.functions.ts) |
| Uso no navegador | `saldoRecebimento(…)` |
| Método | `POST` |
| Acesso | Quem gere a organização |

Lê do Stripe o saldo da conta de recebimento da organização: disponível, a liberar, próximo saque, últimos saques, cronograma de saques e banco de destino (só os últimos dígitos).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `organizacaoId` | string |  |
| `atualizar?` | boolean | `true` ignora o cache e consulta o Stripe agora. |

## Regras

- Só com a conta de recebimento ativa; antes disso devolve `undefined`.
- Cache de 60 s por conta, para não estourar o limite de chamadas do Stripe.
- Só valores em BRL entram nos totais.
- Conta guardada que a chave atual não alcança (conta de teste depois da troca para as chaves de produção, ou conta de outra plataforma/sandbox, que o Stripe recusa com 403 "does not have access to account") é esquecida e a organização faz um cadastro novo. Mensagens de erro do Stripe nunca mostram a chave de API, nem mascarada.

## Resposta

`SaldoRecebimento` (`src/lib/repasses.ts`) ou `undefined` (não usa `chamar`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode configurar os recebimentos da sua organização.
- Falhas do Stripe (`mensagemDeFalhaStripe` em `src/lib/stripe.ts`): "O Stripe não libera a criação de contas conectadas pela API Accounts v1 nesta conta. No painel do Stripe (modo de produção), ative "Accounts v1 support" nas configurações do Connect e tente de novo." (erro de Accounts v1), "O Stripe recusou a chave secreta da plataforma (STRIPE_SERVER_API_KEY). Confira se ela foi copiada inteira e se o site foi publicado de novo depois da troca." (401), "O Stripe recusou esta operação de contas conectadas." (403); as três terminam com a mensagem original entre parênteses, "(Stripe: ...)", "O Stripe Connect ainda não está ativado na conta da plataforma neste modo. Ative o Connect no painel do Stripe (modo de produção) e tente de novo.", "Stripe: <mensagem do Stripe>" (outros 400/404) ou "Não foi possível falar com o Stripe agora. Tente novamente em instantes." (rede ou erro do Stripe).
- Entre na sua conta para continuar.

## Exemplo

```ts
import { saldoRecebimento } from "@/api/repasses.functions";

const saldo = await saldoRecebimento("org-mv76sa2r-8frtq");
const atualizado = await saldoRecebimento("org-mv76sa2r-8frtq", true); // botão "Atualizar"
```

`data` enviado à server function (`saldoRecebimentoFn({ data })`):

```json
{
  "organizacaoId": "org-mv76sa2r-8frtq",
  "atualizar": true
}
```

Resultado devolvido pela chamada:

```json
{
  "disponivelCentavos": 54360,
  "aLiberarCentavos": 11900,
  "proximoSaque": {
    "id": "po_1Q…",
    "valorCentavos": 54360,
    "chegada": "2026-10-22T00:00:00.000Z",
    "status": "in_transit"
  },
  "saques": [
    {
      "id": "po_1Q…",
      "valorCentavos": 54360,
      "chegada": "2026-10-22T00:00:00.000Z",
      "status": "in_transit"
    }
  ],
  "cronograma": "Diário (cada venda fica disponível 2 dias depois)",
  "banco": "Banco do Brasil •••• 4321"
}
```
