# Arquitetura — MilSim Ops

Documento técnico para quem vai manter ou evoluir o sistema. Complementa o
[README](../README.md) (visão geral e execução) e o [AGENTS.md](../AGENTS.md) (regras
obrigatórias). Em caso de conflito, o `AGENTS.md` prevalece.

Veja também: [regras de negócio](regras-de-negocio.md), [fluxos](fluxos.md) e a
[referência das APIs](api/README.md) (uma página por API, com exemplo).

---

## 1. Visão geral

O MilSim Ops é um **monólito TanStack Start** (React 19 com SSR) integrado ao **Supabase**:

- **Postgres** guarda todos os dados da aplicação (28 tabelas transacionais + métricas).
- **Auth** cuida de login, sessão (cookies HTTP via `@supabase/ssr`) e recuperação de senha.
- **Storage** guarda fotos, imagens de publicações, logos, banners e PDFs (bucket público `midia`).

O navegador **nunca** acessa o banco. As APIs são as **server functions** de `src/api/`: elas
identificam a pessoa pela sessão, executam as regras de negócio (o mesmo código de
`src/services/`, agora rodando no servidor) e devolvem o resultado junto com a **visão**, que é o
recorte da base que essa pessoa pode ver.

```
 Navegador                                     Servidor (TanStack Start / Nitro)                  Supabase
┌──────────────────────────┐   server fn    ┌──────────────────────────────────────────┐   RPC   ┌───────────────┐
│ páginas (src/routes)     │ ─────────────▶ │ src/api/*.functions.ts  (zod, identidade) │ ──────▶ │ export_base   │
│ carregarBase() = visão   │                │ src/server/unidade.server.ts              │         │ aplicar_      │
│ (somente leitura)        │ ◀───────────── │  ├ lê base → roda serviço → envia mídia   │ ◀────── │  mudancas     │
│ src/api/cliente.ts       │ {resultado,    │  └ grava diferenças (1 transação)         │         │ Auth · Storage│
└──────────────────────────┘   visão}       │ src/lib/visao.ts (recorte por perfil)     │         └───────────────┘
                                            └──────────────────────────────────────────┘
```

**Princípio de organização:**

- regras de decisão ficam em `src/lib/`, como funções puras cobertas por testes;
- `src/services/` aplica as regras sobre a base;
- `src/server/` cuida de identidade, persistência e Supabase;
- `src/api/` é a fronteira HTTP.

Componentes não gravam dados nem decidem permissões.

---

## 2. Stack e infraestrutura

| Item | Detalhe |
|---|---|
| Framework | `@tanstack/react-start` 1.168, `@tanstack/react-router` 1.170 (versões fixadas) |
| Supabase | `@supabase/supabase-js` 2.117.3 e `@supabase/ssr` 0.12.7 (fixadas). Projeto `milsim-ops`, ref `fezrmoyjsffufdjptamp`, sa-east-1 |
| Build | Vite 8 via `@lovable.dev/vite-tanstack-config` (React, Tailwind, alias `@/`, Nitro com alvo Cloudflare). Não adicione esses plugins manualmente. |
| Servidor | `src/server.ts` envolve o handler do Start e transforma erros de SSR em página de erro; `src/start.ts` aplica middleware de erro e **CSRF** nas server functions. |
| Proteção de importação | Arquivos `src/server/*.server.ts` importam `@tanstack/react-start/server-only`: o build falha se algum deles chegar ao bundle do navegador. |
| UI | Componentes próprios em `src/components/ui.tsx`; `src/components/ui/` (shadcn) é herança do template e não é usado. |
| Testes | Vitest + jsdom; serviços rodam sobre uma base em memória (`src/test/baseTeste.ts`). |

### Árvore de provedores (`src/routes/__root.tsx`)

```
LimiteErroRaiz
└─ QueryClientProvider
   └─ AuthProvider            carrega a visão após montar; usuário = visão.usuarioId
      └─ ThemeProvider        tema efetivo (visitante = escuro)
         └─ LocalizacaoProvider
            └─ PreferenciasProvider
               ├─ Providers → NotificationProvider, Header, <main>
               │                (esqueleto até a 1ª visão; erro com "tentar novamente")
               └─ PreferenciasModal
```

