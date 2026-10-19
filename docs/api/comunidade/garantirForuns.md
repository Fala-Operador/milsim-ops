# `garantirForuns`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `garantirForunsFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `garantirForuns(…)` |
| Método | `POST` |
| Acesso | Quem tem papel no evento (membro ou gestão) |

Garante que o evento tenha os 5 fóruns iniciais, abertos a todos os inscritos: Avisos oficiais (só a gestão publica), Conversa geral, Dúvidas e preparação, Caronas e logística, Fotos e experiências. Chamada ao abrir a comunidade.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |

## Regras

- Idempotente: só cria o que falta.
- A publicação do evento já cria os fóruns.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Conteúdo indisponível ou você não tem acesso a ele.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { garantirForuns } from "@/api/comunidade.functions";

await garantirForuns("evt-mv76xwom-mgios");
```

`data` enviado à server function (`garantirForunsFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios"
}
```

Resultado devolvido pela chamada:

```json
null
```
