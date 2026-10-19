# `enviarNota`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `enviarNotaFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `enviarNota(…)` |
| Método | `POST` |
| Acesso | Dono do equipamento |

Anexa (ou substitui) a nota fiscal de um equipamento. O arquivo vai para o bucket **privado** `documentos`; só o dono acessa.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `equipamentoId` | string |  |
| `nome` | string (até 160) | Nome do arquivo (sanitizado). |
| `dataUrl` | string (até ~5 MB) | PDF, JPEG, PNG ou WebP. |

## Regras

- O tipo real do arquivo é conferido pelos primeiros bytes (assinatura), não só pela extensão.
- A nota nunca entra na visão nem no perfil público; não torna o equipamento "verificado".
- A nota anterior é apagada do Storage ao substituir.

## Resposta

`void` (metadados da nota gravados no equipamento).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Formato não aceito. Envie PDF, JPEG, PNG ou WebP.
- Arquivo acima de 5 MB.
- O conteúdo do arquivo não corresponde ao formato informado.
- Equipamento não encontrado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { enviarNota } from "@/api/perfil.functions";

const r = new FileReader();
r.onload = () => enviarNota("eqp-7h2k", arquivo.name, String(r.result));
r.readAsDataURL(arquivo);
```

`data` enviado à server function (`enviarNotaFn({ data })`):

```json
{
  "equipamentoId": "eqp-7h2k",
  "nome": "nota-m4.pdf",
  "dataUrl": "data:application/pdf;base64,JVBERi0x…"
}
```

Resultado devolvido pela chamada:

```json
null
```