---

## 3. Fluxo de uma requisição

### 3.1 Escrita (ex.: confirmar inscrição)

1. A página chama `confirmarInscricao(...)` de `src/api/inscricoes.functions.ts` (wrapper do navegador).
2. A server function valida a entrada com **zod** e chama `mutar(fn)`.
3. `mutar` (`src/server/unidade.server.ts`):
   1. lê o `sub` do JWT da sessão (`supabase.auth.getClaims()`; nunca `getSession`);
   2. carrega a base inteira com a RPC `export_base` (uma ida ao banco) e a versão atual;
   3. identifica o usuário **ativo**; desativado = visitante;
   4. executa `fn` dentro de um `AsyncLocalStorage`, de modo que `carregarBase()`/`mutarBase()`
      dos serviços passam a apontar para a base desta requisição;
   5. envia ao Storage os data URLs base64 encontrados nos registros alterados
      (`src/server/midia.ts`) e os troca pela URL pública;
   6. calcula o lote mínimo de mudanças (`calcularMudancas`, em `src/lib/persistencia.ts`) e grava
      com a RPC `apply_changes(lote, versão)`, numa **única transação**;
   7. se outra escrita entrou no meio, a RPC falha com o código próprio `MS409` e o ciclo
      recomeça (até 4 vezes, com espera crescente e aleatória). **Nunca use `40001`** em
      funções chamadas pela API: o PostgREST repete transações com esse código sem limite,
      o que prende conexões do pool e derruba a API (ver
      `supabase/migrations/20261014193000_conflito_sem_retentativa.sql`);
   8. devolve `{ resultado, visão }`.
4. O wrapper (`chamar` em `src/api/cliente.ts`) aplica a visão nova ao snapshot do navegador, e as
   telas re-renderizam via `useVersaoBase()`.

O controle de concorrência é **otimista e global** (tabela `base_control`): escritas são
serializadas, e regras como "vagas restantes" e "uma inscrição ativa" são verificadas sobre
dados atuais. O índice único parcial `inscricoes_uma_ativa_por_evento` (em `registrations`) reforça essa última
regra no próprio banco.

### 3.2 Leitura

- **Visão inicial**: `AuthProvider` chama `obterVisaoFn` (GET) depois de montar. Também recarrega
  ao voltar o foco para a aba (no máximo a cada 5 s).
- **Carregadores de rota** (`eventos.$eventoId`, `inscricao.$eventoId`, `comunidade.$eventoId`)
  usam `obterEventoFn`, que roda `consultar()`. A função recebe **só a visão** da pessoa, então o
  título e as metatags do SSR saem com dados reais sem risco de vazamento.
- **Métricas** têm API própria (`listarAnalyticsFn`), porque os registros não fazem parte da visão.

### 3.3 Erros

`ErroDominio` (regra violada) chega ao navegador com a mensagem original. Qualquer outro erro é
registrado no log do servidor e vira "Não foi possível concluir a operação". As telas mostram
`e.message`.

---

## 4. Autenticação — `src/server/auth.server.ts`, `src/api/sessao.functions.ts`

| Operação | Como funciona |
|---|---|
| Entrar | `signInWithPassword` no cliente de sessão (cookies). Conta com perfil inativo é deslogada na hora. |
| Cadastrar | `validarCadastro` (CPF, idade ≥ 15, termos...) → `auth.admin.createUser` (e-mail já confirmado) → `registrarPerfil` na unidade de trabalho (CPF/e-mail únicos). Se o perfil falhar, a conta do Auth é apagada. Depois faz login. |
| Sair | `signOut`, que limpa os cookies. |
| Recuperar senha | `resetPasswordForEmail` com retorno para `/recuperar-senha`. O e-mail usa o template em português `supabase/templates/recuperar-senha.html` (publicado com `npx supabase config push`), com link `{{ .SiteURL }}/recuperar-senha?token_hash=…&type=recovery` (endereço do site, não o que o servidor vê atrás do proxy; se cair na página inicial, ela encaminha): a tela "Criar nova senha" valida com `verifyOtp` (funciona em qualquer aparelho) e define a nova senha (`updateUser`). Links antigos com `?code=` (PKCE, mesmo navegador) continuam aceitos. |

