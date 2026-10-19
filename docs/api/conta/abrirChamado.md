# `abrirChamado` (legada)

[← Índice de APIs](../README.md) · Módulo: [Conta](../README.md#conta)

| | |
|---|---|
| Server function | `abrirChamadoFn` em [`src/api/conta.functions.ts`](../../../src/api/conta.functions.ts) |
| Uso no navegador | `abrirChamado(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

**Legada.** Abria chamado no modelo antigo de suporte. Nenhuma tela usa; a Central de Suporte usa [`abrirChamadoSuporte`](../suporte/abrirChamadoSuporte.md). Candidata a remoção.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `assunto` | string (até 200) |  |
| `categoria` | string (até 60) |  |
| `descricao` | string (até 4000) |  |
| `eventoId?` | string |  |

## Resposta

O `Chamado` criado.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe assunto e descrição.
- Evento não encontrado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { abrirChamado } from "@/api/conta.functions";

// Prefira abrirChamadoSuporte (Central de Suporte).
await abrirChamado({ assunto: "Dúvida", categoria: "Inscrição", descricao: "…" });
```

`data` enviado à server function (`abrirChamadoFn({ data })`):

```json
{
  "assunto": "Dúvida",
  "categoria": "Inscrição",
  "descricao": "…"
}
```

Resultado devolvido pela chamada:

```json
{
  "id": "cha-…",
  "status": "aberto"
}
```
