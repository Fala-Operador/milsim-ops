# `criarForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `criarForumFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `criarForum(…)` |
| Método | `POST` |
| Acesso | Gestão do evento: organização dona ou admin |

Cria um fórum no evento.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |
| `dados.nome` | string (até 80) |  |
| `dados.descricao` | string (até 500) |  |
| `dados.icone?` | string (emoji) |  |
| `dados.regras?` | string (até 4000) |  |
| `dados.publico` | "todos" \| id do exército | Quem vê o fórum. |
| `dados.publicacao / dados.respostas` | "membros" \| "gestao" | Quem pode publicar / responder. |

## Regras

- O público "exército" nunca é exibido a participantes de outro exército.

## Resposta

O `Forum` criado.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Apenas a organização do evento e a administração podem fazer isso.
- Informe o nome do fórum.
- Informe uma descrição.
- Público inválido.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { criarForum } from "@/api/comunidade.functions";

await criarForum("evt-mv76xwom-mgios", {
  nome: "Logística", descricao: "Caronas, hospedagem e alimentação.", icone: "🚚",
  publico: "todos", publicacao: "membros", respostas: "membros",
});
```

`data` enviado à server function (`criarForumFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios",
  "dados": {
    "nome": "Logística",
    "descricao": "Caronas, hospedagem e alimentação.",
    "icone": "🚚",
    "publico": "todos",
    "publicacao": "membros",
    "respostas": "membros"
  }
}
```

Resultado devolvido pela chamada:

```json
{
  "id": "for-logistica-mv76",
  "status": "ativo"
}
```