- `users.id` é o mesmo `id` de `auth.users`. Perfil, papel (`admin`/`organizador`/`participante`)
  e organização ficam na tabela `usuarios`, **nunca** em `user_metadata`.
- A identidade é sempre a da sessão. As APIs ignoram qualquer `usuarioId`/`perfil` vindo do navegador.
- Supabase Auth: `site_url` e URLs de retorno configurados para `http://localhost:8080`
  (`supabase/config.toml`). **Inclua a URL publicada** em `additional_redirect_urls` antes de usar a
  recuperação de senha em produção. O `config.toml` não é enviado pelo deploy do GitHub Actions:
  publique com `npx supabase config push` (ele mostra a diferença e pede confirmação).
- O cadastro cria a conta já confirmada (`auth.admin.createUser`): não há e-mail de confirmação.
- Áreas `/app`, `/organizacao` e `/admin` exigem conta por `useExigirLogin` (`src/hooks/`): só
  redireciona com a visão carregada e enquanto o endereço é da área, com `replace`.

---

## 5. Banco de dados — `supabase/migrations/`

### 5.1 Modelo de acesso

- **RLS ativo em todas as tabelas, sem policies**: `anon` e `authenticated` não leem nem gravam
  nada (verificado: a chave publicável recebe `42501`).
- Privilégios só para `service_role`, usado pelo servidor com `SUPABASE_SECRET_KEY`.
- RPCs `export_base`, `apply_changes` e `base_tables`: `EXECUTE` só para `service_role`,
  `search_path` vazio, `SECURITY INVOKER`.
- Bucket `midia`: leitura pública por URL; upload só pelo servidor. Tipos permitidos: jpeg,
  png, webp, gif e pdf; tamanho máximo de 10 MB (PDF até 5 MB, validado no servidor).
- Bucket `documentos`: **privado** (5 MB). Notas fiscais (`<usuario>/<uuid>.<ext>`, só o dono) e
  anexos do suporte (`suporte/<chamado>/…`, depois de conferir o acesso). Acesso só por URL
  assinada de curta duração gerada pelo servidor; o tipo real é conferido pelos primeiros bytes.

### 5.2 Convenções

- Tabelas e colunas em **inglês** (snake_case); o código de domínio continua em português. A
  correspondência campo → coluna fica só em `src/lib/esquemaBanco.ts`, usada pelo mapeador de
  `src/lib/persistencia.ts` na leitura e na gravação.
- **Sem `jsonb`**: cada lista ou objeto aninhado dos tipos é uma tabela filha com a chave do pai
  (listas também com `position`, a ordem do item), ex.: `event_factions`, `event_ticket_types`,
  `event_ticket_batches` → `event_ticket_batch_items`, `registration_payments` →
  `registration_payment_disputes`. Objetos pequenos dentro de uma filha (recortes da imagem,
  anexo e ação de uma mensagem, destino do banner) são colunas dela. Um teste pgTAP garante que
  não há coluna json/jsonb.
- Valores enumerados (status, tipos, origens) continuam em português: são dados, não nomes.
- Ids em texto gerados pela aplicação (prefixo + tempo + aleatório). A exceção é `users.id`,
  que é `uuid`.
- Datas em `timestamptz`. O mapeador devolve no formato de `toISOString()`.
- Chaves estrangeiras `DEFERRABLE INITIALLY DEFERRED`, para que o lote seja aplicado em qualquer
  ordem. Filhos de `events` e as tabelas filhas usam `on delete cascade`. `audit_logs.author_id` e
  `moderation_logs.author_id` são texto livre, para a trilha sobreviver à remoção do alvo.
- Índices em todas as chaves estrangeiras.

### 5.3 Tabelas

