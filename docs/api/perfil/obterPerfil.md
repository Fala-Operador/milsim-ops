# `obterPerfil`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `obterPerfilFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `obterPerfil(…)` |
| Método | `POST` |
| Acesso | Pública (o conteúdo depende de quem vê e da privacidade do dono) |

Monta o perfil social de um operador (callsign, bio, histórico, mapa, insígnias, equipamentos e fotos) já filtrado pela privacidade.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `usuarioId` | string | Dono do perfil. |

## Regras

- Visitante deslogado recebe só nome e foto (`restrito: true`).
- Cada bloco tem visibilidade `eu` (só o dono) ou `autenticados` (qualquer conta logada).
- Privacidade, completude, operações futuras e recompensas só vão para o próprio dono.
- Nunca inclui CPF, nascimento, endereço, telefone, e-mail, notas fiscais ou o exército das inscrições (`montarPerfil`, `src/lib/perfilSocial.ts`).
- Quando o dono abre o próprio perfil, a progressão (insígnias e recompensas) é recalculada antes (idempotente).

## Resposta

`PerfilDTO` ou `null` se o perfil não existe.

## Exemplo

```ts
import { obterPerfil } from "@/api/perfil.functions";

const perfil = await obterPerfil("14c8b8e6-1fed-4d9c-91de-1762cbf52874");
```

`data` enviado à server function (`obterPerfilFn({ data })`):

```json
{
  "usuarioId": "14c8b8e6-1fed-4d9c-91de-1762cbf52874"
}
```

Resultado devolvido pela chamada:

```json
{
  "usuarioId": "14c8b8e6-…",
  "nome": "Italo G.",
  "proprio": false,
  "restrito": false,
  "social": {
    "callsign": "Falcão",
    "bio": "Operador de suporte.",
    "instagram": "https://www.instagram.com/falcao.airsoft/"
  },
  "destaque": {
    "icone": "🎖️",
    "nome": "Veterano"
  },
  "resumo": {
    "operacoes": 7,
    "estados": 2,
    "insignias": 3
  },
  "operacoes": [
    {
      "eventoId": "evt-serra-verde",
      "nome": "Operação Serra Verde",
      "estado": "participou"
    }
  ],
  "insignias": [
    {
      "nome": "Veterano",
      "icone": "🎖️"
    }
  ]
}
```
