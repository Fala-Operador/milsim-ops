# `marcarIntro`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `marcarIntroFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `marcarIntro(…)` |
| Método | `POST` |
| Acesso | Dono do perfil (a própria conta) |

Marca a apresentação do perfil como vista (não aparece de novo).

## Entrada

Nenhuma.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { marcarIntro } from "@/api/perfil.functions";

await marcarIntro();
```

Resultado devolvido pela chamada:

```json
null
```
