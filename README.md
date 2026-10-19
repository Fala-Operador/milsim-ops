# MilSim Ops

Aplicação web responsiva (pt-BR) para divulgação e gestão de eventos de simulação militar
(airsoft / milsim): descoberta de operações, inscrição, ingressos com QR Code, comunidade por
evento, painel do organizador e administração da plataforma.

**Monólito TanStack Start + Supabase.** As páginas e as APIs (server functions) vivem no mesmo
app. O Supabase fornece Postgres, Auth e Storage, e o navegador **nunca** acessa o banco
diretamente: toda leitura e escrita passa pelas server functions, que autenticam a pessoa e
aplicam as regras de negócio. A venda de ingressos usa o **Stripe Checkout** quando
`STRIPE_SECRET_KEY` está configurada (sem ela, a inscrição é confirmada sem cobrança). Mensagens
externas (e-mail, WhatsApp) continuam simuladas.

> Projeto conectado ao [Lovable](https://lovable.dev): commits na branch `main` sincronizam com o
> editor. Não reescreva histórico já publicado (force push, rebase, amend). Veja `AGENTS.md`.

## Stack

- **TanStack Start** (React 19 + SSR) com roteamento por arquivos (`src/routes/`) e server functions (`src/api/`)
- **Supabase**: Postgres (tabelas com RLS, acesso só pelo servidor), Auth (sessão em cookies via `@supabase/ssr`) e Storage (bucket `midia`)
- **Vite 8** via `@lovable.dev/vite-tanstack-config` (build com Nitro, alvo Cloudflare)
- **Tailwind CSS 4**, `lucide-react`, `recharts`; **Vitest** + Testing Library
- Apoio: `qrcode` / `jsqr` (check-in), `jspdf` (relatórios), `zod` (validação das APIs), `ai` (insights)

## Execução

```bash
bun install
cp .env.example .env.local   # preencha as chaves do Supabase
bun run dev                  # http://localhost:8080
bun run test                 # 104 testes (regras, persistência, visão por perfil)
bun run typecheck
bun run build
```

### Variáveis de ambiente

| Variável | Uso |
|---|---|
| `SUPABASE_URL` | URL do projeto |
| `SUPABASE_PUBLISHABLE_KEY` | chave publicável; o servidor a usa para a sessão do Supabase Auth |
| `SUPABASE_SECRET_KEY` | chave secreta, **somente servidor** (acesso ao banco, Storage e Auth admin) |
| `SUPABASE_DB_PASSWORD` | só para `supabase link` / `db push` |
| `LOVABLE_API_KEY` | opcional, habilita Admin › Insights IA |

Na publicação (Lovable/Cloudflare), configure as três primeiras como **segredos** do ambiente.

### Banco de dados

O projeto Supabase de desenvolvimento é `milsim-ops` (ref `fezrmoyjsffufdjptamp`, região São Paulo).

```bash
npx supabase link --project-ref <ref>           # uma vez
bun run db:push                                 # aplica supabase/migrations
bun run db:seed                                 # grava a base demonstrativa (substitui as tabelas)
bun run db:seed -- --limpar-contas              # idem, removendo também as contas criadas fora da seed
```

#### Deploy automático (GitHub Actions)

- `.github/workflows/check.yml` roda em todo PR que mexe em `supabase/`: rejeita carimbos de data
  repetidos, simula o `db push` contra o projeto (mostra o que o merge vai aplicar) e roda os
  testes pgTAP de `supabase/tests/` num banco local criado do zero.
- `.github/workflows/deploy.yml` roda a cada push no `main` que mexe em `supabase/` (ou pela aba
  Actions): aplica as migrations novas e publica as Edge Functions.
- Segredos do repositório (Settings → Secrets and variables → Actions): `SUPABASE_ACCESS_TOKEN`
  (supabase.com/dashboard/account/tokens) e `SUPABASE_DB_PASSWORD`. Variável opcional
  `SUPABASE_PROJECT_REF` (padrão: `fezrmoyjsffufdjptamp`).
- Toda mudança de esquema é uma migration nova em `supabase/migrations/`, que precisa aplicar
  num banco vazio. Não altere o banco à mão: o histórico da CLI deixaria de bater.
- As migrations anteriores ao deploy automático foram aplicadas à mão (psql) e são idempotentes:
  o primeiro deploy as reaplica sem efeito. Migrations novas não precisam ser idempotentes.

## Contas criadas pela seed

| Perfil | Login | Senha |
|---|---|---|
| Administrador | `admin@admin` | `admin@123` |
| Participante | `usuario@teste.com.br` | `user@123` |
| Organizador aprovado | `organizador@teste.com.br` | `organizador@123` |

> **Atenção:** essas senhas são públicas (estão neste repositório). Antes de abrir o app para
> pessoas reais, troque a senha do admin e desative ou remova as contas de exemplo. A restauração
> da base existe só como script de desenvolvimento (`bun run db:seed`) e apaga todos os dados.

## Funcionalidades

| Área | Rotas | O que faz |
|---|---|---|
| Pública | `/`, `/eventos/$id`, `/inscricao/$id`, `/login`, `/cadastro`, `/recuperar-senha` | Página inicial com seções por região, busca por cidade, preferências de modalidade, página do evento, inscrição com lotes, cupons (validados no servidor) e cortesias, recuperação de senha por e-mail |
| Participante | `/app/*` | Ingressos com QR Code, comunidades, missões, notificações, suporte, perfil e solicitações de privacidade (LGPD) |
| Comunidade | `/comunidade/$eventoId/*` | Fóruns com feed social, imagens no Storage, curtidas, denúncias, moderação e gestão de fóruns |
| Organizador | `/organizacao/*`, `/app/organizador` | Eventos, inscritos, check-in (QR/manual/offline com sincronização), comunidade, financeiro simulado, métricas e campanhas |
| Admin | `/admin/*` | Dashboard, Insights IA, métricas consolidadas, divulgação, solicitações, usuários, privacidade e auditoria |

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): camadas, APIs, unidade de trabalho, visão por perfil, banco, segurança e mapa de arquivos
- [AGENTS.md](AGENTS.md): regras técnicas obrigatórias
- [roadmap.md](roadmap.md): status das entregas

## Limitações e próximos passos

- **Escala**: cada requisição carrega a base inteira (uma RPC) e a visão do usuário vai inteira
  ao navegador. Funciona bem no volume atual; para crescer, troque por consultas por página/agregado
  (ver `docs/ARQUITETURA.md`, seção 9).
- **Cadastro**: a conta é criada já com o e-mail confirmado. Em produção, exija confirmação.
- **E-mails do Auth**: o SMTP embutido do Supabase só entrega para membros da organização e tem
  limite baixo. Configure um SMTP próprio para a recuperação de senha funcionar para todos.
- **Pagamentos**: Stripe Checkout em BRL (cartão e os meios ativados no painel do Stripe), com
  reembolso integral automático no cancelamento. Com a conta Stripe Connect da organização ativa
  (Financeiro → Recebimentos), cada venda é repassada automaticamente a ela, descontada a taxa da
  plataforma (definida em Administração → Pagamentos); antes disso, o valor fica na plataforma.
  Os webhooks do Stripe chegam pela Edge Function `supabase/functions/stripe-webhook`, que confere
  a assinatura e repassa o evento à API do site.
- **Mensagens externas**: simuladas (sem e-mail transacional ou WhatsApp).
- **Storage**: arquivos substituídos ou removidos não são apagados do bucket (sem limpeza de órfãos).
- **LGPD**: retenção, exclusão e validação jurídica (incl. adolescentes de 15–17 anos) ainda pendentes.
