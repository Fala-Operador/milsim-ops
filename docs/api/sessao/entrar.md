# `entrar`

[← Índice de APIs](../README.md) · Módulo: [Sessão e leitura](../README.md#sessao)

| | |
|---|---|
| Server function | `entrarFn` em [`src/api/sessao.functions.ts`](../../../src/api/sessao.functions.ts) |
| Uso no navegador | `entrar(…)` |
| Método | `POST` |
| Acesso | Pública |

Login com e-mail e senha (Supabase Auth). A sessão fica em cookies HTTP.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `email` | string (até 200) | E-mail da conta. |
| `senha` | string (até 200) | Senha. |

## Regras

- Conta com perfil inativo é deslogada na hora.
- A resposta já traz a visão da pessoa logada (os cookies novos ainda não chegaram nesta requisição).

## Resposta

`null`; a visão da pessoa logada é aplicada ao navegador.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- E-mail ou senha incorretos.
- Conta inativa.

## Exemplo

```ts
import { entrar } from "@/api/sessao.functions";

try {
  await entrar("italo@exemplo.com", "minha-senha");
  navigate({ to: "/app" });
} catch (e) {
  setErro((e as Error).message); // "E-mail ou senha incorretos."
}
```

`data` enviado à server function (`entrarFn({ data })`):

```json
{
  "email": "italo@exemplo.com",
  "senha": "minha-senha"
}
```

Resultado devolvido pela chamada:

```json
null
```
