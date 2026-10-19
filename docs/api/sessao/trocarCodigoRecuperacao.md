# `trocarCodigoRecuperacao`

[← Índice de APIs](../README.md) · Módulo: [Sessão e leitura](../README.md#sessao)

| | |
|---|---|
| Server function | `trocarCodigoFn` em [`src/api/sessao.functions.ts`](../../../src/api/sessao.functions.ts) |
| Uso no navegador | `trocarCodigoRecuperacao(…)` |
| Método | `POST` |
| Acesso | Pública |

Troca o `code` do link de recuperação por uma sessão (PKCE, `exchangeCodeForSession`). Mantida para links do template padrão do Supabase; o template atual usa [`validarTokenRecuperacao`](validarTokenRecuperacao.md), que funciona em qualquer aparelho.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `codigo` | string (até 500) | Valor do parâmetro `code` da URL. |

## Regras

- O código é de uso único e expira.
- PKCE: só funciona no mesmo navegador em que a recuperação foi pedida.

## Resposta

`void`; a sessão de recuperação fica nos cookies.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Link de recuperação inválido ou expirado. Solicite um novo.

## Exemplo

```ts
import { trocarCodigoRecuperacao } from "@/api/sessao.functions";

const codigo = new URLSearchParams(location.search).get("code");
if (codigo) await trocarCodigoRecuperacao(codigo);
```

`data` enviado à server function (`trocarCodigoFn({ data })`):

```json
{
  "codigo": "3f0c2a9e-…"
}
```

Resultado devolvido pela chamada:

```json
null
```