| Grupo | Tabelas (filhas entre parênteses) |
|---|---|
| Contas | `users` (`user_addresses`, `user_notification_settings` → `user_support_reads`, `user_modality_preferences` → `user_preferred_modalities`), `organizations` (`organization_payout_accounts` → `organization_payout_requirements`), `organizer_requests` |
| Eventos e vendas | `events` (`event_images`, `event_factions`, `event_ticket_types`, `event_ticket_batches` → `event_ticket_batch_items`, `event_schedule_items`, `event_rules_documents`), `registrations` (`registration_payments` → `registration_payment_disputes`), `coupons` (`coupon_eligible_ticket_types`), `complimentary_tickets`, `financial_transactions` |
| Engajamento | `missions`, `mission_submissions`, `announcements`, `announcement_comments` |
| Suporte e governança | `support_tickets` (`support_ticket_messages` → `support_message_shared_attachments`), `notifications`, `audit_logs`, `privacy_requests` |
| Comunidade | `forums`, `forum_posts` (`forum_post_images`), `forum_replies` (`forum_reply_images`), `forum_post_likes`, `community_reports`, `forum_preferences`, `community_restrictions`, `moderation_logs`, `community_visits` |
| Divulgação | `partners` (`partner_links`), `home_sections` (`home_section_geo_scopes`, `home_section_schedules`, `home_section_highlights`, `home_section_auto_selections`, `home_section_partners`, `home_section_banners`), `event_boosts` (`event_boost_placements`, `event_boost_geo_scopes`) |
| Check-in | `check_ins` (base de referência da portaria) |
| Perfil e gamificação | `operator_profiles` (`operator_profile_privacy`, `operator_profile_hidden_events`), `equipment` (`equipment_photos`, `equipment_invoices`), `profile_photos`, `badges` (`badge_criteria`), `badge_awards` (`badge_award_criteria`), `reward_campaigns` (`reward_campaign_eligible_events`, `reward_campaign_eligible_ticket_types`), `vouchers` (`voucher_benefits` → `voucher_benefit_eligible_events`, `voucher_benefit_eligible_ticket_types`), `attendance_corrections` |
| Pagamentos | `platform_settings` (taxa); os dados do Stripe ficam em `registration_payments` e `organization_payout_accounts` |
| Documentos privados (fora da base transacional) | `private_documents` (metadados das notas fiscais; nunca na visão) |
| Métricas (fora da base transacional) | `analytics_events` (append-only), `marketing_campaigns` |
| Controle | `base_control` (versão global) |

### 5.4 Mudando o schema

As migrations ficam em `supabase/migrations/` e são aplicadas pelo **GitHub Actions**
(`.github/workflows/deploy.yml`, `supabase db push` a cada push no `main`). O
`check.yml` simula o push e roda os testes pgTAP em todo PR que mexe em `supabase/`.

1. `npx supabase migration new <nome>`: RLS ligado, sem policies, `grant` só para `service_role`.
   O carimbo de data precisa ser **posterior** à última migration aplicada.
2. Atualize o tipo em `src/lib/domain/types.ts`, o mapeamento em `src/lib/esquemaBanco.ts` (nome
   em inglês de cada coluna; lista ou objeto aninhado = tabela filha) e, se for uma tabela
   transacional nova, a lista em `base_tables()` (SQL); o teste de `persistencia` compara as duas.
3. Filtre a nova coleção em `visaoParaUsuario` e cubra com teste.
4. Aplique com `npx supabase db push --linked` (ou deixe o deploy aplicar) e rode
   `npx supabase db advisors --linked`. **Nunca** aplique uma migration à mão (`db query -f`, psql):
   ela fica fora do histórico, e o `db push` seguinte recusa todo o deploy.
5. Se aplicar localmente com `db push`, envie o arquivo para o `main` logo em seguida: o banco com uma
   migration que não está na pasta também faz o deploy falhar.
6. Mudanças destrutivas (apagar coluna/tabela) só com aprovação, numa migration própria que confere
   antes se há dados (ex.: `20261019200000_remove_colunas_pix.sql`).

---

## 6. Visão por perfil — `src/lib/visao.ts`

