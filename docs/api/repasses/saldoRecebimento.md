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

## Resposta

`SaldoRecebimento` (`src/lib/repasses.ts`) ou `undefined` (não usa `chamar`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode configurar os recebimentos da sua organização.
- Não foi possível falar com o Stripe agora. Tente novamente em instantes.
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
