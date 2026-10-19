# `abrirPainelStripe`

[← Índice de APIs](../README.md) · Módulo: [Repasse (Stripe Connect)](../README.md#repasses)

| | |
|---|---|
| Server function | `abrirPainelRecebimentoFn` em [`src/api/repasses.functions.ts`](../../../src/api/repasses.functions.ts) |
| Uso no navegador | `abrirPainelStripe(…)` |
| Método | `POST` |
| Acesso | Quem gere a organização |

Gera um link de acesso ao painel Express do Stripe (saldo, saques, dados bancários).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `organizacaoId` | string |  |

## Regras

- O link é de uso único e curta duração.

## Resposta

`{ url }` (não usa `chamar`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode configurar os recebimentos da sua organização.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { abrirPainelStripe } from "@/api/repasses.functions";

const { url } = await abrirPainelStripe("org-mv76sa2r-8frtq");
window.open(url, "_blank", "noopener");
```

`data` enviado à server function (`abrirPainelRecebimentoFn({ data })`):

```json
{
  "organizacaoId": "org-mv76sa2r-8frtq"
}
```

Resultado devolvido pela chamada:

```json
{
  "url": "https://connect.stripe.com/express/…"
}
```
