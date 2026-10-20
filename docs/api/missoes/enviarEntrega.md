# `enviarEntrega`

[← Índice de APIs](../README.md) · Módulo: [Missões pré-evento](../README.md#missoes)

| | |
|---|---|
| Server function | `enviarEntregaFn` em [`src/api/missoes.functions.ts`](../../../src/api/missoes.functions.ts) |
| Uso no navegador | `enviarEntrega(…)` |
| Método | `POST` |
| Acesso | Inscrito confirmado no evento, no exército de destino da missão |

Envia a entrega da missão: confirmação, texto/link, foto ou código secreto. O exército da pessoa no momento do envio fica gravado: os pontos são dele.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `missaoId` | string |  |
| `texto?` | string (até 2000) | Texto/link; legenda da foto. |
| `foto?` | data URL | Obrigatória em missões de foto. |
| `codigo?` | string | Missão de código secreto. |
| `permiteDestaque?` | boolean | Autoriza a organização a destacar a entrega na comunidade. |

## Regras

- Uma entrega por pessoa por missão: em análise, concluída ou recusada não reenvia; com ajustes pedidos, reenvia.
- Só dentro da janela (depois de abrir, antes do prazo) e com a campanha aberta.
- Código certo aprova na hora com os pontos; errado não registra nada.
- Sem aprovação, a entrega conclui na hora.

## Resposta

O status resultante (`concluida` ou `enviada`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Missão não encontrada.
- Esta missão não é destinada a você.
- Escreva a sua entrega.
- Entrega: no máximo 2000 caracteres.
- Envie a foto da missão (JPG, PNG ou WebP).
- Digite o código.
- Código incorreto. Confira a pista e tente de novo.
- A campanha de missões deste evento foi encerrada.
- Esta missão ainda não abriu.
- O prazo desta missão terminou.
- Você já concluiu esta missão.
- Sua entrega está em análise.
- Sua entrega foi recusada pela organização.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { enviarEntrega } from "@/api/missoes.functions";

await enviarEntrega({ missaoId: "mis-cod-1", codigo: "tempestade arabe" });
await enviarEntrega({ missaoId: "mis-foto-1", foto: dataUrl, texto: "Squad Falcão", permiteDestaque: true });
```

`data` enviado à server function (`enviarEntregaFn({ data })`):

```json
{
  "missaoId": "mis-foto-1",
  "foto": "data:image/jpeg;base64,/9j/4AAQ…",
  "texto": "Squad Falcão",
  "permiteDestaque": true
}
```

Resultado devolvido pela chamada:

```json
"enviada"
```
