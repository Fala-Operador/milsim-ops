# `salvarEquipamento`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `salvarEquipamentoFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `salvarEquipamento(…)` |
| Método | `POST` |
| Acesso | Dono do perfil (a própria conta) |

Cria ou atualiza um equipamento do arsenal.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id?` | string | Ausente = novo. |
| `marca, modelo` | string | Obrigatórios. |
| `tipo` | "spring" \| "hpa" \| "aeg" \| "gbbr" |  |
| `apelido?` | string (até 100) |  |
| `observacoes?` | string (até 800) |  |
| `fotos` | string[] (até 4) | URLs já salvas ou data URLs novas. |
| `visivel` | boolean | Aparece no perfil (respeitando a privacidade do bloco). |

## Regras

- A nota fiscal não é enviada aqui: use [`enviarNota`](enviarNota.md).

## Resposta

O id do equipamento.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe marca, tipo e modelo.
- Tipo inválido.
- Até 4 fotos por equipamento.
- Equipamento não encontrado.
- Foto inválida.
- Texto acima de [limite] caracteres.
- Imagem grande demais. Use uma menor.
- Formato inválido. Use JPG, PNG ou WebP.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { salvarEquipamento } from "@/api/perfil.functions";

const id = await salvarEquipamento({ marca: "Tokyo Marui", tipo: "gbbr", modelo: "M4A1 MWS", fotos: [], visivel: true });
```

`data` enviado à server function (`salvarEquipamentoFn({ data })`):

```json
{
  "marca": "Tokyo Marui",
  "tipo": "gbbr",
  "modelo": "M4A1 MWS",
  "fotos": [],
  "visivel": true
}
```

Resultado devolvido pela chamada:

```json
"eqp-7h2k"
```
