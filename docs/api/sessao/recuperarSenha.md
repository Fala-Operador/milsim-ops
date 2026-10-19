# `recuperarSenha`

[← Índice de APIs](../README.md) · Módulo: [Sessão e leitura](../README.md#sessao)

| | |
|---|---|
| Server function | `recuperarSenhaFn` em [`src/api/sessao.functions.ts`](../../../src/api/sessao.functions.ts) |
| Uso no navegador | `recuperarSenha(…)` |
| Método | `POST` |
| Acesso | Pública |

Envia o e-mail de recuperação de senha (`resetPasswordForEmail`) com o template em português `supabase/templates/recuperar-senha.html`. O link leva a `/recuperar-senha?token_hash=…&type=recovery` e vale por 1 hora.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `email` | string (até 200) |  |

## Regras

- A resposta é a mesma exista ou não a conta (não revela e-mails cadastrados).
- O endereço de volta é o do próprio site que recebeu o pedido; ele precisa estar em `additional_redirect_urls` do Supabase Auth.
- Depende do SMTP do Supabase Auth: o embutido só entrega para membros da organização no Supabase, 2 por hora.

## Resposta

`void` (não usa `chamar`: não muda a visão).

## Exemplo

```ts
import { recuperarSenha } from "@/api/sessao.functions";

await recuperarSenha("ana@exemplo.com");
```

`data` enviado à server function (`recuperarSenhaFn({ data })`):

```json
{
  "email": "ana@exemplo.com"
}
```

Resultado devolvido pela chamada:

```json
null
```
