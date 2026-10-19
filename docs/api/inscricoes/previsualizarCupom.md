# `previsualizarCupom`

[← Índice de APIs](../README.md) · Módulo: [Inscrições e pagamento](../README.md#inscricoes)

| | |
|---|---|
| Server function | `previsualizarCupomFn` em [`src/api/inscricoes.functions.ts`](../../../src/api/inscricoes.functions.ts) |
| Uso no navegador | `previsualizarCupom(…)` |
| Método | `POST` |
| Acesso | Pública |

Valida um cupom para mostrar o desconto na tela de inscrição. Os cupons nunca vão para o navegador; esta é a única forma de consultá-los.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |
| `codigo` | string (até 40) |  |
| `tipoId` | string | Tipo de ingresso escolhido. |

## Regras

- Mesma validação da inscrição: ativo, dentro da validade, com usos disponíveis e válido para o tipo.
- Não consome uso.

## Resposta

`{ codigo, descontoPercentual }`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Cupom não encontrado para esta operação.
- Este cupom está inativo.
- Este cupom atingiu o limite de utilizações.
- Este cupom ainda não está valendo.
- Este cupom expirou.
- Este cupom não vale para o tipo de ingresso escolhido.

## Exemplo

```ts
import { previsualizarCupom } from "@/api/inscricoes.functions";

const { descontoPercentual } = await previsualizarCupom("evt-mv76xwom-mgios", "operador15", "tp-tatico");
```

`data` enviado à server function (`previsualizarCupomFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios",
  "codigo": "operador15",
  "tipoId": "tp-tatico"
}
```

Resultado devolvido pela chamada:

```json
{
  "codigo": "OPERADOR15",
  "descontoPercentual": 15
}
```
