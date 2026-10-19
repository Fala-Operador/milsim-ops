# `salvarInsignia`

[← Índice de APIs](../README.md) · Módulo: [Gamificação](../README.md#gamificacao)

| | |
|---|---|
| Server function | `salvarInsigniaFn` em [`src/api/gamificacao.functions.ts`](../../../src/api/gamificacao.functions.ts) |
| Uso no navegador | `salvarInsignia(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Cria ou edita uma insígnia e o critério para conquistá-la.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id?` | string |  |
| `nome` | string (até 60) |  |
| `descricao` | string (até 400) |  |
| `icone` | string (emoji) |  |
| `criterio` | { tipo: "operacoes" \| "estados" \| "modalidades", meta: 1–1000 } | Operações com presença válida, UFs distintas ou modalidades distintas. |
| `ativa` | boolean |  |

## Regras

- A concessão é automática e idempotente (`recalcularProgressao`); só conta participação com presença válida em evento finalizado.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe um nome de até 60 caracteres.
- Critério não suportado.
- A meta deve estar entre 1 e 1000.
- Apenas administradores podem fazer isso.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { salvarInsignia } from "@/api/gamificacao.functions";

await salvarInsignia({ nome: "Viajante", descricao: "Jogou em 3 estados.", icone: "🗺️", criterio: { tipo: "estados", meta: 3 }, ativa: true });
```

`data` enviado à server function (`salvarInsigniaFn({ data })`):

```json
{
  "nome": "Viajante",
  "descricao": "Jogou em 3 estados.",
  "icone": "🗺️",
  "criterio": {
    "tipo": "estados",
    "meta": 3
  },
  "ativa": true
}
```

Resultado devolvido pela chamada:

```json
null
```