`visaoParaUsuario(base, usuario)` é a **fronteira de autorização das leituras**. Resumo:

| Dado | Visitante | Participante | Organizador | Admin |
|---|---|---|---|---|
| Eventos | públicos (não rascunho/arquivado) | + os seus | + os da sua organização | todos |
| Inscrições de terceiros | anônimas (sem titular, código ou token), só para contar vagas | idem | completas nos próprios eventos | todas |
| Usuários | — | si mesmo + perfil público dos autores da comunidade | + inscritos dos seus eventos (dados completos) | todos |
| Cupons / movimentações / check-ins | — | — | dos seus eventos | todos |
| Cortesias | — | as do próprio e-mail | dos seus eventos | todas |
| Comunidade | — | fóruns/publicações visíveis (mesmas regras das escritas) | + gestão do evento (ocultos, denúncias, moderação) | tudo |
| Notificações | — | as próprias | as próprias | todas |
| Auditoria | — | — | — | toda |
| Seções e parceiros | publicados/ativos | idem | idem | todos |
| Link do grupo do WhatsApp do evento | — | só com inscrição confirmada | dos seus eventos | todos |
| Pagamento (Stripe) de terceiros | situação mínima para contar vagas | idem | sem ids do Stripe | completo |
| Notas fiscais | — | nunca (só o dono, por link assinado) | nunca | nunca |

O "perfil público" troca CPF, e-mail, telefone e endereço por vazios, e o nome completo pelo nome
de exibição. Os cupons nunca vão ao navegador: a prévia de desconto usa `previsualizarCupomFn`.
O número de WhatsApp do organizador (`evento.whatsappContato`) é público.

---

## 7. APIs — `src/api/*.functions.ts`

Cada arquivo exporta as server functions (`...Fn`) e wrappers de mesmo nome para o navegador.
São 104 server functions em 14 módulos, mais o webhook do Stripe. A referência completa, com
entrada, regras, erros e exemplo de cada uma, está em **[docs/api/](api/README.md)**.

| Arquivo | Operações |
|---|---|
| `sessao` | visão, evento (loaders), login, cadastro, logout, recuperação de senha |
| `conta` | missões, privacidade, notificações, silêncio, foto, tema, preferências |
| `admin` | solicitações de organizador, desativação, autorização de menores, privacidade |
| `organizador` | solicitação, eventos (salvar, publicar, cancelar, excluir), cupons, cortesias |
| `inscricoes` | inscrição (idempotente), checkout do Stripe (retomar, sincronizar), cancelamento, prévia de cupom |
| `repasses` | conta Stripe Connect da organização, saldo e saques, painéis do Stripe, taxa da plataforma |
| `comunidade` | publicações, respostas, curtidas, denúncias, moderação, fóruns, preferências |
| `perfil` | perfil social, privacidade, arsenal, galeria, notas fiscais privadas |
| `suporte` | chamados, mensagens, encaminhamento à organização, status, anexos |
| `divulgacao` | seções e parceiros da página inicial (admin) |
| `impulsionamentos` | campanhas de destaque de eventos (admin) |
| `gamificacao` | insígnias, campanhas de recompensa, correção de participação |
| `checkin` | sincronização da fila da portaria |
| `analytics` | coleta anônima, leitura, campanhas de rastreio |

Todas as server functions passam pelo middleware de CSRF de `src/start.ts`. O único endpoint
HTTP público é `POST /api/stripe/webhook`, chamado pela Edge Function `stripe-webhook`.

---

## 8. Módulos de negócio

As regras abaixo são as mesmas de antes da migração. A diferença é que agora rodam no servidor.

- **Inscrições** (`services/inscricoes.ts`): a confirmação valida, em uma única mutação, evento
  publicado, autorização de menores, inscrição ativa única, tipo/exército, capacidades (evento,
  exército, tipo, lote), cortesia **ou** lote + cupom. Gera o **token do QR** e grava as
  movimentações e a notificação. O cancelamento estorna, notifica e audita. O evento de métrica da
  confirmação é registrado pelo navegador depois do sucesso, porque depende da atribuição local.
