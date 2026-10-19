# `recuperarSenha`

[← Índice de APIs](../README.md) · Módulo: [Sessão e leitura](../README.md#sessao)

| | |
|---|---|
| Server function | `recuperarSenhaFn` em [`src/api/sessao.functions.ts`](../../../src/api/sessao.functions.ts) |
| Uso no navegador | `recuperarSenha(…)` |
| Método | `POST` |
| Acesso | Pública |

Envia o e-mail de recuperação de senha (`resetPasswordForEmail`) com retorno para `/recuperar-senha`.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `email` | string (até 200) |  |

## Regras

- A resposta é a mesma exista ou não a conta (não revela e-mails cadastrados).
- Depende do SMTP do Supabase Auth e das URLs de retorno configuradas (ver README).

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
