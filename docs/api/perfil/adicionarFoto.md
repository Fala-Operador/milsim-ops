# `adicionarFoto`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `adicionarFotoFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `adicionarFoto(…)` |
| Método | `POST` |
| Acesso | Dono do perfil (a própria conta) |

Adiciona uma foto à galeria do perfil.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `dataUrl` | string | JPEG/PNG/WebP até 3 MB. |
| `legenda?` | string (até 300) |  |
| `alt?` | string (até 300) | Texto alternativo. |

## Regras

- Até 30 fotos na galeria.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Limite de 30 fotos na galeria.
- Texto acima de [limite] caracteres.
- Imagem grande demais. Use uma menor.
- Formato inválido. Use JPG, PNG ou WebP.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { adicionarFoto } from "@/api/perfil.functions";

await adicionarFoto({ dataUrl: "data:image/webp;base64,UklGR…", legenda: "Operação Serra Verde", alt: "Equipe reunida no campo" });
```

`data` enviado à server function (`adicionarFotoFn({ data })`):

```json
{
  "dataUrl": "data:image/webp;base64,UklGR…",
  "legenda": "Operação Serra Verde",
  "alt": "Equipe reunida no campo"
}
```

Resultado devolvido pela chamada:

```json
null
```
