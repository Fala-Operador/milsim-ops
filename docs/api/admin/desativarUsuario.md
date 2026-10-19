# `desativarUsuario`

[← Índice de APIs](../README.md) · Módulo: [Administração](../README.md#admin)

| | |
|---|---|
| Server function | `desativarUsuarioFn` em [`src/api/admin.functions.ts`](../../../src/api/admin.functions.ts) |
| Uso no navegador | `desativarUsuario(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Desativa uma conta. Conta desativada é tratada como visitante em toda a aplicação e é deslogada no próximo login.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `usuarioId` | string |  |
| `justificativa` | string (até 1000) | Obrigatória. |

## Regras

- O último admin ativo não pode ser desativado.
- Nada é apagado: o histórico (inscrições, publicações) continua; a ação é auditada.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe a justificativa.
- Usuário não encontrado.
- A aplicação não pode ficar sem administrador ativo.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { desativarUsuario } from "@/api/admin.functions";

await desativarUsuario("3bbdfd0d-…", "Conta duplicada.");
```

`data` enviado à server function (`desativarUsuarioFn({ data })`):

```json
{
  "usuarioId": "3bbdfd0d-…",
  "justificativa": "Conta duplicada."
}
```

Resultado devolvido pela chamada:

```json
null
```
