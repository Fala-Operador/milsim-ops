# `sair`

[← Índice de APIs](../README.md) · Módulo: [Sessão e leitura](../README.md#sessao)

| | |
|---|---|
| Server function | `sairFn` em [`src/api/sessao.functions.ts`](../../../src/api/sessao.functions.ts) |
| Uso no navegador | `sair(…)` |
| Método | `POST` |
| Acesso | Pública |

Encerra a sessão (`signOut`) e limpa os cookies. Devolve a visão de visitante.

## Entrada

Nenhuma.

## Regras

- A cópia local do tema da conta (`milsim-demo:tema-conta`) é apagada pelo navegador ao sair.

## Resposta

`null`; a visão de visitante é aplicada.

## Exemplo

```ts
import { sair } from "@/api/sessao.functions";

await sair();
```

Resultado devolvido pela chamada:

```json
null
```
