# `salvarCampanha`

[← Índice de APIs](../README.md) · Módulo: [Gamificação](../README.md#gamificacao)

| | |
|---|---|
| Server function | `salvarCampanhaFn` em [`src/api/gamificacao.functions.ts`](../../../src/api/gamificacao.functions.ts) |
| Uso no navegador | `salvarCampanha(…)` |
| Método | `POST` |
| Acesso | Organização responsável pelos eventos ou admin (com referência da oferta autorizada) |

Cria ou edita uma campanha de recompensa: quem conquistar a insígnia ganha um benefício (desconto percentual, valor fixo ou gratuidade) em eventos da organização.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id?` | string |  |
| `nome, descricao, regras` | string |  |
| `insigniaId` | string | Conquista necessária. |
| `organizacaoId` | string | Quem concede o benefício. |
| `tipo` | "percentual" \| "fixo" \| "gratuito" |  |
| `valor` | inteiro | Percentual (1–100) ou centavos. |
| `eventosElegiveis, tiposElegiveis` | string[] | Eventos da organização e tipos válidos. |
| `maximo, limitePorParticipante` | inteiro ≥ 1 |  |
| `inicioEm < conquistarAte < resgatarAte` | ISO 8601 |  |
| `aceitaAnteriores` | boolean | Conta conquistas anteriores ao início. |
| `ativa` | boolean |  |
| `autorizacao?` | string | Obrigatória quando o admin cria em nome da organização. |

## Regras

- Os vouchers são emitidos automaticamente (idempotente) e usados na inscrição; não combinam com cupom.
- Benefício usado volta ao participante se a inscrição for cancelada dentro do prazo.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode oferecer benefícios nos eventos da sua organização.
- Informe a referência da oferta autorizada pela organização responsável.
- Informe o nome da campanha.
- Escolha a conquista necessária.
- Escolha ao menos um evento elegível.
- Os eventos elegíveis precisam ser da organização responsável.
- Tipo de ingresso inválido para os eventos escolhidos.
- O percentual deve estar entre 1 e 100.
- Informe o valor do desconto.
- Quantidade e limite precisam ser maiores que zero.
- Datas inválidas.
- O prazo de resgate precisa ser depois do prazo para conquistar, que vem depois do início.
- Campanha não encontrada.
- Sem permissão para esta campanha.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { salvarCampanha } from "@/api/gamificacao.functions";

await salvarCampanha({
  nome: "Veteranos 10% off", descricao: "Desconto para quem tem a insígnia Veterano.", insigniaId: "ins-veterano",
  organizacaoId: "org-mv76sa2r-8frtq", tipo: "percentual", valor: 10, eventosElegiveis: ["evt-mv76xwom-mgios"], tiposElegiveis: [],
  maximo: 50, limitePorParticipante: 1, inicioEm: "2026-10-20T00:00:00.000Z", conquistarAte: "2027-04-30T23:59:00.000Z",
  resgatarAte: "2027-05-20T23:59:00.000Z", regras: "Um uso por pessoa.", aceitaAnteriores: true, ativa: true,
});
```

`data` enviado à server function (`salvarCampanhaFn({ data })`):

```json
{
  "nome": "Veteranos 10% off",
  "insigniaId": "ins-veterano",
  "organizacaoId": "org-mv76sa2r-8frtq",
  "tipo": "percentual",
  "valor": 10,
  "…": "demais campos"
}
```

Resultado devolvido pela chamada:

```json
null
```
