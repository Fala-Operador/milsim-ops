# `denunciar`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `denunciarFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `denunciar(…)` |
| Método | `POST` |
| Acesso | Quem vê o conteúdo |

Denuncia uma publicação ou resposta para a gestão do evento.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `alvo` | "publicacao" \| "resposta" |  |
| `alvoId` | string |  |
| `motivo` | "ofensa" \| "spam" \| "dados_pessoais" \| "inadequado" \| "outro" |  |
| `descricao?` | string (até 1000) |  |

## Regras

- A gestão do evento é notificada e decide em [`analisarDenuncia`](analisarDenuncia.md).
- Quem denuncia não fica visível para o autor.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Conteúdo indisponível ou você não tem acesso a ele.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { denunciar } from "@/api/comunidade.functions";

await denunciar({ alvo: "publicacao", alvoId: "pub-q1w2", motivo: "dados_pessoais", descricao: "Expõe o telefone de outro jogador." });
```

`data` enviado à server function (`denunciarFn({ data })`):

```json
{
  "alvo": "publicacao",
  "alvoId": "pub-q1w2",
  "motivo": "dados_pessoais",
  "descricao": "Expõe o telefone de outro jogador."
}
```

Resultado devolvido pela chamada:

```json
null
```
