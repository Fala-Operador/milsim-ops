# `validarTokenRecuperacao`

[← Índice de APIs](../README.md) · Módulo: [Sessão e leitura](../README.md#sessao)

| | |
|---|---|
| Server function | `validarTokenRecuperacaoFn` em [`src/api/sessao.functions.ts`](../../../src/api/sessao.functions.ts) |
| Uso no navegador | `validarTokenRecuperacao(…)` |
| Método | `POST` |
| Acesso | Pública (quem tem o link do e-mail) |

Valida o link do e-mail de recuperação (`?token_hash=…&type=recovery`) e abre a sessão de recuperação (`verifyOtp`). Usada pela página `/recuperar-senha` antes de mostrar o formulário de nova senha.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `tokenHash` | string (até 500) | Valor do parâmetro `token_hash` da URL. |

## Regras

- Funciona em qualquer aparelho: não depende de cookie criado no navegador que pediu a troca (diferente do `code`/PKCE).
- O link é de uso único e vale por 1 hora; a página valida uma vez só, mesmo que remonte.

## Resposta

`void`; a sessão de recuperação fica nos cookies (não usa `chamar`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Link de recuperação inválido ou expirado. Solicite um novo.

## Exemplo

```ts
import { validarTokenRecuperacao, definirNovaSenha } from "@/api/sessao.functions";

const p = new URLSearchParams(location.search);
const tokenHash = p.get("token_hash");
if (tokenHash && p.get("type") === "recovery") {
  await validarTokenRecuperacao(tokenHash); // depois: formulário de nova senha
  await definirNovaSenha("nova-senha-forte");
}
```

`data` enviado à server function (`validarTokenRecuperacaoFn({ data })`):

```json
{
  "tokenHash": "3f0c2a9e5b1d…"
}
```

Resultado devolvido pela chamada:

```json
null
```
