# `assumirChamado`

[← Índice de APIs](../README.md) · Módulo: [Central de Suporte](../README.md#suporte)

| | |
|---|---|
| Server function | `definirResponsavelFn` em [`src/api/suporte.functions.ts`](../../../src/api/suporte.functions.ts) |
| Uso no navegador | `assumirChamado(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Define o responsável pelo chamado: o próprio admin (assumir) ou outro admin (atribuir). Sem `responsavelId`, assume para si.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `chamadoId` | string |  |
| `responsavelId?` | string | Outro admin. |

## Regras

- O responsável é derivado do histórico (mensagens "sistema" imutáveis), sem coluna própria.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você não atende este chamado.
- Chamado fechado: somente leitura.
- Somente a administração atribui chamados a outras pessoas.
- Essa pessoa não pode atender este chamado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { assumirChamado } from "@/api/suporte.functions";

await assumirChamado("cha-5d1f…");
```

`data` enviado à server function (`definirResponsavelFn({ data })`):

```json
{
  "chamadoId": "cha-5d1f…"
}
```

Resultado devolvido pela chamada:

```json
null
```
