# `solicitarOrganizador`

[← Índice de APIs](../README.md) · Módulo: [Organizador](../README.md#organizador)

| | |
|---|---|
| Server function | `solicitarOrganizadorFn` em [`src/api/organizador.functions.ts`](../../../src/api/organizador.functions.ts) |
| Uso no navegador | `solicitarOrganizador(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Pede para virar organizador, informando os dados da organização. A análise é feita pelo admin ([`analisarSolicitacao`](../admin/analisarSolicitacao.md)).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `possuiCnpj` | boolean |  |
| `cnpj?` | string (até 20) | Obrigatório e válido quando `possuiCnpj`. |
| `nomeOrganizacao` | string (até 200) |  |
| `instagram?` | string (até 100) |  |
| `telefone` | string (até 20) | Telefone com DDD. |

## Regras

- Uma solicitação em andamento (`pendente` ou `em_analise`) por pessoa.
- Os admins ativos são notificados (salvo quem silenciou).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- CNPJ inválido.
- Telefone inválido.
- Informe o nome da organização.
- Você já possui uma solicitação em andamento.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { solicitarOrganizador } from "@/api/organizador.functions";

await solicitarOrganizador({ possuiCnpj: false, nomeOrganizacao: "Fala Operador Podcast", instagram: "@falaoperador", telefone: "(83) 99999-0000" });
```

`data` enviado à server function (`solicitarOrganizadorFn({ data })`):

```json
{
  "possuiCnpj": false,
  "nomeOrganizacao": "Fala Operador Podcast",
  "instagram": "@falaoperador",
  "telefone": "(83) 99999-0000"
}
```

Resultado devolvido pela chamada:

```json
null
```
