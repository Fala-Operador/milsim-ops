# `salvarFichaEmergencia`

[← Índice de APIs](../README.md) · Módulo: [Conta](../README.md#conta)

| | |
|---|---|
| Server function | `salvarFichaEmergenciaFn` em [`src/api/conta.functions.ts`](../../../src/api/conta.functions.ts) |
| Uso no navegador | `salvarFichaEmergencia(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa (sempre a própria ficha) |

Grava a ficha de emergência da própria conta: tipo sanguíneo, alergias e contato de emergência. Tudo é opcional; enviar tudo vazio e sem autorização remove a ficha.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `tipoSanguineo?` | string | `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-` ou vazio. |
| `alergias?` | string (até 500) |  |
| `contatoNome?` | string (até 120) | Exige `contatoTelefone`. |
| `contatoTelefone?` | string | Com DDD; aceita máscara. Exige `contatoNome`. |
| `compartilhar` | boolean | Autorização explícita para a gestão dos eventos ver a ficha. |

## Regras

- Dado de saúde (LGPD, art. 11). Regras em [`src/lib/fichaEmergencia.ts`](../../../src/lib/fichaEmergencia.ts).
- Autorizar grava a data do consentimento (mantida enquanto a autorização continua); retirar apaga a data.
- Quem recebe a ficha pela visão: o titular sempre; a organização dona do evento e o admin só com `compartilhar`, inscrição **confirmada** e de 7 dias antes do início até o fim do evento (também no check-in offline). Mais ninguém.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Tipo sanguíneo inválido.
- Descreva as alergias em até 500 caracteres.
- Nome do contato com até 120 caracteres.
- Telefone do contato de emergência inválido. Informe com DDD.
- Informe o telefone do contato de emergência.
- Informe o nome do contato de emergência.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { salvarFichaEmergencia } from "@/api/conta.functions";

await salvarFichaEmergencia({
  tipoSanguineo: "O-",
  alergias: "dipirona",
  contatoNome: "Maria (mãe)",
  contatoTelefone: "(11) 98888-7777",
  compartilhar: true,
});
```

`data` enviado à server function (`salvarFichaEmergenciaFn({ data })`):

```json
{
  "tipoSanguineo": "O-",
  "alergias": "dipirona",
  "contatoNome": "Maria (mãe)",
  "contatoTelefone": "(11) 98888-7777",
  "compartilhar": true
}
```

Resultado devolvido pela chamada:

```json
null
```