- **Pagamento de ingressos (Stripe Checkout)**: regras puras em `lib/pagamentos.ts` (reserva
  vigente, o que ocupa vaga, o que a visão mostra) e `lib/stripe.ts` (assinatura do webhook,
  eventos → ações); estados na base em `services/inscricoes.ts`; chamadas ao Stripe por `fetch`
  em `server/stripe.server.ts` e a orquestração em `server/pagamentos.server.ts`, **sempre fora
  de `mutar`** (que pode repetir a função). Com `STRIPE_SERVER_API_KEY` configurada, inscrição com
  valor a pagar nasce `pendente` com `pagamento.status = "aguardando"` e reserva a vaga (e o uso
  do cupom/benefício) por 32 min, o mesmo prazo da Checkout Session. Confirmam a inscrição o
  webhook (Stripe → Edge Function `supabase/functions/stripe-webhook`, que confere a assinatura
  do Stripe com os `whsec_` guardados no Supabase e repassa o evento assinado com
  `STRIPE_WEBHOOK_FORWARD_SECRET` → `POST /api/stripe/webhook`, `routes/api.stripe.webhook.ts`) e o retorno do checkout
  (`sincronizarPagamentoFn`), ambos idempotentes. Reserva expirada, pagamento recusado ou
  cancelado liberam a vaga; pagamento que chega sem vaga possível é reembolsado. Cancelar uma
  inscrição paga (ou o evento) marca `estorno_pendente`; depois de gravar, a API cria o
  reembolso no Stripe (chave de idempotência por inscrição) e registra `estornado` ou o erro,
  que é tentado de novo a cada webhook. Sem a chave, tudo continua como antes (confirmação
  direta, sem cobrança).
- **Repasse às organizações (Stripe Connect Express)**: cada organização cria pelo Financeiro
  uma conta Express (cadastro hospedado pelo Stripe, `account_links`); a situação fica em
  `organizacao.recebimento` (`lib/repasses.ts`, gravada por `services/repasses.ts`, atualizada no
  retorno do cadastro e pelo webhook de Connect `account.updated`) e só aparece na visão de quem
  gere a organização. Na reserva, se a conta tem transferências ativas, o pagamento guarda
  `contaDestino` e `taxaCentavos` (taxa da tabela `platform_settings`, editada em
  Administração → Pagamentos); o checkout vira cobrança
  com destino (`transfer_data.destination` + `application_fee_amount`). Sem conta ativa, o valor
  fica na plataforma e aparece no financeiro como "repasse à parte". O reembolso de venda
  repassada usa `reverse_transfer` e `refund_application_fee`. Com a conta ativa, Financeiro lê
  do Stripe (cabeçalho `Stripe-Account`, cache de 60 s no servidor, nada vai para a base nem
  para a visão) saldo, saques, cronograma e banco (`consultarSaldoRecebimento`, resumo puro em
  `resumoSaldo`). Com `STRIPE_BROWSER_PUBLIC_KEY`, o recebimento todo fica no site com os
  componentes embutidos do Stripe (`components/PaineisStripe.tsx`, `connect.js` carregado do
  Stripe): `account-onboarding` no cadastro (a conta Express é criada na primeira sessão),
  e, no painel aberto pelo organizador, `notification-banner` (pendências), `payouts`, `payments`
  e `account-management`. Uma única instância do Connect por organização serve todos esses
  componentes, nada do Stripe é montado sozinho ao carregar a página (a janela de confirmação
  do Stripe só abre depois de um clique, senão o navegador bloqueia) e o `logout` do Connect só
  roda ao sair da conta do site. A Account Session (`sessaoComponentesStripe`) tem reembolso e disputa
  desligados, porque o estorno passa pelo cancelamento da inscrição. Contas Express exigem a
  autenticação do Stripe numa janela própria; sem ela só com contas em que a plataforma coleta
  os requisitos (`controller.requirement_collection = application`), assumindo o risco de saldo
  negativo. Contestações (`charge.dispute.*`) ficam em
  `pagamento.disputa` (`registrarDisputaNaBase`) e aparecem como aviso no Financeiro.
