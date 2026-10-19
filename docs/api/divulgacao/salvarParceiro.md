# `salvarParceiro`

[← Índice de APIs](../README.md) · Módulo: [Página inicial](../README.md#divulgacao)

| | |
|---|---|
| Server function | `salvarParceiroFn` em [`src/api/divulgacao.functions.ts`](../../../src/api/divulgacao.functions.ts) |
| Uso no navegador | `salvarParceiro(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Cria ou edita um parceiro (patrocinador e/ou apoiador) com logo e links (site, Instagram, WhatsApp, externo).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id?` | string |  |
| `nome` | string |  |
| `tipo` | "patrocinador" \| "apoiador" \| "ambos" |  |
| `descricao?` | string |  |
| `logoUrl?` | string (URL ou data URL) |  |
| `textoAlt` | string | Obrigatório com logo. |
| `links` | LinkParceiro[] | Instagram é normalizado; WhatsApp exige telefone com DDI. |
| `ativo` | boolean |  |

## Regras

- Links inválidos são recusados com a mensagem do link.

## Resposta

O `Parceiro` salvo.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe o nome do parceiro.
- Informe o texto alternativo do logo.
- [link]: [motivo]
- Somente administradores gerenciam a página inicial.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { salvarParceiro } from "@/api/divulgacao.functions";

await salvarParceiro({
  nome: "Loja Tática NE", tipo: "patrocinador", textoAlt: "Logo da Loja Tática NE", ativo: true,
  links: [{ id: "lk-1", tipo: "instagram", url: "@lojataticane", principal: true }, { id: "lk-2", tipo: "whatsapp", telefone: "+55 83 99999-0000" }],
});
```

`data` enviado à server function (`salvarParceiroFn({ data })`):

```json
{
  "nome": "Loja Tática NE",
  "tipo": "patrocinador",
  "textoAlt": "Logo da Loja Tática NE",
  "ativo": true,
  "links": [
    {
      "id": "lk-1",
      "tipo": "instagram",
      "url": "@lojataticane",
      "principal": true
    }
  ]
}
```

Resultado devolvido pela chamada:

```json
{
  "id": "par-9",
  "nome": "Loja Tática NE",
  "links": [
    {
      "tipo": "instagram",
      "url": "https://www.instagram.com/lojataticane/"
    }
  ]
}
```
