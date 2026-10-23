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
| `senha` | string (até 200) | Mínimo de 6 caracteres, com letra minúscula, letra maiúscula, número e símbolo; não pode ser senha vazada. |

## Resposta

`null`; a pessoa fica logada.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- A senha deve ter ao menos 6 caracteres.
- A senha deve ter letra minúscula, letra maiúscula, número e símbolo.
- Esta senha já apareceu em vazamentos de dados e não pode ser usada. Escolha outra.
- Senha fraca. Escolha uma senha mais difícil de adivinhar.
- A nova senha precisa ser diferente da atual.
- Sessão de recuperação expirada. Solicite um novo link.

## Exemplo

```ts
import { definirNovaSenha } from "@/api/sessao.functions";

await definirNovaSenha("Nova-Senha#1");
```

`data` enviado à server function (`definirNovaSenhaFn({ data })`):

```json
{
  "senha": "Nova-Senha#1"
}
```

Resultado devolvido pela chamada:

```json
null
```