- **Organizador** (`services/organizador.ts`): validação de publicação, capacidade nunca abaixo
  da ocupação (confirmadas + reservas vigentes), auditoria de modalidade, cancelamento com
  estorno em massa (e reembolso no Stripe do que foi pago online).
- **Check-in**: regras puras em `lib/checkin.ts`. A portaria valida e registra **no aparelho**
  (IndexedDB, funciona offline) e envia a fila por `sincronizarCheckins`. O servidor
  (`aplicarSincronizacao`) é idempotente por id, marca como conflito a segunda entrada ou
  inscrição cancelada, e recusa registros de outro operador. O QR traz um token opaco gerado na
  confirmação.
- **Comunidade** (`services/comunidade.ts`): papéis `gestao`/`membro`, fóruns por exército,
  limites (2000 caracteres, 4 imagens), moderação auditada. As permissões são reaplicadas em
  leituras (visão) e escritas (API).
- **Divulgação**: elegibilidade em `lib/divulgacao.ts`; escrita só por admin
  (`services/divulgacao.ts`).
- **Conta** (`services/conta.ts`): entrega de missão (só destinatário, dentro do prazo), chamados
  (solicitante, organização do evento ou admin), privacidade (notifica admins), notificações, tema
  e preferências.
- **Métricas**: coleta anônima em `services/analytics.ts` (ids aleatórios, deduplicação,
  atribuição em `localStorage`), enviada em lote. O servidor (`server/analytics.server.ts`)
  revalida os campos, descarta campanhas de outro evento, limita o horário e **reaplica a
  exclusão** de admin/organização. As fórmulas ficam em `lib/analytics.ts`.
- **Tema**: visitante sempre escuro; a conta guarda `tema`. O script de pré-pintura lê a cópia
  `milsim-demo:tema-conta`, que é apagada ao sair.
- **Localização e preferências**: a localização (cidade/UF) e as preferências do visitante ficam
  no `localStorage`; as da conta, na tabela `usuarios`.
- **Insights IA** (`lib/insights.*`): resumo agregado enviado ao gateway de IA do Lovable.
- **Contato do evento no WhatsApp** (`lib/contatoEvento.ts`): normalização do número (DDI) e do
  convite do grupo (só `chat.whatsapp.com`), validação no editor e no servidor (`salvarEvento`) e
  `podeVerGrupo`, usado pela visão para entregar o link só a inscritos confirmados e à gestão.
- **Movimentações do financeiro** (`lib/movimentacoes.ts`): abas por tipo, filtros (busca, período,
  meio de pagamento), ordenação e totais; o valor real dos descontos vem da inscrição.
- **Central de Suporte** (`lib/suporte.ts`, `services/suporte.ts`): triagem só da administração,
  encaminhamento à organização, canal interno, status derivados do histórico imutável.

Regras detalhadas de cada área: [regras-de-negocio.md](regras-de-negocio.md).

---

## 9. Limites conhecidos e evolução

| Ponto | Situação atual | Como evoluir |
|---|---|---|
| Carga por requisição | toda server function carrega a base inteira (1 RPC, ~200–400 ms em dev) | consultas por agregado (evento, comunidade) e RPCs específicas para operações críticas |
| Visão no navegador | o recorte do usuário vai inteiro a cada resposta; admin recebe tudo | APIs de leitura por página, com paginação |
| Concorrência | versão global: escritas simultâneas viram nova tentativa | travas por evento (`select … for update`) dentro de RPCs |
| SSR | as páginas renderizam o esqueleto no servidor (só o `head` do evento usa dados reais) | carregadores por rota com `consultar()` |
| Storage | sem limpeza de arquivos órfãos; a seed reenvia as imagens a cada execução | caminhos determinísticos + rotina de limpeza |
| E-mail | Resend como SMTP do Supabase Auth (30/h), só redefinição de senha | confirmação de e-mail no cadastro e e-mails transacionais do app |

---

## 10. Testes

