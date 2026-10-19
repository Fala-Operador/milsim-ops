# `enviarEntregaMissao`

[← Índice de APIs](../README.md) · Módulo: [Conta](../README.md#conta)

| | |
|---|---|
| Server function | `enviarEntregaMissaoFn` em [`src/api/conta.functions.ts`](../../../src/api/conta.functions.ts) |
| Uso no navegador | `enviarEntregaMissao(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Envia a entrega de uma missão do evento (texto livre).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `missaoId` | string |  |
| `texto?` | string (até 4000) | Conteúdo da entrega. |

## Regras

- Só destinatários da missão (inscritos no evento/exército alvo) podem entregar.
- A entrega precisa estar dentro do prazo da missão.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Missão não encontrada.
- Esta missão não é destinada a você.
- O prazo desta missão terminou.
- Escreva a sua entrega.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { enviarEntregaMissao } from "@/api/conta.functions";

await enviarEntregaMissao("mis-abc123", "Ponto Alfa capturado às 14h.");
```

`data` enviado à server function (`enviarEntregaMissaoFn({ data })`):

```json
{
  "missaoId": "mis-abc123",
  "texto": "Ponto Alfa capturado às 14h."
}
```

Resultado devolvido pela chamada:

```json
null
```
