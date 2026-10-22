# `incluirParticipantes`

[← Índice de APIs](../README.md) · Módulo: [Inscrições e pagamento](../README.md#inscricoes)

| | |
|---|---|
| Server function | `incluirParticipantesFn` em [`src/api/inscricoes.functions.ts`](../../../src/api/inscricoes.functions.ts) |
| Uso no navegador | `incluirParticipantes(…)` |
| Método | `POST` |
| Acesso | Organização do evento ou admin (lista de contas: só admin) |

Inclui manualmente pessoas com conta no evento (pagamento combinado por fora). Cada inscrição entra confirmada, como cortesia sem valor.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |
| `identificador` | string (até 200), opcional | Organização: e-mail ou CPF (com ou sem máscara) de uma conta ativa. |
| `usuarioIds` | string[] (até 50), opcional | Admin: contas escolhidas na lista. Repetidas contam uma vez. Tem prioridade sobre `identificador`. |
| `tipoId` | string | Tipo de ingresso não arquivado (o mesmo para todas as pessoas). |
| `exercitoId` | string | O mesmo para todas as pessoas. |
| `observacao` | string (até 500), opcional | Vai para a auditoria de cada inclusão. |

## Regras

- Para cada pessoa, cria uma cortesia em seu nome e a resgata na mesma transação (`origem` = `organizador` ou `admin`, conforme quem inclui).
- Valem idade/autorização, inscrição única por evento, tipo e exército válidos e capacidade (evento, exército e tipo). Não exige lote aberto.
- Evento `publicado` ou `inscricoes_encerradas`.
- **Tudo ou nada**: se uma pessoa não puder entrar, ninguém é incluído; com várias pessoas, a mensagem começa com o nome de quem impediu.
- Registra `inclusao_manual` na auditoria (uma por inscrição) e notifica cada pessoa incluída; inclusão pelo admin também envia **um** aviso aos organizadores do evento, com os nomes.

## Resposta

As inscrições criadas (`Inscricao[]`), na ordem informada.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio). Com várias pessoas, as mensagens da inscrição vêm precedidas de `Nome da pessoa: `.

- Você só pode gerenciar eventos da sua organização.
- Só a administração escolhe participantes pela lista.
- Inclua no máximo 50 participantes por vez.
- Uma das contas selecionadas não existe ou está desativada.
- Informe ao menos um participante.
- Nenhuma conta ativa encontrada com este e-mail ou CPF.
- Tipo de ingresso indisponível.
- Esta pessoa já possui uma inscrição ativa neste evento.
- Esta pessoa tem de 15 a 17 anos e ainda não tem a autorização do responsável aprovada.
- Esta pessoa tem um pagamento em processamento para este evento. Aguarde a confirmação.
- Evento não está disponível para inscrição.
- Exército inválido.
- Evento esgotado.
- O {exército} não possui vagas.
- Este tipo de ingresso esgotou.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { incluirParticipantes } from "@/api/inscricoes.functions";

// Organização: uma conta por e-mail ou CPF
await incluirParticipantes({
  eventoId: "evt-…",
  identificador: "operador@exemplo.com",
  tipoId: "tp-…",
  exercitoId: "ex-…",
  observacao: "Pagou via PIX direto ao organizador em 20/10.",
});

// Admin: várias contas escolhidas na lista
await incluirParticipantes({ eventoId: "evt-…", usuarioIds: ["usr-…", "usr-…"], tipoId: "tp-…", exercitoId: "ex-…" });
```

`data` enviado à server function (`incluirParticipantesFn({ data })`):

```json
{
  "eventoId": "evt-…",
  "usuarioIds": ["usr-…", "usr-…"],
  "tipoId": "tp-…",
  "exercitoId": "ex-…"
}
```

Resultado devolvido pela chamada: lista de inscrições, cada uma com `status: "confirmada"`, `origem: "admin"` (ou `"organizador"`), `valorCentavos: 0` e `cortesiaId` preenchido.
