# `recarregarVisao`

[← Índice de APIs](../README.md) · Módulo: [Sessão e leitura](../README.md#sessao)

| | |
|---|---|
| Server function | `obterVisaoFn` em [`src/api/sessao.functions.ts`](../../../src/api/sessao.functions.ts) |
| Uso no navegador | `recarregarVisao(…)` |
| Método | `GET` |
| Acesso | Pública (visitante recebe a visão de visitante) |

Devolve a **visão** da pessoa: o recorte da base que ela pode ver (eventos, inscrições, notificações etc.). É chamada pelo `AuthProvider` depois de montar a página e ao voltar o foco para a aba (no máximo a cada 5 s).

## Entrada

Nenhuma.

## Regras

- A identidade vem do cookie de sessão; sem sessão, a visão é a de visitante.
- Conta desativada recebe a mesma visão de um visitante.
- O recorte é feito por `visaoParaUsuario` (`src/lib/visao.ts`), a fronteira de leitura do sistema.

## Resposta

`null` como resultado; a visão nova é aplicada ao snapshot do navegador pelo wrapper.

## Exemplo

```ts
import { recarregarVisao } from "@/api/sessao.functions";

await recarregarVisao();          // atualiza carregarBase() e re-renderiza as telas
```

Resposta da server function:

```json
{
  "resultado": null,
  "visao": {
    "usuarioId": "14c8b8e6-1fed-4d9c-91de-1762cbf52874",
    "base": {
      "eventos": [
        "…"
      ],
      "inscricoes": [
        "…"
      ],
      "notificacoes": [
        "…"
      ]
    }
  }
}
```
