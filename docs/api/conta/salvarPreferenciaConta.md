# `salvarPreferenciaConta`

[← Índice de APIs](../README.md) · Módulo: [Conta](../README.md#conta)

| | |
|---|---|
| Server function | `salvarPreferenciaFn` em [`src/api/conta.functions.ts`](../../../src/api/conta.functions.ts) |
| Uso no navegador | `salvarPreferenciaConta(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Salva as modalidades favoritas da conta (usadas para ordenar a página inicial "Para você").

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `estado` | "pendente" \| "todas" \| "selecionadas" |  |
| `modalidades` | string[] (até 20) | Ids do catálogo de `src/lib/modalidades.ts`. |

## Regras

- Ids fora do catálogo são descartados; `selecionadas` sem nenhuma modalidade válida volta a `pendente`.
- Visitantes guardam a mesma preferência no `localStorage`.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { salvarPreferenciaConta } from "@/api/conta.functions";

await salvarPreferenciaConta({ estado: "selecionadas", modalidades: ["milsim", "real_action"] });
```

`data` enviado à server function (`salvarPreferenciaFn({ data })`):

```json
{
  "estado": "selecionadas",
  "modalidades": [
    "milsim",
    "real_action"
  ]
}
```

Resultado devolvido pela chamada:

```json
null
```
