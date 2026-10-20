# `salvarMissao`

[← Índice de APIs](../README.md) · Módulo: [Missões pré-evento](../README.md#missoes)

| | |
|---|---|
| Server function | `salvarMissaoFn` em [`src/api/missoes.functions.ts`](../../../src/api/missoes.functions.ts) |
| Uso no navegador | `salvarMissao(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin |

Cria ou edita uma missão pré-evento. Missão nova nasce em **rascunho** (não aparece para os inscritos até ser publicada).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id?` | string | Ausente = nova. |
| `eventoId` | string |  |
| `titulo` | string (3–120) |  |
| `descricao` | string (até 2000) | Briefing. |
| `imagem?` | data URL \| URL | JPG, PNG ou WebP. |
| `publico` | "todos" \| id do exército |  |
| `tipoEntrega` | "confirmacao" \| "texto" \| "imagem" \| "codigo" | Texto também serve para link (vídeo, post). |
| `pontos` | inteiro (0–10000) | Pontos da entrega aprovada para o exército. |
| `abreEm?` | ISO 8601 | Antes disso a missão aparece como agendada. |
| `prazo` | ISO 8601 | Até o fim do evento. |
| `exigeAprovacao` | boolean | Ignorado para código secreto (aprova na hora). |
| `codigoResposta?` | string (até 80) | Obrigatório para "codigo"; normalizado (sem acentos/maiúsculas). Ao editar, vazio mantém o atual. |
| `metaPercentual?, metaBonus?` | inteiros | Meta coletiva: com X% dos inscritos do exército concluindo, o exército ganha o bônus. |

## Regras

- O tipo de entrega não muda depois que há entregas.
- A resposta do código secreto nunca vai para os participantes (a visão remove).
- Com a campanha encerrada, nada mais muda.

## Resposta

O id da missão.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Título: de 3 a 120 caracteres.
- Escreva o briefing da missão (até 2000 caracteres).
- Escolha todos ou um exército do evento.
- Pontos: inteiro de 0 a 10000.
- Informe o prazo da missão.
- A abertura precisa ser antes do prazo.
- O prazo não pode passar do fim do evento.
- Imagem inválida: JPG, PNG ou WebP até ~2 MB.
- Meta coletiva: percentual de 1 a 100 e bônus de 1 a 10000.
- Missão não encontrada.
- Não dá para trocar o tipo de entrega depois que já há entregas.
- Defina o código secreto (ao menos 3 caracteres).
- Só a organização do evento pode gerenciar as missões.
- A campanha de missões deste evento já foi encerrada.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { salvarMissao } from "@/api/missoes.functions";

const id = await salvarMissao({
  eventoId: "evt-mv76xwom-mgios", titulo: "Foto do squad com o patch", descricao: "Mande a foto do seu squad com o patch do exército.",
  publico: "todos", tipoEntrega: "imagem", pontos: 10, prazo: "2027-05-20T23:59:00.000Z", exigeAprovacao: true,
  metaPercentual: 70, metaBonus: 5,
});
```

`data` enviado à server function (`salvarMissaoFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios",
  "titulo": "Foto do squad com o patch",
  "descricao": "Mande a foto do seu squad com o patch do exército.",
  "publico": "todos",
  "tipoEntrega": "imagem",
  "pontos": 10,
  "prazo": "2027-05-20T23:59:00.000Z",
  "exigeAprovacao": true,
  "metaPercentual": 70,
  "metaBonus": 5
}
```

Resultado devolvido pela chamada:

```json
"mis-mv9q1z-k3a8"
```
