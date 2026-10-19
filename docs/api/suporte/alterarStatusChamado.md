# `alterarStatusChamado`

[← Índice de APIs](../README.md) · Módulo: [Central de Suporte](../README.md#suporte)

| | |
|---|---|
| Server function | `alterarStatusChamadoFn` em [`src/api/suporte.functions.ts`](../../../src/api/suporte.functions.ts) |
| Uso no navegador | `alterarStatusChamado(…)` |
| Método | `POST` |
| Acesso | Admin (aguardar/resolver); solicitante ou admin (reabrir/fechar) |

Muda o status do chamado.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `chamadoId` | string |  |
| `acao` | "aguardar" \| "resolver" \| "reabrir" \| "fechar" |  |
| `descricao?` | string (até 500) | Obrigatória para `resolver` (a solução). |

## Regras

- `aguardar` → aguardando participante; `resolver` → resolvido; `reabrir` (só de resolvido) → em atendimento ou aberto; `fechar` → fechado (só leitura, sem volta).
- A outra parte é notificada.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Descreva brevemente a solução.
- Chamado fechado: somente leitura.
- Somente quem atende pode resolver.
- Só chamados resolvidos podem ser reabertos.
- O chamado já está resolvido.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { alterarStatusChamado } from "@/api/suporte.functions";

await alterarStatusChamado("cha-5d1f…", "resolver", "Pagamento confirmado pelo Stripe; ingresso liberado.");
```

`data` enviado à server function (`alterarStatusChamadoFn({ data })`):

```json
{
  "chamadoId": "cha-5d1f…",
  "acao": "resolver",
  "descricao": "Pagamento confirmado pelo Stripe; ingresso liberado."
}
```

Resultado devolvido pela chamada:

```json
null
```
