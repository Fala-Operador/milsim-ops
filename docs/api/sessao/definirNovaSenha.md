# `definirNovaSenha`

[← Índice de APIs](../README.md) · Módulo: [Sessão e leitura](../README.md#sessao)

| | |
|---|---|
| Server function | `definirNovaSenhaFn` em [`src/api/sessao.functions.ts`](../../../src/api/sessao.functions.ts) |
| Uso no navegador | `definirNovaSenha(…)` |
| Método | `POST` |
| Acesso | Sessão de recuperação (depois de `validarTokenRecuperacao` ou `trocarCodigoRecuperacao`) |

Define a nova senha da conta (`updateUser`) e devolve a visão da pessoa logada.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `senha` | string (até 200) | Mínimo de 6 caracteres. |

## Resposta

`null`; a pessoa fica logada.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- A senha deve ter ao menos 6 caracteres.
- Sessão de recuperação expirada. Solicite um novo link.

## Exemplo

```ts
import { definirNovaSenha } from "@/api/sessao.functions";

await definirNovaSenha("nova-senha-forte");
```

`data` enviado à server function (`definirNovaSenhaFn({ data })`):

```json
{
  "senha": "nova-senha-forte"
}
```

Resultado devolvido pela chamada:

```json
null
```
