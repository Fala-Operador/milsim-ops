# `salvarPrivacidade`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `salvarPrivacidadeFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `salvarPrivacidade(…)` |
| Método | `POST` |
| Acesso | Dono do perfil (a própria conta) |

Define quem vê cada bloco do perfil.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `historico, mapa, insignias, equipamentos, fotos` | "eu" \| "autenticados" | Um valor por bloco. |

## Regras

- `eu` = só o dono; `autenticados` = qualquer conta logada.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { salvarPrivacidade } from "@/api/perfil.functions";

await salvarPrivacidade({ historico: "autenticados", mapa: "autenticados", insignias: "autenticados", equipamentos: "eu", fotos: "autenticados" });
```

`data` enviado à server function (`salvarPrivacidadeFn({ data })`):

```json
{
  "historico": "autenticados",
  "mapa": "autenticados",
  "insignias": "autenticados",
  "equipamentos": "eu",
  "fotos": "autenticados"
}
```

Resultado devolvido pela chamada:

```json
null
```
