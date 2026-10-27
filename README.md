# MilSim Ops

Aplicação web responsiva (pt-BR) para divulgação e gestão de eventos de simulação militar
(airsoft / milsim): descoberta de operações, inscrição, ingressos com QR Code, comunidade por
evento, painel do organizador e administração da plataforma.

**Monólito TanStack Start + Supabase.** As páginas e as APIs (server functions) vivem no mesmo
app. O Supabase fornece Postgres, Auth e Storage, e o navegador **nunca** acessa o banco
diretamente: toda leitura e escrita passa pelas server functions, que autenticam a pessoa e
aplicam as regras de negócio. A venda de ingressos usa o **Stripe Checkout** quando
`STRIPE_SERVER_API_KEY` está configurada (sem ela, a inscrição é confirmada sem cobrança), com repasse
automático às organizações pelo **Stripe Connect**. Não há envio automático de e-mail ou WhatsApp:
os avisos ficam nas notificações do app.

**Documentação:** [regras de negócio](docs/regras-de-negocio.md) · [fluxos](docs/fluxos.md) ·
[APIs com exemplos](docs/api/README.md) · [arquitetura](docs/ARQUITETURA.md) · [índice](docs/README.md)

> Projeto conectado ao [Lovable](https://lovable.dev): commits na branch `main` sincronizam com o
> editor. Não reescreva histórico já publicado (force push, rebase, amend). Veja `AGENTS.md`.

## Stack

- **TanStack Start** (React 19 + SSR) com roteamento por arquivos (`src/routes/`) e server functions (`src/api/`)
- **Supabase**: Postgres (tabelas com RLS, acesso só pelo servidor), Auth (sessão em cookies via `@supabase/ssr`) e Storage (bucket `midia`)
- **Vite 8** via `@lovable.dev/vite-tanstack-config` (build com Nitro: servidor Node em `.output/`; dentro do Lovable o alvo continua Cloudflare)
- **Stripe** (Checkout, reembolsos e Connect Express) por `fetch`, sem SDK; webhooks pela Edge Function `supabase/functions/milsim-stripe-webhook`
- **Tailwind CSS 4**, `lucide-react`, `recharts`; **Vitest** + Testing Library
- Apoio: `qrcode` / `jsqr` (check-in), `jspdf` (relatórios), `zod` (validação das APIs)

## Execução

```bash
bun install
cp .env.example .env.local   # preencha as chaves do Supabase
bun run dev                  # http://localhost:8080
bun run test                 # 306 testes (regras, pagamentos, persistência, visão por perfil)
bun run typecheck
bun run build
bun run start                # servidor Node gerado pelo build (.output/server/index.mjs)
```

### Variáveis de ambiente

| Variável | Uso |
|---|---|
| `SUPABASE_URL` | URL do projeto |
| `SUPABASE_PUBLISHABLE_KEY` | chave publicável; o servidor a usa para a sessão do Supabase Auth |
| `SUPABASE_SECRET_KEY` | chave secreta (`sb_secret_…` ou a legada `service_role`), **somente servidor** (acesso ao banco, Storage e Auth admin). Com a chave publicável aqui o banco nega tudo ("permission denied for function export_base"); o servidor agora avisa isso no log |
| `SUPABASE_DB_PASSWORD` | só para `supabase link` / `db push` |
| `PERSONAL_DATA_ENCRYPTION_KEY` | **obrigatória, somente servidor**: chave (32 bytes em base64, `openssl rand -base64 32`) que cifra os dados pessoais no banco (CPF, nascimento, e-mail, WhatsApp, endereço, ficha de emergência, CNPJ/telefone, convidados). Mesmo valor em todo servidor que usa o mesmo banco (Lovable e Dokploy); outro valor por ambiente (prod ≠ hml). **Perder a chave = perder esses dados**: guarde uma cópia fora do servidor. Sem ela o site lê, mas não grava dado pessoal |
| `PERSONAL_DATA_ENCRYPTION_PREVIOUS_KEYS` | só na rotação: chaves antigas (separadas por vírgula), ainda aceitas para decifrar; o servidor regrava tudo com a chave atual e a antiga pode sair depois |
| `STRIPE_SERVER_API_KEY` | opcional, **somente servidor**: liga a venda pelo Stripe Checkout e o Stripe Connect (sem ela, inscrição confirmada sem cobrança) |
| `STRIPE_WEBHOOK_FORWARD_SECRET` | segredo compartilhado entre a Edge Function `milsim-stripe-webhook` e o site (mesmo valor nos dois lados) |
| `STRIPE_BROWSER_PUBLIC_KEY` | opcional (`pk_...`): o cadastro e a gestão do recebimento da organização acontecem dentro do site (componentes embutidos do Stripe) |
| `TURNSTILE_SITE_KEY` | chave pública (site key) do Cloudflare Turnstile, mostrado no login, cadastro e pedido de redefinição de senha. A chave secreta fica só no Supabase (Authentication → Attack Protection → CAPTCHA). Com o CAPTCHA ligado no Supabase, sem esta variável ninguém entra |

Na publicação, configure as variáveis do Supabase (e as do Stripe, se usar) como **segredos** do
ambiente. Os segredos `whsec_…` do Stripe ficam só no Supabase (Edge Functions → Secrets), junto
com `STRIPE_WEBHOOK_FORWARD_URL`; veja [a página do webhook](docs/api/webhooks/stripe-webhook-edge.md).
#### Nomes das variáveis do Stripe (renomeadas em 19/10/2026)

Os nomes antigos ainda funcionam, como reserva: cadastre os novos e, depois de conferir, apague
os antigos. Todas precisam ser do mesmo ambiente do Stripe (mesma conta e mesmo modo).

| Nome novo | Nome antigo | Onde cadastrar | O que faz |
|---|---|---|---|
| `STRIPE_SERVER_API_KEY` | `STRIPE_SECRET_KEY` | site | chave secreta (`sk_…`) com que o servidor chama a API do Stripe |
| `STRIPE_BROWSER_PUBLIC_KEY` | `STRIPE_PUBLISHABLE_KEY` | site | chave publicável (`pk_…`) dos painéis embutidos em Financeiro |
| `STRIPE_WEBHOOK_FORWARD_SECRET` | `MILSIM_WEBHOOK_SECRET` | site **e** Edge Function | senha com que a Edge Function assina o evento repassado ao site |
| `STRIPE_WEBHOOK_FORWARD_URL` | `MILSIM_WEBHOOK_URL` | Edge Function | endereço do site que recebe o repasse (`https://<site>/api/stripe/webhook`) |
| `STRIPE_PAYMENTS_WEBHOOK_SIGNING_SECRET` | — (`STRIPE_WEBHOOK_SECRET` é do Stripe Sync) | Edge Function | `whsec_…` do endpoint de eventos da conta (pagamentos) |
| `STRIPE_CONNECT_WEBHOOK_SIGNING_SECRET` | `STRIPE_CONNECT_WEBHOOK_SECRET` | Edge Function | `whsec_…` do endpoint de eventos das contas conectadas (Connect) |

O Supabase Auth precisa da URL publicada nas URLs de retorno, e um SMTP próprio para a
recuperação de senha chegar a qualquer e-mail.

### Banco de dados

O projeto Supabase de desenvolvimento é `milsim-ops` (ref `fezrmoyjsffufdjptamp`, região São Paulo).

```bash
npx supabase link --project-ref <ref>           # uma vez
bun run db:push                                 # aplica supabase/migrations
bun run db:seed                                 # grava a base demonstrativa (substitui as tabelas)
bun run db:seed -- --limpar-contas              # idem, removendo também as contas criadas fora da seed
```

Para zerar os dados de teste mantendo contas, organizações, configurações e as vendas pagas
pelo Stripe, rode a ação manual **Reset do banco** (digite `RESETAR`). Ela guarda antes um
backup completo como artefato da execução (30 dias). Detalhes em
`supabase/scripts/reset_mantendo_contas_e_vendas_stripe.sql`.

A migration `20261020150000_reset_dados_de_usuarios.sql` apaga, uma única vez no deploy, tudo
que os usuários geraram (eventos com inscrições e vendas, fóruns, comunidade, suporte, missões,
operações externas, notificações, conquistas e vouchers), mantendo contas, perfis,
organizações com a conta Stripe e a configuração do site. Ela recusa rodar se houver venda
Stripe em modo live.

#### Deploy automático (GitHub Actions)

- Dois ambientes, cada um com o seu projeto Supabase: **produção** (branch `main`, ambiente
  `production` do GitHub, projeto `fezrmoyjsffufdjptamp`) e **homologação** (branch `hml`, ambiente
  `homologacao`).
- `.github/workflows/check.yml` roda em todo PR que mexe em `supabase/`: rejeita carimbos de data
  repetidos, simula o `db push` contra o projeto do branch de destino (PR para o `main` → produção,
  para o `hml` → homologação) e roda os testes pgTAP de `supabase/tests/` num banco local criado do zero.
- `.github/workflows/deploy.yml` roda a cada push no `main` ou no `hml` que mexe em `supabase/` (ou
  pela aba Actions, a partir de um dos dois): aplica as migrations novas e publica as Edge Functions
  no projeto daquele ambiente.
- `.github/workflows/reset-banco.yml` (manual) pergunta qual banco resetar; o padrão é homologação.
- Segredos por ambiente (Settings → Environments → `production` / `homologacao`):
  `SUPABASE_ACCESS_TOKEN` (supabase.com/dashboard/account/tokens) e `SUPABASE_DB_PASSWORD`, mais a
  variável `SUPABASE_PROJECT_REF`. Em `production`, sem eles valem os segredos do repositório e o
  projeto `fezrmoyjsffufdjptamp`; em `homologacao` a ref é obrigatória e o workflow para se ela for
  a de produção (`.github/scripts/conferir-ambiente.sh`). Os segredos das Edge Functions (Stripe)
  são configurados no painel de cada projeto Supabase.
- Toda mudança de esquema é uma migration nova em `supabase/migrations/`, que precisa aplicar
  num banco vazio e ter data **posterior** à última aplicada. Não altere o banco à mão
  (`db query -f`, psql): a migration fica fora do histórico da CLI e o `db push` do deploy passa a
  recusar tudo. Se aplicar uma migration localmente com `db push`, envie o arquivo ao branch daquele ambiente em seguida.
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
>
> No projeto `milsim-ops` a base foi limpa em 19/10/2026: das contas acima, só o admin existe.
> As contas de participante e organizador de exemplo voltam apenas se a seed for rodada de novo.

## Funcionalidades

| Área | Rotas | O que faz |
|---|---|---|
| Pública | `/`, `/eventos/$id`, `/inscricao/$id`, `/operador/$id`, `/login`, `/cadastro`, `/recuperar-senha` | Página inicial com seções por região e campanhas de destaque, busca por cidade, preferências de modalidade, página do evento (com "Falar com o organizador no WhatsApp"), inscrição com lotes, cupons (validados no servidor), cortesias e pagamento pelo Stripe, perfil público do operador |
| Participante | `/app/*` | Ingressos com QR Code, missões pré-evento com placar, pagamento pendente ("Concluir pagamento"), grupo do WhatsApp do evento, comunidades, missões, notificações, Central de Suporte, perfil do operador (arsenal, galeria, notas fiscais privadas, insígnias e recompensas) e privacidade (LGPD) |
| Comunidade | `/comunidade/$eventoId/*` | Fóruns com feed social, imagens no Storage, curtidas, denúncias, moderação e gestão de fóruns |
| Organizador | `/organizacao/*`, `/app/organizador` | Eventos (editor em etapas, contato no WhatsApp), missões pré-evento (avaliação, placar por exército, prêmios no check-in, temporada), inscritos, check-in (QR/manual/offline com sincronização), comunidade, financeiro (resumo, movimentações com abas e filtros, recebimentos pelo Stripe Connect), cupons e cortesias, métricas e campanhas, recompensas, suporte encaminhado |
| Admin | `/admin/*` | Dashboard, métricas, divulgação e impulsionamento, solicitações, usuários, pagamentos (taxa da plataforma), gamificação, Central de Suporte (triagem), privacidade e auditoria |

## Documentação

- [docs/README.md](docs/README.md): índice da documentação
- [docs/regras-de-negocio.md](docs/regras-de-negocio.md): o que o sistema decide em cada área, e as lacunas conhecidas
- [docs/fluxos.md](docs/fluxos.md): fluxos ponta a ponta com diagramas (inscrição com Stripe, check-in, suporte, repasse…)
- [docs/api/](docs/api/README.md): uma página por API (116 server functions + webhook do Stripe), com entrada, regras, erros e exemplo
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): camadas, unidade de trabalho, visão por perfil, banco, deploy, segurança e mapa de arquivos
- [AGENTS.md](AGENTS.md): regras técnicas obrigatórias
- [roadmap.md](roadmap.md): status das entregas

