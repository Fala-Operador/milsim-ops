# `salvarImpulsionamento`

[← Índice de APIs](../README.md) · Módulo: [Impulsionamento](../README.md#impulsionamentos)

| | |
|---|---|
| Server function | `salvarImpulsionamentoFn` em [`src/api/impulsionamentos.functions.ts`](../../../src/api/impulsionamentos.functions.ts) |
| Uso no navegador | `salvarImpulsionamento(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Cria ou edita uma campanha de impulsionamento: o evento ganha prioridade nas seções escolhidas da página inicial, num período e numa região.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id?` | string |  |
| `eventoId` | string |  |
| `nome` | string (até 120) | Nome interno. |
| `objetivo` | "divulgacao" \| "inscricoes" | Com `inscricoes`, a campanha pausa sozinha quando o evento esgota. |
| `posicoes` | string[] (até 30) | Seções da página inicial. |
| `abrangencia` | { escopo, regiao?, uf?, cidade? } |  |
| `inicioEm, fimEm` | ISO 8601 |  |
| `fuso` | string |  |
| `prioridade` | "normal" \| "alta" |  |
| `ordem` | 0–999 | Desempate administrativo. |
| `imagemPromocional?` | https URL |  |
| `chamada?` | string (até 120) |  |
| `ativar` | boolean | `false` salva como rascunho. |

## Regras

- O estado exibido é calculado (rascunho, agendado, ativo, pausado, pausado por esgotar, suspenso, encerrado); não há agendador.
- Campanhas nunca são apagadas; encerrada não pode ser editada.
- Para ativar, o evento precisa estar publicado e não encerrado (as pendências vêm numa mensagem).

## Resposta

O `Impulsionamento` salvo.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Campanha encerrada não pode ser editada.
- Somente a administração gerencia impulsionamentos.
- Informe o nome interno da campanha.
- A chamada tem no máximo 120 caracteres.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { salvarImpulsionamento } from "@/api/impulsionamentos.functions";

await salvarImpulsionamento({
  eventoId: "evt-mv76xwom-mgios", nome: "Lançamento Tempestade 2", objetivo: "inscricoes",
  posicoes: ["sec-destaques"], abrangencia: { escopo: "regiao", regiao: "Nordeste" },
  inicioEm: "2026-10-20T00:00:00.000Z", fimEm: "2026-11-20T23:59:00.000Z", fuso: "America/Fortaleza",
  prioridade: "alta", ordem: 1, chamada: "Vagas limitadas!", ativar: true,
});
```

`data` enviado à server function (`salvarImpulsionamentoFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios",
  "nome": "Lançamento Tempestade 2",
  "objetivo": "inscricoes",
  "posicoes": [
    "sec-destaques"
  ],
  "prioridade": "alta",
  "ativar": true,
  "…": "demais campos"
}
```

Resultado devolvido pela chamada:

```json
{
  "id": "imp-2b",
  "status": "ativo"
}
```
