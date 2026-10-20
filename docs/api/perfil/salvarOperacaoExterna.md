# `salvarOperacaoExterna`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `salvarOperacaoExternaFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `salvarOperacaoExterna(…)` |
| Método | `POST` |
| Acesso | Dono do perfil (a própria conta) |

Registra (ou edita) uma operação de que o operador participou **fora da plataforma**, com foto obrigatória. Aparece no mapa e no perfil como "Registrada pelo operador".

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id?` | string | Ausente = nova. |
| `nome` | string (2–120) |  |
| `data` | AAAA-MM-DD | Já aconteceu (não aceita data futura). |
| `cidade` | string (até 80) |  |
| `uf` | string (2) | UF válida. |
| `organizacao?` | string (até 120) |  |
| `modalidade?` | id do catálogo |  |
| `foto` | data URL \| URL salva | Obrigatória: JPEG, PNG ou WebP até 3 MB; ao editar, pode reenviar a URL já salva. |
| `fotoAlt?` | string (até 200) |  |
| `descricao?` | string (até 400) |  |
| `visivel` | boolean | Mostrar no perfil público (segue a privacidade do mapa). |

## Regras

- **Nunca conta para insígnias, recompensas nem participação**: essas regras só leem inscrições com presença confirmada na plataforma.
- No resumo do perfil entra só em `estadosTotal` ("N no total"); `estados` continua só com a plataforma.
- Até 200 operações por pessoa. A foto vai para o bucket público `midia`.

## Resposta

O id da operação.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Operação não encontrada.
- Limite de ${MAX_OPERACOES_EXTERNAS} operações registradas.
- Informe o nome da operação.
- Nome da operação: no máximo 120 caracteres.
- Informe a data da operação.
- Data muito antiga.
- Registre só operações que já aconteceram.
- Informe a cidade.
- Cidade: no máximo 80 caracteres.
- Escolha o estado (UF).
- Modalidade inválida.
- Adicione uma foto da operação.
- Texto acima de [limite] caracteres.
- Imagem grande demais. Use uma menor.
- Formato inválido. Use JPG, PNG ou WebP.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { salvarOperacaoExterna } from "@/api/perfil.functions";

const id = await salvarOperacaoExterna({
  nome: "Operação Caatinga", data: "2025-08-10", cidade: "Petrolina", uf: "PE",
  organizacao: "Grupo Sertão", modalidade: "milsim", foto: dataUrlDaFoto, visivel: true,
});
```

`data` enviado à server function (`salvarOperacaoExternaFn({ data })`):

```json
{
  "nome": "Operação Caatinga",
  "data": "2025-08-10",
  "cidade": "Petrolina",
  "uf": "PE",
  "organizacao": "Grupo Sertão",
  "modalidade": "milsim",
  "foto": "data:image/jpeg;base64,/9j/4AAQ…",
  "visivel": true
}
```

Resultado devolvido pela chamada:

```json
"opx-mv9k2a1b-x7q2"
```
