# Fluxos

[← Documentação](README.md) · [Regras de negócio](regras-de-negocio.md) · [APIs](api/README.md) · [Arquitetura](ARQUITETURA.md)

Os caminhos principais do sistema, ponta a ponta. Os diagramas usam Mermaid (o GitHub os desenha).
Os nomes nas setas são as APIs; cada uma tem sua página em [`docs/api/`](api/README.md).

## Sumário

1. [Toda escrita: unidade de trabalho](#1-toda-escrita-unidade-de-trabalho)
2. [Cadastro, login e organizador](#2-cadastro-login-e-organizador)
3. [Inscrição com pagamento (Stripe)](#3-inscrição-com-pagamento-stripe)
4. [Estados da inscrição](#4-estados-da-inscrição)
5. [Criar, publicar e cancelar um evento](#5-criar-publicar-e-cancelar-um-evento)
6. [Check-in offline](#6-check-in-offline)
7. [Suporte com encaminhamento](#7-suporte-com-encaminhamento)
8. [Repasse à organização (Stripe Connect)](#8-repasse-à-organização-stripe-connect)
9. [Comunidade e moderação](#9-comunidade-e-moderação)

---

## 1. Toda escrita: unidade de trabalho

Toda API que grava passa por `mutar` (`src/server/unidade.server.ts`). Detalhes em
[ARQUITETURA.md §3](ARQUITETURA.md#3-fluxo-de-uma-requisição).

```mermaid
sequenceDiagram
    participant N as Navegador
    participant F as Server function (src/api)
    participant U as mutar (unidade de trabalho)
    participant DB as Supabase (Postgres)
    N->>F: chamada com data
    F->>F: valida a entrada (zod)
    F->>U: mutar(regra)
    U->>U: identidade pela sessão (JWT)
    U->>DB: versão atual (e exportar_base se mudou)
    U->>U: executa a regra sobre a base
    U->>DB: aplicar_mudancas(lote, versão) — 1 transação
    alt outra escrita entrou antes (MS409)
        U->>U: espera e refaz (até 4 vezes)
    end
    U-->>F: { resultado, visão }
    F-->>N: resposta
    N->>N: aplica a visão e re-renderiza
```

## 2. Cadastro, login e organizador

```mermaid
flowchart LR
    A[Visitante] -->|cadastrar| B{Idade}
    B -->|menor de 15| X[Recusado]
    B -->|15 a 17| C[Participante<br/>autorização pendente]
    B -->|18+| D[Participante]
    C -->|admin: aprovarAutorizacaoResponsavel| D
    D -->|solicitarOrganizador| E[Solicitação pendente]
    E -->|admin: iniciar| F[Em análise]
    F -->|admin: ajustes| G[Ajustes solicitados]
    G -->|reenviarSolicitacao| E
    F -->|admin: rejeitar| H[Rejeitada]
    F -->|admin: aprovar| I[Organizador<br/>organização ativa]
```

- Login: [`entrar`](api/sessao/entrar.md); a sessão fica em cookies. Conta desativada é deslogada.
- Senha esquecida: [`recuperarSenha`](api/sessao/recuperarSenha.md) → e-mail em português →
  `/recuperar-senha?token_hash=…` → [`validarTokenRecuperacao`](api/sessao/validarTokenRecuperacao.md) →
  [`definirNovaSenha`](api/sessao/definirNovaSenha.md).

## 3. Inscrição com pagamento (Stripe)

Com `STRIPE_SECRET_KEY` configurada e valor a pagar. Sem Stripe ou sem valor, a inscrição é
confirmada direto no primeiro passo.

```mermaid
sequenceDiagram
    actor P as Participante
    participant App as Site (server functions)
    participant DB as Banco
    participant S as Stripe
    participant E as Edge Function stripe-webhook

    P->>App: confirmarInscricao (clienteId)
    App->>DB: valida tudo e cria reserva "pendente" (32 min)<br/>prende vaga, cupom e benefício
    App->>S: cria/reabre Checkout Session
    App-->>P: urlPagamento
    P->>S: paga no checkout
    par Webhook
        S->>E: checkout.session.completed (Stripe-Signature)
        E->>E: confere assinatura do Stripe
        E->>App: POST /api/stripe/webhook (x-milsim-assinatura)
        App->>DB: confirma (idempotente): QR, movimentação, notificação
    and Retorno do checkout
        S-->>P: /app/ingressos?pagamento=sucesso&sessao=cs_…
        P->>App: sincronizarPagamento(sessao)
        App->>S: consulta a sessão
        App->>DB: confirma (idempotente)
    end
    App-->>P: inscrição confirmada (QR liberado)
```

Desvios:
- **Desistiu ou o prazo acabou**: `checkout.session.expired` (ou a varredura, 10 min depois do
  prazo) libera a reserva; vaga, cupom e benefício voltam.
- **Pagamento assíncrono** (boleto): `completed` sem pagamento marca `processando` (a vaga continua
  presa) até `async_payment_succeeded` (confirma) ou `async_payment_failed` (libera).
- **Pagou tarde demais** e não há mais vaga: o pagamento é reembolsado automaticamente.
- **Voltar a pagar depois**: [`retomarPagamento`](api/inscricoes/retomarPagamento.md) reabre a mesma sessão.
- **Rede caiu no envio**: reenviar com o mesmo `clienteId` devolve a mesma reserva e o mesmo checkout.

## 4. Estados da inscrição

```mermaid
stateDiagram-v2
    [*] --> pendente: inscrição paga (Stripe)
    [*] --> confirmada: gratuita, cortesia ou sem Stripe
    pendente --> confirmada: pagamento confirmado
    pendente --> cancelada: expirou, falhou, desistiu ou nova tentativa
    confirmada --> estornada: cancelamento (titular, gestão ou admin) ou evento cancelado
    estornada --> [*]
    cancelada --> [*]
```

| Status | Ocupa vaga | QR de entrada | Entra no financeiro |
|---|---|---|---|
| `pendente` (reserva vigente) | sim | não | não (aparece em "reservas aguardando") |
| `confirmada` | sim | sim | sim |
| `cancelada` | não | não | não |
| `estornada` | não | não (invalidado) | sim, com o estorno |

## 5. Criar, publicar e cancelar um evento

```mermaid
flowchart TD
    A[Organizador abre o editor] -->|salvarEvento| B[Rascunho]
    B -->|salvarEvento autosave| B
    B -->|publicarEvento: valida requisitos| C[Publicado]
    C -->|cria fóruns da comunidade| C
    C -->|criarCupom / criarCortesia| C
    C -->|cancelarEvento + justificativa| D[Cancelado]
    D -->|estorna confirmadas, libera reservas,<br/>reembolsa no Stripe, devolve benefícios| D
    B -->|excluirEvento: sem inscrições| E[Excluído]
```

- O editor (`src/components/editorEvento/`) tem 7 etapas: informações gerais (inclui o contato no
  WhatsApp), data e local, imagem, exércitos, ingressos e lotes, cronograma e regras, revisão.
- Rascunhos salvam sozinhos no servidor. Edições de evento publicado ficam no aparelho (IndexedDB)
  até "Salvar alterações", para não mudar a página pública antes da hora.

## 6. Check-in offline

```mermaid
sequenceDiagram
    actor O as Operador (portaria)
    participant A as Aparelho (IndexedDB)
    participant App as Servidor
    O->>A: baixa a base mínima do evento (com sinal)
    loop Na portaria (com ou sem sinal)
        O->>A: lê o QR / digita o código
        A->>A: valida localmente (evento, status, entrada anterior)
        A->>A: grava a operação na fila "pendente"
    end
    O->>App: enviarFilaCheckin(fila)
    App->>App: idempotente por id, confere operador e permissão
    App-->>A: cada operação: sincronizado ou conflito (com motivo)
    App->>App: recalcula participação (insígnias e recompensas)
```

## 7. Suporte com encaminhamento

```mermaid
sequenceDiagram
    actor P as Participante
    actor Ad as Admin
    actor Or as Organização do evento
    P->>Ad: abrirChamadoSuporte (tipo evento)
    Ad->>Ad: assumirChamado
    Ad->>P: enviarMensagemSuporte (canal participante)
    Ad->>Or: encaminharChamado (orientação + anexos escolhidos)
    Note over P: status exibido: "Aguardando organizador"
    Or->>Ad: enviarMensagemSuporte com encaminhamentoId (canal interno)
    Or->>Ad: marcarRetornoEnviado
    Ad->>P: enviarMensagemSuporte com a resposta
    Ad->>Ad: alterarStatusChamado("resolver", solução)
    P->>Ad: alterarStatusChamado("fechar") ou "reabrir"
```

```mermaid
stateDiagram-v2
    [*] --> aberto
    aberto --> em_atendimento: admin responde ou assume
    aberto --> aguardando_participante: aguardar
    aberto --> resolvido: resolver
    em_atendimento --> aguardando_participante: aguardar
    aguardando_participante --> em_atendimento: participante responde
    em_atendimento --> resolvido: resolver (com solução)
    aguardando_participante --> resolvido: resolver
    resolvido --> em_atendimento: reabrir
    aberto --> fechado: fechar
    em_atendimento --> fechado: fechar
    aguardando_participante --> fechado: fechar
    resolvido --> fechado: fechar
    fechado --> [*]
```

## 8. Repasse à organização (Stripe Connect)

```mermaid
sequenceDiagram
    actor Or as Organizador
    participant App as Site
    participant S as Stripe
    Or->>App: cadastrarRecebimento(organização)
    App->>S: cria conta Express (1ª vez) e link de cadastro
    App-->>Or: url do cadastro
    Or->>S: preenche dados e conta bancária
    S-->>Or: volta para /organizacao/financeiro?recebimento=retorno
    Or->>App: atualizarRecebimento
    S->>App: account.updated (webhook de Connect)
    App->>App: situação: ativa, transferências ligadas
    Note over App: próximas reservas: cobrança com destino à organização,<br/>menos a taxa da plataforma
```

## 9. Comunidade e moderação

```mermaid
flowchart LR
    P[Membro] -->|criarPublicacao / responder / alternarCurtida| F[(Fórum)]
    P -->|denunciar| D[Denúncia]
    D -->|gestão: analisarDenuncia| R{Decisão}
    R -->|procedente| O[gestão: ocultarConteudo]
    R -->|descartada| F
    G[Gestão] -->|fixar, fechar respostas, mover| F
    G -->|suspenderUsuario| S[Membro só lê]
    G -->|reativarUsuario| P
```