## Limitações e próximos passos

- **Escala**: cada requisição carrega a base inteira (uma RPC) e a visão do usuário vai inteira
  ao navegador. Funciona bem no volume atual; para crescer, troque por consultas por página/agregado
  (ver `docs/ARQUITETURA.md`, seção 9).
- **Cadastro**: a conta é criada já com o e-mail confirmado. Em produção, exija confirmação.
- **E-mails do Auth**: enviados pelo **Resend** (`nao-responda@milsimops.falaoperador.com.br`,
  DKIM e SPF no Cloudflare), até 30 por hora. A chave `RESEND_API_KEY` fica só no `.env` local e é
  enviada ao Supabase com `env $(grep '^RESEND_API_KEY=' .env | xargs) npx supabase config push`.
- **Pagamentos**: Stripe Checkout em BRL (cartão e os meios ativados no painel do Stripe), com
  reembolso integral automático no cancelamento. Com a conta Stripe Connect da organização ativa
  (Financeiro → Recebimentos), cada venda é repassada automaticamente a ela, descontada a taxa da
  plataforma (definida em Administração → Pagamentos); antes disso, o valor fica na plataforma.
  Os webhooks do Stripe chegam pela Edge Function `supabase/functions/milsim-stripe-webhook`, que confere
  a assinatura e repassa o evento à API do site (lista de eventos no cabeçalho da função).
  Com a conta ativa, Financeiro mostra saldo, próximos saques e banco lidos do Stripe e, com
  `STRIPE_BROWSER_PUBLIC_KEY`, o cadastro da conta, os avisos, os dados bancários, os saques e os
  pagamentos ficam embutidos no site. Se o site ganhar uma CSP, libere
  `https://connect-js.stripe.com` e `https://js.stripe.com` em `script-src` e `frame-src`.
  Contestações (chargebacks) ficam registradas no pagamento e aparecem em Financeiro.
- **Mensagens externas**: sem e-mail transacional nem WhatsApp automático (o WhatsApp do evento
  é só um link para o organizador e o grupo).
- **Fim do evento**: nenhuma tela marca o evento como concluído, e "participou", insígnias e
  recompensas dependem disso. Ver [lacunas](docs/regras-de-negocio.md#19-lacunas-conhecidas).
- **Storage**: arquivos substituídos ou removidos não são apagados do bucket (sem limpeza de órfãos).
- **LGPD**: retenção, exclusão e validação jurídica (incl. adolescentes de 15–17 anos) ainda pendentes.
