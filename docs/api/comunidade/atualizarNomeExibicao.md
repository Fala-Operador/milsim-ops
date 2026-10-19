# `atualizarNomeExibicao`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `atualizarNomeExibicaoFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `atualizarNomeExibicao(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada |

Define o nome exibido na comunidade (no lugar do nome completo).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `nome` | string (até 40 caracteres) | Vazio volta ao padrão: primeiro e último nome. |

## Regras

- O nome completo, CPF e contatos nunca aparecem na comunidade.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Use no máximo 40 caracteres.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { atualizarNomeExibicao } from "@/api/comunidade.functions";

await atualizarNomeExibicao("Falcão");
```

`data` enviado à server function (`atualizarNomeExibicaoFn({ data })`):

```json
{
  "nome": "Falcão"
}
```

Resultado devolvido pela chamada:

```json
null
```
