# `publicarMissao`

[← Índice de APIs](../README.md) · Módulo: [Missões pré-evento](../README.md#missoes)

| | |
|---|---|
| Server function | `publicarMissaoFn` em [`src/api/missoes.functions.ts`](../../../src/api/missoes.functions.ts) |
| Uso no navegador | `publicarMissao(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin |

Publica a missão (sai do rascunho) e avisa os destinatários **uma única vez**: post importante em "Avisos oficiais" (missão para todos) ou no fórum do exército; sem fórum do exército, notificação direta.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `missaoId` | string |  |

## Regras

- Não publica missão com prazo vencido.
- Missão de um exército não é anunciada no fórum geral (o briefing não vaza para o outro lado).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Missão não encontrada.
- O prazo desta missão já passou. Ajuste antes de publicar.
- Só a organização do evento pode gerenciar as missões.
- A campanha de missões deste evento já foi encerrada.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { publicarMissao } from "@/api/missoes.functions";

await publicarMissao("mis-mv9q1z-k3a8");
```

`data` enviado à server function (`publicarMissaoFn({ data })`):

```json
{
  "missaoId": "mis-mv9q1z-k3a8"
}
```

Resultado devolvido pela chamada:

```json
null
```
