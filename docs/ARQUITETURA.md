# Arquitetura — MilSim Ops

Documento técnico para quem vai manter ou evoluir o sistema. Complementa o
[README](../README.md) (visão geral e execução) e o [AGENTS.md](../AGENTS.md) (regras
obrigatórias). Em caso de conflito, o `AGENTS.md` prevalece.

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
│ páginas (src/routes)     │ ─────────────▶ │ src/api/*.functions.ts  (zod, identidade) │ ──────▶ │ exportar_base │
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
   2. carrega a base inteira com a RPC `exportar_base` (uma ida ao banco) e a versão atual;
   3. identifica o usuário **ativo**; desativado = visitante;
   4. executa `fn` dentro de um `AsyncLocalStorage`, de modo que `carregarBase()`/`mutarBase()`
      dos serviços passam a apontar para a base desta requisição;
   5. envia ao Storage os data URLs base64 encontrados nos registros alterados
      (`src/server/midia.ts`) e os troca pela URL pública;
   6. calcula o lote mínimo de mudanças (`calcularMudancas`, em `src/lib/persistencia.ts`) e grava
      com a RPC `aplicar_mudancas(lote, versão)`, numa **única transação**;
   7. se outra escrita entrou no meio, a RPC falha com o código próprio `MS409` e o ciclo
      recomeça (até 4 vezes, com espera crescente e aleatória). **Nunca use `40001`** em
      funções chamadas pela API: o PostgREST repete transações com esse código sem limite,
      o que prende conexões do pool e derruba a API (ver
      `docs/migracoes/20261014193000_conflito_sem_retentativa.sql`);
   8. devolve `{ resultado, visão }`.
4. O wrapper (`chamar` em `src/api/cliente.ts`) aplica a visão nova ao snapshot do navegador, e as
   telas re-renderizam via `useVersaoBase()`.

O controle de concorrência é **otimista e global** (tabela `controle_base`): escritas são
serializadas, e regras como "vagas restantes" e "uma inscrição ativa" são verificadas sobre
dados atuais. O índice único parcial `inscricoes_uma_ativa_por_evento` reforça essa última
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
| Recuperar senha | `resetPasswordForEmail` com retorno para `/recuperar-senha`; a página troca o `code` por sessão (`exchangeCodeForSession`, PKCE) e define a nova senha (`updateUser`). |

- `usuarios.id` é o mesmo `id` de `auth.users`. Perfil, papel (`admin`/`organizador`/`participante`)
  e organização ficam na tabela `usuarios`, **nunca** em `user_metadata`.
- A identidade é sempre a da sessão. As APIs ignoram qualquer `usuarioId`/`perfil` vindo do navegador.
- Supabase Auth: `site_url` e URLs de retorno configurados para `http://localhost:8080`
  (`supabase/config.toml`). **Inclua a URL publicada** antes de usar a recuperação de senha em produção.

---

## 5. Banco de dados — `supabase/migrations/`

### 5.1 Modelo de acesso

- **RLS ativo em todas as tabelas, sem policies**: `anon` e `authenticated` não leem nem gravam
  nada (verificado: a chave publicável recebe `42501`).
- Privilégios só para `service_role`, usado pelo servidor com `SUPABASE_SECRET_KEY`.
- RPCs `exportar_base`, `aplicar_mudancas` e `tabelas_base`: `EXECUTE` só para `service_role`,
  `search_path` vazio, `SECURITY INVOKER`.
- Bucket `midia`: leitura pública por URL; upload só pelo servidor. Tipos permitidos: jpeg,
  png, webp, gif e pdf; tamanho máximo de 10 MB (PDF até 5 MB, validado no servidor).

### 5.2 Convenções

- Uma coluna por campo de primeiro nível dos tipos de `src/lib/domain/types.ts`, em snake_case;
  listas e objetos aninhados ficam em `jsonb` (exércitos, tipos, lotes, cronograma, regras,
  links, destaques...).
- Ids em texto gerados pela aplicação (prefixo + tempo + aleatório). A exceção é `usuarios.id`,
  que é `uuid`.
- Datas em `timestamptz`. O mapeador devolve no formato de `toISOString()`.
- Chaves estrangeiras `DEFERRABLE INITIALLY DEFERRED`, para que o lote seja aplicado em qualquer
  ordem. Filhos de `eventos` usam `on delete cascade`. `auditoria.autor_id` e
  `moderacao.autor_id` são texto livre, para a trilha sobreviver à remoção do alvo.
- Índices em todas as chaves estrangeiras.

### 5.3 Tabelas

| Grupo | Tabelas |
|---|---|
| Contas | `usuarios`, `organizacoes`, `solicitacoes` |
| Eventos e vendas | `eventos`, `inscricoes`, `cupons`, `cortesias`, `movimentacoes` |
| Engajamento | `missoes`, `entregas`, `comunicados`, `comentarios` |
| Suporte e governança | `chamados`, `notificacoes`, `auditoria`, `privacidade` |
| Comunidade | `foruns`, `publicacoes`, `respostas`, `curtidas`, `denuncias`, `preferencias_forum`, `restricoes_comunidade`, `moderacao`, `visitas_comunidade` |
| Divulgação | `parceiros`, `secoes_inicio` |
| Check-in | `checkins` (base de referência da portaria) |
| Métricas (fora da base transacional) | `analytics_registros` (append-only), `campanhas` |
| Controle | `controle_base` (versão global) |

### 5.4 Mudando o schema

1. `npx supabase migration new <nome>`; RLS ligado, sem policies, `grant` só para `service_role`.
2. Atualize o tipo em `src/lib/domain/types.ts`, `TABELAS` em `src/lib/persistencia.ts` e,
   se for uma tabela transacional nova, a lista em `tabelas_base()` (SQL).
3. Filtre a nova coleção em `visaoParaUsuario` e cubra com teste.
4. `bun run db:push` e `npx supabase db advisors --linked`.

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

O "perfil público" troca CPF, e-mail, telefone e endereço por vazios, e o nome completo pelo nome
de exibição. Os cupons nunca vão ao navegador: a prévia de desconto usa `previsualizarCupomFn`.

---

## 7. APIs — `src/api/*.functions.ts`

Cada arquivo exporta as server functions (`...Fn`) e wrappers de mesmo nome para o navegador.

| Arquivo | Operações |
|---|---|
| `sessao` | `obterVisao`, `obterEvento`, `entrar`, `sair`, `cadastrar`, `recuperarSenha`, `trocarCodigo`, `definirNovaSenha` |
| `inscricoes` | `confirmarInscricao` (sempre para si mesmo), `cancelarInscricao` (titular, organização ou admin), `previsualizarCupom` |
| `organizador` | `solicitarOrganizador`, `reenviarSolicitacao` (só o dono), `salvarEvento` (status e organização decididos pelo servidor), `publicarEvento` (cria os fóruns), `cancelarEvento`, `excluirEvento`, `criarCupom`, `criarCortesia` (só a gestão do evento) |
| `admin` | `analisarSolicitacao`, `desativarUsuario`, `aprovarAutorizacao`, `responderPrivacidade` |
| `comunidade` | publicações, respostas, curtidas, denúncias, moderação, fóruns, preferências, nome de exibição, `garantirForuns`, `registrarVisita` |
| `divulgacao` | seções e parceiros da página inicial (somente admin, auditado) |
| `conta` | missões, privacidade, suporte, notificações (lidas), silêncio, tema, preferências de modalidade |
| `checkin` | `sincronizarCheckins` (aceite da fila da portaria) |
| `analytics` | `registrarAnalytics` (lote ≤ 50, sem login), `listarAnalytics` (organização/admin), `criarCampanha` |

Todas as server functions passam pelo middleware de CSRF de `src/start.ts`.

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
  de `mutar`** (que pode repetir a função). Com `STRIPE_SECRET_KEY` configurada, inscrição com
  valor a pagar nasce `pendente` com `pagamento.status = "aguardando"` e reserva a vaga (e o uso
  do cupom/benefício) por 32 min, o mesmo prazo da Checkout Session. Confirmam a inscrição o
  webhook `POST /api/stripe/webhook` (`routes/api.stripe.webhook.ts`) e o retorno do checkout
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
  `contaDestino` e `taxaCentavos` (`STRIPE_TAXA_PLATAFORMA_PERCENTUAL`); o checkout vira cobrança
  com destino (`transfer_data.destination` + `application_fee_amount`). Sem conta ativa, o valor
  fica na plataforma e aparece no financeiro como "repasse à parte". O reembolso de venda
  repassada usa `reverse_transfer` e `refund_application_fee`.
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

---

## 9. Limites conhecidos e evolução

| Ponto | Situação atual | Como evoluir |
|---|---|---|
| Carga por requisição | toda server function carrega a base inteira (1 RPC, ~200–400 ms em dev) | consultas por agregado (evento, comunidade) e RPCs específicas para operações críticas |
| Visão no navegador | o recorte do usuário vai inteiro a cada resposta; admin recebe tudo | APIs de leitura por página, com paginação |
| Concorrência | versão global: escritas simultâneas viram nova tentativa | travas por evento (`select … for update`) dentro de RPCs |
| SSR | as páginas renderizam o esqueleto no servidor (só o `head` do evento usa dados reais) | carregadores por rota com `consultar()` |
| Storage | sem limpeza de arquivos órfãos; a seed reenvia as imagens a cada execução | caminhos determinísticos + rotina de limpeza |
| E-mail | SMTP embutido do Supabase (limitado) | SMTP próprio e confirmação de e-mail no cadastro |

---

## 10. Testes

`bun run test`: 16 arquivos, 104 testes.

| Arquivo | Cobre |
|---|---|
| `regras.test.ts`, `comunidade.test.ts`, `divulgacao.test.ts`, `checkin.test.ts`, `modalidades.test.ts`, ... | regras de negócio (base em memória) |
| `persistencia.test.ts` | camelCase↔snake_case, timestamps, ida e volta da base inteira, diff mínimo, chave composta |
| `visao.test.ts` | o que cada perfil recebe (sem CPF/e-mail para visitantes, cupons isolados por organização, inscrições anônimas...) |
| `conta-checkin.test.ts` | regras que passaram ao servidor: suporte, privacidade, notificações, token na inscrição, aceite da fila do check-in |

O fluxo completo também foi exercitado num navegador real contra o Supabase: visitante, login
inválido, sessão em cookie, escrita, redirecionamentos por perfil, logout, organizador, admin,
cadastro com foto, inscrição, inscrição duplicada recusada e publicação com imagem no Storage.

---

## 11. Mapa de arquivos novos

```
supabase/
  config.toml                      configuração do projeto (Auth: site_url e redirects)
  migrations/…_esquema_inicial.sql tabelas, RLS, grants, RPCs, bucket
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
