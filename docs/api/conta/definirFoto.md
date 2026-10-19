# `definirFoto`

[← Índice de APIs](../README.md) · Módulo: [Conta](../README.md#conta)

| | |
|---|---|
| Server function | `definirFotoFn` em [`src/api/conta.functions.ts`](../../../src/api/conta.functions.ts) |
| Uso no navegador | `definirFoto(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Troca ou remove a foto de perfil. A imagem chega já recortada pelo editor (`EditorFoto`) como data URL e vai para o bucket `midia`.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `foto` | string (data URL) \| null | `null` remove a foto. |

## Regras

- Aceita JPEG, PNG ou WebP dentro do tamanho máximo (`TAMANHO_MAXIMO_FOTO`).

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- A foto é grande demais. Tente uma imagem menor.
- Formato de foto inválido. Use JPG, PNG ou WebP.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { definirFoto } from "@/api/conta.functions";

await definirFoto("data:image/jpeg;base64,/9j/4AAQ…");
await definirFoto(null); // remove
```

`data` enviado à server function (`definirFotoFn({ data })`):

```json
{
  "foto": "data:image/jpeg;base64,/9j/4AAQ…"
}
```

Resultado devolvido pela chamada:

```json
null
```
