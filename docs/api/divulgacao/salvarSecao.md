# `salvarSecao`

[← Índice de APIs](../README.md) · Módulo: [Página inicial](../README.md#divulgacao)

| | |
|---|---|
| Server function | `salvarSecaoFn` em [`src/api/divulgacao.functions.ts`](../../../src/api/divulgacao.functions.ts) |
| Uso no navegador | `salvarSecao(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Cria ou edita uma seção da página inicial: destaques, regional, patrocinadores, apoiadores ou banner.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id?` | string | Ausente = nova. |
| `titulo, subtitulo?` | string |  |
| `tipo` | "destaques" \| "regional" \| "patrocinadores" \| "apoiadores" \| "banner" |  |
| `abrangencia` | { escopo, regiao?, uf?, cidade? } | Onde a seção aparece. |
| `agendamento` | { inicioEm?, fimEm? } |  |
| `layout` | "grade" \| "carrossel" \| "banner" |  |
| `modo` | "manual" \| "automatico" | Curadoria ou seleção automática. |
| `destaques / automatica / parceiros / banner` | objetos | Conforme o tipo (ver `SecaoInicial` em `types.ts`). |
| `status` | "rascunho" \| "publicada" \| "desativada" |  |

## Regras

- Só eventos publicados e não encerrados aparecem.
- Campanhas de impulsionamento entram antes da curadoria; cada evento aparece uma vez por seção.
- Links externos só http/https; imagens precisam de texto alternativo.
- Auditado.

## Resposta

A `SecaoInicial` salva.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe o título da seção.
- O término deve ser depois do início.
- Informe o texto alternativo da imagem.
- Link externo inválido: use um endereço http ou https.
- Quantidade máxima deve ser pelo menos 1.
- Somente administradores gerenciam a página inicial.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { salvarSecao } from "@/api/divulgacao.functions";

await salvarSecao({
  titulo: "Operações no Nordeste", tipo: "regional", status: "publicada", layout: "carrossel", modo: "automatico",
  abrangencia: { escopo: "regiao", regiao: "Nordeste" }, agendamento: {},
  automatica: { abrangencia: { escopo: "regiao", regiao: "Nordeste" }, maximo: 8, incluirEsgotados: false, ordenacao: "data" },
  destaques: [], parceiros: [], mostrarEsgotados: false, tamanhoLogo: "m", mostrarDescricoes: false, superficieLogo: "nenhuma",
});
```

`data` enviado à server function (`salvarSecaoFn({ data })`):

```json
{
  "titulo": "Operações no Nordeste",
  "tipo": "regional",
  "status": "publicada",
  "modo": "automatico",
  "…": "demais campos"
}
```

Resultado devolvido pela chamada:

```json
{
  "id": "sec-nordeste",
  "ordem": 8,
  "status": "publicada"
}
```