`bun run test`: 30 arquivos, 277 testes (os serviços rodam sobre uma base em memória).

| Arquivo | Cobre |
|---|---|
| `regras.test.ts`, `cupons-lotes.test.ts`, `inscritos.test.ts`, `editor-evento.test.ts`, `modalidades.test.ts` | inscrição, lotes, cupons, cortesias, editor de eventos, modalidades |
| `pagamentos.test.ts`, `repasses.test.ts` | reserva e confirmação idempotentes no Stripe, liberação, reembolso, webhook, repasse e taxa |
| `contato-evento.test.ts`, `movimentacoes.test.ts` | WhatsApp do evento (normalização, validação, quem vê o grupo) e filtros do financeiro |
| `comunidade.test.ts`, `suporte.test.ts`, `silencio-notificacoes.test.ts` | comunidade, Central de Suporte, notificações |
| `checkin.test.ts`, `conta-checkin.test.ts` | check-in offline, fila e conflitos; operações da conta |
| `perfil-operador.test.ts`, `foto-perfil.test.ts`, `instagram.test.ts` | perfil social, privacidade, fotos, links |
| `divulgacao.test.ts`, `impulsionamento.test.ts`, `carrossel.test.ts`, `localizacao-tema.test.ts` | página inicial, impulsionamento, localização e tema |
| `relatorio-metricas.test.ts`, `insights.test.ts` | métricas e insights |
| `persistencia.test.ts` | camelCase↔snake_case, timestamps, ida e volta da base inteira, diff mínimo, chave composta |
| `visao.test.ts` | o que cada perfil recebe (sem CPF/e-mail para visitantes, cupons isolados por organização, inscrições anônimas...) |
| `app-routing.test.tsx`, `error-boundary.test.tsx`, `editor-imagem.test.tsx`, `manual-regras.test.ts` | rotas, erros de página, recorte de imagem, manual de regras |

O fluxo completo também foi exercitado num navegador real contra o Supabase: visitante, login
inválido, sessão em cookie, escrita, redirecionamentos por perfil, logout, organizador, admin,
cadastro com foto, inscrição, inscrição duplicada recusada e publicação com imagem no Storage.

---

## 11. Mapa de arquivos

```
docs/
  README.md                        índice da documentação
  regras-de-negocio.md, fluxos.md  regras por área e fluxos ponta a ponta
  api/                             uma página por API (entrada, regras, erros, exemplo)
.github/workflows/
  check.yml                        PR: carimbos únicos, simulação do db push, testes pgTAP
  deploy.yml                       main: aplica migrations e publica Edge Functions
supabase/
  config.toml                      configuração do projeto (Auth: site_url e redirects)
  migrations/                      esquema versionado (aplicado pelo deploy)
  functions/stripe-webhook/        Edge Function: confere a assinatura do Stripe e repassa ao site
  tests/                           testes pgTAP do banco
src/routes/api.stripe.webhook.ts   POST /api/stripe/webhook (eventos do Stripe)
src/server/
  pagamentos.server.ts, stripe.server.ts   Stripe Checkout, reembolsos, Connect
  documentos.server.ts, anexosSuporte.server.ts   bucket privado: notas fiscais e anexos
scripts/
  seed.ts                          bun run db:seed [-- --limpar-contas]
  assets-hook.mjs, registrar-assets.mjs   imagens importadas pela seed viram data URLs
src/api/                           server functions + wrappers do navegador
src/server/
  supabase.server.ts               clientes admin (chave secreta) e de sessão (cookies)
  unidade.server.ts                unidade de trabalho, leitura, consulta, retries
  auth.server.ts                   login, cadastro, logout, recuperação
  analytics.server.ts              métricas append-only
  midia.ts                         data URL → Storage
  semeadura.ts                     seed/restauração (Auth + tabelas + métricas)
src/lib/persistencia.ts            mapeamento e diff BaseDados ↔ tabelas
src/lib/visao.ts                   recorte da base por perfil
src/services/conta.ts              operações da conta que antes ficavam nas páginas
src/data/seedAnalytics.ts, termos.ts
.env.example
```
