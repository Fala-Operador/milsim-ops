# `obterEvento`

[← Índice de APIs](../README.md) · Módulo: [Sessão e leitura](../README.md#sessao)

| | |
|---|---|
| Server function | `obterEventoFn` em [`src/api/sessao.functions.ts`](../../../src/api/sessao.functions.ts) |
| Uso no navegador | `obterEventoFn({ data })` (sem wrapper) |
| Método | `GET` |
| Acesso | Pública |

Carrega um evento e a organização dele para os carregadores de rota (`/eventos/$eventoId`, `/inscricao/$eventoId`, `/comunidade/$eventoId`), inclusive no SSR (título e metatags reais).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string | Id do evento. |

## Regras

- Roda `consultar()`: a função recebe **só a visão** da pessoa, então rascunhos de outra organização e o link do grupo do WhatsApp (para quem não é inscrito confirmado) não vazam no HTML.
- `pagamentoOnline` indica se o Stripe está configurado (inscrições pagas passam pelo checkout).
- `taxaCompradorPercentual` é a taxa de serviço (%) da organização do evento, somada ao ingresso no checkout (0 = sem taxa).
- `vendasAbertas` diz se a organização tem conta de recebimento ativa; sem ela, ingressos pagos não são vendidos (gratuitos e cortesias seguem normais).

## Resposta

`{ evento, organizacao, pagamentoOnline, taxaCompradorPercentual, vendasAbertas }`; `evento` é `null` quando não existe ou não é visível.

## Exemplo

```ts
import { obterEventoFn } from "@/api/sessao.functions";

// em um loader de rota
const { evento, organizacao, pagamentoOnline } = await obterEventoFn({ data: { eventoId: params.eventoId } });
if (!evento) throw notFound();
```

`data` enviado à server function (`obterEventoFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios"
}
```

Resultado devolvido pela chamada:

```json
{
  "evento": {
    "id": "evt-mv76xwom-mgios",
    "nome": "Tempestade do deserto 2",
    "status": "publicado",
    "cidade": "João Pessoa",
    "uf": "PB",
    "whatsappContato": "5583999990000"
  },
  "organizacao": {
    "id": "org-mv76sa2r-8frtq",
    "nome": "Fala Operador Podcast"
  },
  "pagamentoOnline": true,
  "taxaCompradorPercentual": 0,
  "vendasAbertas": true
}
```
