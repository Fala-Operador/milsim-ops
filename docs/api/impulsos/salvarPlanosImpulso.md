# `salvarPlanosImpulso`

[← Índice de APIs](../README.md) · Módulo: [Impulsos das organizações](../README.md#impulsos)

| | |
|---|---|
| Server function | `salvarPlanosImpulsoFn` em [`src/api/impulsos.functions.ts`](../../../src/api/impulsos.functions.ts) |
| Uso no navegador | `salvarPlanosImpulso(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Define preço, validade e venda dos tipos de impulso (Administração → Página inicial e divulgação → Impulsionamentos).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `planos` | { id, precoCentavos, validadeDias, ativo }[] | 1 a 6 tipos; `id` é um dos seis tipos. |

## Regras

- Preço entre R$ 0,00 e R$ 10.000,00 (0 = grátis); validade entre 1 e 365 dias, contada do pagamento.
- Sem registro, vale o padrão: 24h R$ 9,90 · 3 dias R$ 24,90 · 5 dias R$ 34,90 · 7 dias R$ 44,90 · 15 dias R$ 84,90 · 30 dias R$ 149,90, validade 30 dias, à venda.
- Vale para compras novas; impulsos já comprados mantêm preço e validade da compra.
- Fica em `boost_plans`; cada tipo alterado é auditado (`plano_impulso`).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.
- Tipo de impulso desconhecido.
- &lt;tipo&gt;: O preço deve ficar entre R$ 0,00 e R$ 10.000,00.
- &lt;tipo&gt;: A validade deve ficar entre 1 e 365 dias.

## Exemplo

```ts
import { salvarPlanosImpulso } from "@/api/impulsos.functions";

await salvarPlanosImpulso([{ id: "7d", precoCentavos: 4990, validadeDias: 30, ativo: true }]);
```

`data` enviado à server function (`salvarPlanosImpulsoFn({ data })`):

```json
{
  "planos": [
    {
      "id": "7d",
      "precoCentavos": 4990,
      "validadeDias": 30,
      "ativo": true
    }
  ]
}
```

Resultado devolvido pela chamada:

```json
null
```
