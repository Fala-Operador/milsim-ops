# `salvarPerfil`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `salvarPerfilFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `salvarPerfil(…)` |
| Método | `POST` |
| Acesso | Dono do perfil (a própria conta) |

Atualiza o perfil social: callsign, bio, squad, Instagram, capa e insígnia em destaque.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `callsign?` | string (até 60) |  |
| `bio?` | string (até 400) |  |
| `squad?` | string (até 80) |  |
| `instagram?` | string (até 60) | Usuário ou URL; normalizado. |
| `capa?` | data URL \| null | `null` remove; JPEG/PNG/WebP até 3 MB. |
| `insigniaDestaque?` | string \| null | Só uma insígnia conquistada. |

## Regras

- Dados de conta (CPF, endereço, contatos) não são editados aqui e nunca aparecem no perfil.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Instagram inválido: use apenas letras, números, ponto e sublinhado.
- Só é possível destacar uma insígnia conquistada.
- Texto acima de [limite] caracteres.
- Imagem grande demais. Use uma menor.
- Formato inválido. Use JPG, PNG ou WebP.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { salvarPerfil } from "@/api/perfil.functions";

await salvarPerfil({ callsign: "Falcão", bio: "Operador de suporte.", instagram: "@falcao.airsoft" });
```

`data` enviado à server function (`salvarPerfilFn({ data })`):

```json
{
  "callsign": "Falcão",
  "bio": "Operador de suporte.",
  "instagram": "@falcao.airsoft"
}
```

Resultado devolvido pela chamada:

```json
null
```
