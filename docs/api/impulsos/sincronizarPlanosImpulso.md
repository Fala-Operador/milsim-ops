# `sincronizarPlanosImpulso`

[← Índice de APIs](../README.md) · Módulo: [Impulsos das organizações](../README.md#impulsos)

| | |
|---|---|
| Server function | `sincronizarPlanosImpulsoFn` em [`src/api/impulsos.functions.ts`](../../../src/api/impulsos.functions.ts) |
| Uso no navegador | `sincronizarPlanosImpulso()` |
| Método | `POST` |
| Acesso | Somente admin |

Cria ou atualiza no catálogo do Stripe da plataforma o produto de cada um dos seis tipos de impulso (botão "Sincronizar com o Stripe" em Loja da plataforma → Impulsos de operações).

## Entrada

Nenhuma.

## Regras

- Um produto por tipo, com id fixo `milsim_impulso_<tipo>` (repetir nunca duplica): nome, descrição, imagem (só https; caminhos do site ganham a origem), metadata do tipo e `active` igual a "à venda".
- Preço em BRL igual ao do tipo como preço padrão do produto. Preços do Stripe não mudam de valor: com valor novo, cria um preço, passa a usá-lo como padrão e arquiva os antigos.
- Grava `stripe_product_id`, `stripe_price_id` e `stripe_synced_at` em `boost_plans`.
- O checkout do impulso usa o preço do catálogo quando ele ainda é o valor da compra; senão, um preço avulso ligado ao produto. Tipo ainda não sincronizado é sincronizado na primeira compra. Falha do Stripe aqui não impede a venda.
- Também roda ao salvar os tipos ([`salvarPlanosImpulso`](salvarPlanosImpulso.md)).

## Resposta

`{ sincronizados, erros }`: quantos tipos ficaram em dia e a mensagem de cada tipo que o Stripe recusou.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Somente a administração sincroniza os impulsos com o Stripe.
- Os pagamentos online ainda não estão ativados na plataforma.

## Exemplo

```ts
import { sincronizarPlanosImpulso } from "@/api/impulsos.functions";

const { sincronizados, erros } = await sincronizarPlanosImpulso();
```

Resultado devolvido pela chamada:

```json
{
  "sincronizados": 6,
  "erros": []
}
```
