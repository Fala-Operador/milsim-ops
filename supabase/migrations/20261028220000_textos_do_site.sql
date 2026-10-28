-- Textos fixos do site em português e inglês (i18n). Cada linha é uma chave num idioma;
-- o servidor lê tudo com a chave secreta e entrega à página o idioma escolhido.
-- Editar um texto: update public.site_texts set value = '...' where key = '...' and locale = 'en';
-- (o site relê a tabela em até 1 minuto). Chave nova: insira os dois idiomas.
-- Marcação aceita no valor: parágrafos separados por linha em branco, linhas "- " (lista),
-- **negrito**, `código`, [rótulo](/caminho ou https://...) e blocos especiais como [[contato]].
begin;

create table if not exists public.site_texts (
  key text not null check (key ~ '^[a-z0-9_.-]+$'),
  locale text not null check (locale in ('pt', 'en')),
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (key, locale)
);

-- Mesmo padrão das outras tabelas: só o servidor lê (RLS sem policies, nenhum grant).
alter table public.site_texts enable row level security;
revoke all on public.site_texts from anon, authenticated;

-- Realtime: toda tabela de public fica na publicação supabase_realtime.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not (select puballtables from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables p
                      where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = 'site_texts') then
    alter publication supabase_realtime add table public.site_texts;
  end if;
end $$;

-- Textos iniciais. Não sobrescreve o que já foi editado no banco.
insert into public.site_texts (key, locale, value) values
  ('privacidade.c.quem-somos.titulo', 'pt', 'Quem somos'),
  ('privacidade.c.quem-somos.titulo', 'en', 'Who we are'),
  ('privacidade.c.quem-somos.texto', 'pt', 'O MilSim Ops (milsimops.falaoperador.com.br) é uma plataforma de divulgação e gestão de eventos de airsoft e simulação militar: agenda de operações, inscrição e pagamento de ingressos, check-in por QR code, comunidades dos eventos e perfil do operador. A plataforma é operada pela Fala Operador, que é a **controladora** dos dados pessoais tratados nela (LGPD, art. 5º, VI).

Cada evento é conduzido pela organização indicada na página dele. Ela recebe os dados dos seus inscritos, conforme a cláusula “Compartilhamento”, e responde pelo uso que fizer deles fora da plataforma.

[[contato]]'),
  ('privacidade.c.quem-somos.texto', 'en', 'MilSim Ops (milsimops.falaoperador.com.br) is a platform for promoting and managing airsoft and military simulation events: an operations calendar, event registration and ticket payment, QR code check-in, event communities and the operator profile. The platform is operated by Fala Operador, the **controller** of the personal data processed on it (Brazilian General Data Protection Law – LGPD, art. 5, VI).

Each event is run by the organization shown on its page. The organization receives the data of its registrants, as described in the “Sharing” section, and is responsible for any use it makes of that data outside the platform.

[[contato]]'),
  ('privacidade.c.resumo.titulo', 'pt', 'Resumo'),
  ('privacidade.c.resumo.titulo', 'en', 'Summary'),
  ('privacidade.c.resumo.texto', 'pt', '- Coletamos os dados necessários para criar a sua conta, inscrever você em eventos, receber pagamentos e manter a comunidade segura.
- **Não vendemos dados pessoais**, não usamos seus dados para publicidade de terceiros e não usamos dados do Google para nada além do login.
- CPF, e-mail, telefone e endereço **nunca** aparecem em páginas públicas nem nas comunidades.
- Os dados pessoais mais sensíveis ficam **cifrados** no banco de dados.
- Você pode pedir acesso, correção, exportação e exclusão dos seus dados a qualquer momento.'),
  ('privacidade.c.resumo.texto', 'en', '- We collect the data needed to create your account, register you for events, receive payments and keep the community safe.
- **We do not sell personal data**, we do not use your data for third-party advertising and we do not use Google data for anything other than signing in.
- Your CPF (Brazilian taxpayer ID), email, phone and address **never** appear on public pages or in communities.
- The most sensitive personal data is **encrypted** in our database.
- You can request access to, correction, export and deletion of your data at any time.'),
  ('privacidade.c.dados-coletados.titulo', 'pt', 'Dados que coletamos'),
  ('privacidade.c.dados-coletados.titulo', 'en', 'Data we collect'),
  ('privacidade.c.dados-coletados.texto', 'pt', '**Dados que você informa:**

- **Conta:** e-mail e senha. A senha fica só no serviço de autenticação, guardada de forma irreversível (hash), e nunca junto aos seus outros dados.
- **Perfil de operador:** nome completo, CPF, data de nascimento, WhatsApp e endereço (CEP, logradouro, número, complemento, bairro, cidade e estado). Opcionais: foto, nome de exibição, Instagram e squad.
- **Ficha de emergência (opcional, dado de saúde):** tipo sanguíneo, alergias e um contato de emergência.
- **Preferências:** modalidades favoritas, tema claro ou escuro, privacidade do perfil, notificações silenciadas e autorização (ou não) para comunicações promocionais.
- **Organizações:** nome, CNPJ (se houver) e telefone de quem pede para organizar eventos, e os dados da conta de recebimento, informados diretamente ao Stripe.
- **Conteúdo:** publicações, respostas, fotos e denúncias nas comunidades; mensagens e anexos no suporte; operações registradas no perfil; entregas de missões; notas fiscais de equipamentos que você guardar no perfil.

**Dados gerados pelo uso:**

- **Inscrições e pagamentos:** eventos em que você se inscreveu, tipo de ingresso, exército, cupom usado, situação e valor do pagamento, reembolsos e identificadores da transação no Stripe. **Nunca recebemos dados de cartão.**
- **Participação:** check-ins, presença, insígnias, recompensas e pontos de missões.
- **Registros de segurança:** endereço IP, data e hora de acesso e dados técnicos do navegador, guardados pelos nossos provedores de hospedagem e autenticação.
- **Métricas de uso:** visitas e cliques contados com identificadores aleatórios, sem nome, e-mail, CPF, telefone ou endereço.

**Localização aproximada (opcional):** se você permitir, o navegador informa a sua posição só para descobrirmos a cidade e mostrarmos eventos próximos. As coordenadas são arredondadas (cerca de 1 km) antes de consultar o serviço de mapas e **nunca são gravadas**; fica guardada apenas a cidade escolhida, no seu próprio navegador.'),
  ('privacidade.c.dados-coletados.texto', 'en', '**Data you provide:**

- **Account:** email and password. The password is kept only by the authentication service, stored irreversibly (hashed), and never alongside your other data.
- **Operator profile:** full name, CPF, date of birth, WhatsApp number and address (postal code, street, number, complement, neighborhood, city and state). Optional: photo, display name, Instagram and squad.
- **Emergency record (optional, health data):** blood type, allergies and an emergency contact.
- **Preferences:** favorite game modes, light or dark theme, profile privacy, muted notifications and consent (or not) to promotional messages.
- **Organizations:** name, CNPJ (Brazilian company ID, if any) and phone number of those who apply to organize events, and payout account details, provided directly to Stripe.
- **Content:** posts, replies, photos and reports in communities; support messages and attachments; operations recorded on your profile; mission submissions; equipment invoices you keep on your profile.

**Data generated by use:**

- **Registrations and payments:** events you registered for, ticket type, team, coupon used, payment status and amount, refunds and Stripe transaction identifiers. **We never receive card details.**
- **Participation:** check-ins, attendance, badges, rewards and mission points.
- **Security logs:** IP address, access date and time and technical browser data, kept by our hosting and authentication providers.
- **Usage metrics:** visits and clicks counted with random identifiers, without name, email, CPF, phone or address.

**Approximate location (optional):** if you allow it, your browser shares your position only so we can find your city and show nearby events. Coordinates are rounded (about 1 km) before querying the map service and are **never stored**; only the chosen city is kept, in your own browser.'),
  ('privacidade.c.google.titulo', 'pt', 'Dados do usuário do Google (Entrar com o Google)'),
  ('privacidade.c.google.titulo', 'en', 'Google user data (Sign in with Google)'),
  ('privacidade.c.google.texto', 'pt', 'Se você escolher “Entrar com o Google”, o Google nos envia, com a sua autorização, somente os dados básicos da sua conta Google (escopos `openid`, `email` e `profile`): **nome, endereço de e-mail e foto de perfil**, além de um identificador da conta. Não pedimos acesso a Gmail, Drive, contatos, agenda nem a qualquer outro dado do Google.

**Como usamos:** apenas para criar a sua conta, identificar você nos próximos logins e preencher o seu nome no cadastro. O e-mail do Google passa a ser o e-mail da sua conta e, se ele já tiver uma conta confirmada aqui, o login com o Google é vinculado a ela. A foto do Google fica registrada no serviço de autenticação e não é publicada.

**O que não fazemos:** não usamos dados do Google para publicidade, não os vendemos, não os compartilhamos com organizações de eventos nem com outros terceiros além dos provedores que hospedam a plataforma, e não os usamos para treinar modelos de inteligência artificial.

O uso e a transferência, para qualquer outro aplicativo, de informações recebidas das APIs do Google pelo MilSim Ops seguem a [Política de Dados do Usuário dos Serviços de API do Google](https://developers.google.com/terms/api-services-user-data-policy) (Google API Services User Data Policy), incluindo os requisitos de Uso Limitado (Limited Use).

**Com quem compartilhamos:** os dados do Google ficam só no Supabase, que hospeda o serviço de autenticação e o banco de dados da plataforma. Não são repassados a organizações de eventos, anunciantes, corretores de dados nem qualquer outro terceiro.

**Como protegemos:** o login usa OAuth 2.0 com PKCE pelo servidor; não recebemos nem guardamos a sua senha do Google nem tokens de acesso às APIs do Google. No perfil da plataforma, o nome e o e-mail ficam cifrados (AES-256-GCM); a cópia que o serviço de autenticação usa para o login fica no Supabase, com acesso restrito ao servidor da plataforma. Todo o tráfego usa HTTPS.

**Por quanto tempo guardamos:** enquanto a sua conta existir. Se você desistir do cadastro com o Google antes de concluí-lo, a conta criada é apagada na hora; se pedir a exclusão da conta, os dados recebidos do Google são apagados junto.

**Como remover:** você pode tirar o acesso do MilSim Ops à sua conta Google a qualquer momento em [myaccount.google.com/permissions](https://myaccount.google.com/permissions). Os dados recebidos do Google são apagados junto com a sua conta (cláusula “Exclusão da conta”).'),
  ('privacidade.c.google.texto', 'en', 'If you choose “Sign in with Google”, Google sends us, with your authorization, only the basic data of your Google account (scopes `openid`, `email` and `profile`): **name, email address and profile picture**, plus an account identifier. We do not request access to Gmail, Drive, Contacts, Calendar or any other Google data.

**How we use it:** only to create your account, identify you on later sign-ins and prefill your name during registration. Your Google email becomes your account email and, if it already belongs to a confirmed account here, Google sign-in is linked to that account. Your Google profile picture is kept by the authentication service and is not published.

**What we do not do:** we do not use Google user data for advertising, we do not sell it, we do not share it with event organizers or any other third party other than the providers that host the platform, and we do not use it to train artificial intelligence or machine-learning models.

MilSim Ops’ use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

**Who we share it with:** Google user data is stored only with Supabase, which hosts the platform’s authentication service and database. It is not passed on to event organizers, advertisers, data brokers or any other third party.

**How we protect it:** sign-in uses OAuth 2.0 with PKCE handled by our server; we never receive or store your Google password or Google API access tokens. In the platform profile, your name and email are encrypted (AES-256-GCM); the copy the authentication service uses for sign-in is kept at Supabase, with access restricted to the platform’s server. All traffic uses HTTPS.

**How long we keep it:** while your account exists. If you abandon Google registration before completing it, the account created is deleted immediately; if you request account deletion, the data received from Google is deleted with it.

**How to remove it:** you can revoke MilSim Ops’ access to your Google account at any time at [myaccount.google.com/permissions](https://myaccount.google.com/permissions). Data received from Google is deleted together with your account (see “Account deletion”).'),
  ('privacidade.c.finalidade.titulo', 'pt', 'Para que usamos e com qual base legal'),
  ('privacidade.c.finalidade.titulo', 'en', 'Why we use your data and on what legal basis'),
  ('privacidade.c.finalidade.texto', 'pt', 'Cada uso tem uma base legal da LGPD (arts. 7º e 11):

- **Criar e manter a sua conta, inscrever você em eventos, emitir o ingresso com QR code, fazer o check-in e prestar suporte**: execução do contrato que você aceita nos [Termos de uso](/termos) (art. 7º, V).
- **CPF e data de nascimento**: identificar cada participante com uma conta única, verificar a idade mínima e exigir a autorização do responsável para menores (art. 7º, V, e art. 14).
- **Endereço e WhatsApp**: logística e comunicação do evento pela organização (art. 7º, V).
- **E-mail**: login, confirmação de conta, recuperação de senha e avisos sobre as suas inscrições (art. 7º, V).
- **Pagamentos, reembolsos e repasses**: execução do contrato e cumprimento de obrigações legais e fiscais (art. 7º, II e V).
- **Ficha de emergência**: atendimento em caso de acidente durante o evento, só com o seu consentimento específico (art. 11, I) e, numa emergência, para proteger a sua vida (art. 11, II, “e”).
- **Comunicações promocionais**: só se você autorizar no cadastro (art. 7º, I); você pode desistir quando quiser.
- **Segurança, prevenção a fraudes, moderação e registros de acesso**: legítimo interesse e cumprimento do Marco Civil da Internet (art. 7º, II e IX).
- **Métricas anônimas**: melhorar a plataforma e medir a divulgação dos eventos, sem identificar você (art. 7º, IX).
- **Defesa em processos**: exercício regular de direitos (art. 7º, VI).

Não tomamos decisões sobre você só com base em tratamento automatizado. As exceções são automáticas e reversíveis: a verificação anti-robô do login e do cadastro, e o bloqueio de publicações que contenham termos proibidos. Se discordar de um bloqueio, fale com o suporte.'),
  ('privacidade.c.finalidade.texto', 'en', 'Each use has a legal basis under the LGPD (arts. 7 and 11):

- **Creating and maintaining your account, registering you for events, issuing your QR code ticket, checking you in and providing support**: performance of the contract you accept in the [Terms of use](/termos) (art. 7, V).
- **CPF and date of birth**: identifying each participant with a single account, checking the minimum age and requiring guardian authorization for minors (art. 7, V, and art. 14).
- **Address and WhatsApp number**: event logistics and communication by the organization (art. 7, V).
- **Email**: sign-in, account confirmation, password recovery and notices about your registrations (art. 7, V).
- **Payments, refunds and payouts**: performance of the contract and compliance with legal and tax obligations (art. 7, II and V).
- **Emergency record**: assistance in case of an accident during the event, only with your specific consent (art. 11, I) and, in an emergency, to protect your life (art. 11, II, “e”).
- **Promotional messages**: only if you opt in during registration (art. 7, I); you can opt out at any time.
- **Security, fraud prevention, moderation and access logs**: legitimate interest and compliance with the Brazilian Internet Civil Framework (art. 7, II and IX).
- **Anonymous metrics**: improving the platform and measuring event promotion, without identifying you (art. 7, IX).
- **Defense in legal proceedings**: regular exercise of rights (art. 7, VI).

We do not make decisions about you based solely on automated processing. The exceptions are automatic and reversible: the anti-bot check at sign-in and registration, and blocking of posts that contain prohibited terms. If you disagree with a block, contact support.'),
  ('privacidade.c.quem-ve.titulo', 'pt', 'O que outras pessoas veem'),
  ('privacidade.c.quem-ve.titulo', 'en', 'What other people see'),
  ('privacidade.c.quem-ve.texto', 'pt', '- **Visitantes e outros usuários:** só o seu nome de exibição, a foto e o que você publicar nas comunidades, conforme a privacidade do seu perfil. Perfil **privado** mostra as publicações e os blocos do perfil de operador só a seguidores que você aprovar. Contas de 15 a 17 anos começam privadas.
- **Comunidade de um evento:** só os inscritos confirmados e a organização do evento.
- **Organização do evento:** os dados dos inscritos nos eventos dela (nome, CPF e telefone mascarados nas listagens, e-mail, ingresso, exército, pagamento e presença) e, com a sua autorização, a ficha de emergência.
- **Administração da plataforma:** os dados necessários para suporte, moderação, aprovação de organizadores e de menores, e atendimento aos pedidos LGPD. Ações administrativas ficam registradas em auditoria.
- **Ninguém** vê as suas notas fiscais de equipamentos: só você, por link temporário.'),
  ('privacidade.c.quem-ve.texto', 'en', '- **Visitors and other users:** only your display name, photo and what you post in communities, according to your profile privacy. A **private** profile shows posts and operator profile sections only to followers you approve. Accounts of users aged 15 to 17 start as private.
- **An event’s community:** only confirmed registrants and the event organization.
- **Event organization:** the data of registrants for its events (name, CPF and phone masked in listings, email, ticket, team, payment and attendance) and, with your authorization, your emergency record.
- **Platform administration:** the data needed for support, moderation, approval of organizers and minors, and handling LGPD requests. Administrative actions are recorded in an audit log.
- **No one** sees your equipment invoices: only you, through a temporary link.'),
  ('privacidade.c.emergencia.titulo', 'pt', 'Ficha de emergência'),
  ('privacidade.c.emergencia.titulo', 'en', 'Emergency record'),
  ('privacidade.c.emergencia.texto', 'pt', 'A ficha é opcional. A organização só a vê com a sua autorização expressa, apenas nos eventos em que você tem inscrição confirmada e somente de 7 dias antes do início até o fim de cada evento; fora disso ela nem chega ao navegador da organização. Você pode retirar a autorização ou apagar a ficha a qualquer momento em Meu perfil.'),
  ('privacidade.c.emergencia.texto', 'en', 'The record is optional. The organization sees it only with your express authorization, only for events in which you have a confirmed registration and only from 7 days before the start until the end of each event; outside that window it does not even reach the organization’s browser. You can withdraw your authorization or delete the record at any time in My profile.'),
  ('privacidade.c.compartilhamento.titulo', 'pt', 'Compartilhamento'),
  ('privacidade.c.compartilhamento.titulo', 'en', 'Sharing'),
  ('privacidade.c.compartilhamento.texto', 'pt', 'Não vendemos nem alugamos dados pessoais. Compartilhamos apenas o necessário com:

- **Organização do evento:** os dados dos inscritos no evento dela, como descrito acima, para conduzir o evento.
- **Supabase** (banco de dados, autenticação e armazenamento de arquivos): onde os dados ficam guardados.
- **Stripe** (pagamentos): processa os pagamentos no ambiente dele, recebe o seu e-mail e os dados de pagamento diretamente de você e verifica as contas de recebimento das organizações.
- **Resend** (envio de e-mails): recebe o seu e-mail para entregar as mensagens de confirmação de conta e de recuperação de senha.
- **Cloudflare** (rede e segurança): entrega o site, protege contra ataques e faz a verificação anti-robô no login e no cadastro.
- **Google**: somente se você usar “Entrar com o Google”, para autenticar você.
- **OpenStreetMap (Nominatim)**: recebe coordenadas arredondadas, sem nenhum dado seu, só se você pedir para usar a sua localização.
- **ViaCEP**: recebe só o CEP digitado, para preencher o endereço.
- **Autoridades**: quando a lei ou uma ordem judicial exigir.

Esses provedores tratam os dados em nosso nome e só para as finalidades acima.'),
  ('privacidade.c.compartilhamento.texto', 'en', 'We do not sell or rent personal data. We share only what is necessary with:

- **Event organization:** the data of registrants for its event, as described above, to run the event.
- **Supabase** (database, authentication and file storage): where the data is stored.
- **Stripe** (payments): processes payments in its own environment, receives your email and payment details directly from you and verifies organizations’ payout accounts.
- **Resend** (email delivery): receives your email address to deliver account confirmation and password recovery messages.
- **Cloudflare** (network and security): delivers the site, protects against attacks and runs the anti-bot check at sign-in and registration.
- **Google**: only if you use “Sign in with Google”, to authenticate you.
- **OpenStreetMap (Nominatim)**: receives rounded coordinates, with no personal data, only if you ask to use your location.
- **ViaCEP**: receives only the postal code you type, to fill in your address.
- **Authorities**: when required by law or court order.

These providers process data on our behalf and only for the purposes above.'),
  ('privacidade.c.transferencia.titulo', 'pt', 'Transferência internacional'),
  ('privacidade.c.transferencia.titulo', 'en', 'International transfer'),
  ('privacidade.c.transferencia.texto', 'pt', 'Alguns provedores (Supabase, Stripe, Cloudflare, Resend e Google) podem processar dados em servidores fora do Brasil. Nesses casos, a transferência segue o art. 33 da LGPD: os provedores adotam cláusulas contratuais e padrões de segurança reconhecidos, e os dados continuam protegidos como descrito neste aviso.'),
  ('privacidade.c.transferencia.texto', 'en', 'Some providers (Supabase, Stripe, Cloudflare, Resend and Google) may process data on servers outside Brazil. In these cases, the transfer follows art. 33 of the LGPD: the providers adopt contractual clauses and recognized security standards, and the data remains protected as described in this notice.'),
  ('privacidade.c.cookies.titulo', 'pt', 'Cookies e armazenamento no navegador'),
  ('privacidade.c.cookies.titulo', 'en', 'Cookies and browser storage'),
  ('privacidade.c.cookies.texto', 'pt', 'Usamos apenas o necessário para o site funcionar. **Não usamos cookies de publicidade nem rastreadores de terceiros.**

- **Sessão:** cookies que mantêm você logado e protegem o login (essenciais).
- **Segurança:** cookies da Cloudflare para proteção contra ataques e verificação anti-robô.
- **Preferências:** tema, idioma, cidade escolhida, modalidades e rascunhos de mensagens, guardados no próprio navegador.
- **Métricas anônimas:** um identificador aleatório de visitante e de sessão, sem dados pessoais.

Você pode apagar esses dados nas configurações do navegador; sem os cookies de sessão, não é possível ficar logado.'),
  ('privacidade.c.cookies.texto', 'en', 'We use only what is necessary for the site to work. **We do not use advertising cookies or third-party trackers.**

- **Session:** cookies that keep you signed in and protect sign-in (essential).
- **Security:** Cloudflare cookies for attack protection and anti-bot checks.
- **Preferences:** theme, language, chosen city, game modes and message drafts, stored in your own browser.
- **Anonymous metrics:** a random visitor and session identifier, with no personal data.

You can delete this data in your browser settings; without session cookies, you cannot stay signed in.'),
  ('privacidade.c.seguranca.titulo', 'pt', 'Armazenamento e segurança'),
  ('privacidade.c.seguranca.titulo', 'en', 'Storage and security'),
  ('privacidade.c.seguranca.texto', 'pt', 'Nome completo, CPF, data de nascimento, e-mail, WhatsApp, endereço, ficha de emergência, CNPJ e telefone das organizações são gravados **cifrados** (AES-256-GCM): nem o banco de dados, nem as cópias de segurança guardam esses dados legíveis. Toda a comunicação usa HTTPS.

O acesso aos dados passa sempre pelo servidor, que verifica quem está pedindo: o seu navegador recebe só o que você pode ver, e cada organização só acessa os dados dos próprios inscritos. Notas fiscais e anexos do suporte ficam em armazenamento privado. Ações administrativas ficam registradas em auditoria.

Se ocorrer um incidente de segurança que possa trazer risco ou dano relevante, avisaremos as pessoas afetadas e a Autoridade Nacional de Proteção de Dados (ANPD), como manda a LGPD.'),
  ('privacidade.c.seguranca.texto', 'en', 'Full name, CPF, date of birth, email, WhatsApp number, address, emergency record, and organizations’ CNPJ and phone are stored **encrypted** (AES-256-GCM): neither the database nor its backups hold this data in readable form. All communication uses HTTPS.

Access to data always goes through our server, which checks who is asking: your browser receives only what you are allowed to see, and each organization accesses only its own registrants’ data. Invoices and support attachments are kept in private storage. Administrative actions are recorded in an audit log.

If a security incident occurs that may cause relevant risk or harm, we will notify the people affected and the Brazilian National Data Protection Authority (ANPD), as required by the LGPD.'),
  ('privacidade.c.retencao.titulo', 'pt', 'Por quanto tempo guardamos'),
  ('privacidade.c.retencao.titulo', 'en', 'How long we keep data'),
  ('privacidade.c.retencao.texto', 'pt', '- Os dados da conta e do perfil ficam guardados enquanto a conta existir.
- A ficha de emergência pode ser apagada por você a qualquer momento.
- Se você desistir do cadastro com o Google antes de concluí-lo, a conta criada é apagada na hora.
- Registros de acesso ficam guardados pelos provedores de hospedagem e autenticação pelo prazo necessário à segurança e exigido pelo Marco Civil da Internet.
- Registros de pagamentos, reembolsos e repasses ficam guardados pelo prazo exigido pela legislação fiscal e de defesa do consumidor.
- Depois de um pedido de exclusão, apagamos ou anonimizamos os dados pessoais, mantendo só o que a lei obriga a guardar, pelo prazo legal.'),
  ('privacidade.c.retencao.texto', 'en', '- Account and profile data is kept while the account exists.
- You can delete your emergency record at any time.
- If you abandon Google registration before completing it, the account created is deleted immediately.
- Access logs are kept by hosting and authentication providers for as long as needed for security and as required by the Brazilian Internet Civil Framework.
- Payment, refund and payout records are kept for the period required by tax and consumer protection law.
- After a deletion request, we delete or anonymize personal data, keeping only what the law requires, for the legal period.'),
  ('privacidade.c.menores.titulo', 'pt', 'Menores de idade'),
  ('privacidade.c.menores.titulo', 'en', 'Minors'),
  ('privacidade.c.menores.texto', 'pt', 'A idade mínima para criar uma conta é 15 anos. Participantes de 15 a 17 anos só podem se inscrever em eventos depois que a autorização do responsável legal for aprovada pela administração, e o perfil deles começa privado na comunidade. Se soubermos de uma conta de menor de 15 anos, ela será desativada.'),
  ('privacidade.c.menores.texto', 'en', 'The minimum age to create an account is 15. Participants aged 15 to 17 can register for events only after their legal guardian’s authorization is approved by the administration, and their community profile starts as private. If we learn of an account belonging to someone under 15, it will be deactivated.'),
  ('privacidade.c.direitos.titulo', 'pt', 'Seus direitos'),
  ('privacidade.c.direitos.titulo', 'en', 'Your rights'),
  ('privacidade.c.direitos.texto', 'pt', 'Pela LGPD (art. 18), você pode pedir a qualquer momento:

- confirmação de que tratamos seus dados e acesso a eles;
- correção de dados incompletos, inexatos ou desatualizados (a maioria você mesmo edita em Meu perfil; CPF e e-mail são corrigidos pelo suporte);
- anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei;
- portabilidade (exportação) dos seus dados;
- informação sobre com quem compartilhamos os seus dados;
- retirada de consentimentos (ficha de emergência, comunicações promocionais), sem afetar o que já foi feito antes;
- revisão de decisões automatizadas.

Faça o pedido em [Minha área → Privacidade](/app/privacidade) ou pelos contatos da cláusula “Contato”. Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados ([gov.br/anpd](https://www.gov.br/anpd)).'),
  ('privacidade.c.direitos.texto', 'en', 'Under the LGPD (art. 18), you can request at any time:

- confirmation that we process your data and access to it;
- correction of incomplete, inaccurate or outdated data (you can edit most of it yourself in My profile; CPF and email are corrected by support);
- anonymization, blocking or deletion of unnecessary data or data processed unlawfully;
- portability (export) of your data;
- information about whom we share your data with;
- withdrawal of consent (emergency record, promotional messages), without affecting what was done before;
- review of automated decisions.

Make your request in [My area → Privacy](/app/privacidade) or through the contacts in the “Contact” section. We reply within 15 days. You can also file a complaint with the Brazilian National Data Protection Authority ([gov.br/anpd](https://www.gov.br/anpd)).'),
  ('privacidade.c.exclusao.titulo', 'pt', 'Exclusão da conta'),
  ('privacidade.c.exclusao.titulo', 'en', 'Account deletion'),
  ('privacidade.c.exclusao.texto', 'pt', 'Para excluir a conta e os dados, escolha “Exclusão” em [Minha área → Privacidade](/app/privacidade) ou peça pelos contatos da cláusula “Contato”. A administração confirma o pedido, desativa a conta e apaga ou anonimiza os dados pessoais, inclusive os recebidos do Google. Ficam só os registros que a lei obriga a guardar, pelo prazo legal.'),
  ('privacidade.c.exclusao.texto', 'en', 'To delete your account and data, choose “Exclusão” (Deletion) in [My area → Privacy](/app/privacidade) or ask through the contacts in the “Contact” section. The administration confirms the request, deactivates the account and deletes or anonymizes the personal data, including data received from Google. Only records the law requires us to keep remain, for the legal period.'),
  ('privacidade.c.alteracoes.titulo', 'pt', 'Alterações deste aviso'),
  ('privacidade.c.alteracoes.titulo', 'en', 'Changes to this notice'),
  ('privacidade.c.alteracoes.texto', 'pt', 'Se mudarmos este aviso, a data no topo é atualizada. Mudanças relevantes, como novos usos ou novos destinatários dos dados (inclusive dos dados recebidos do Google), são avisadas na plataforma antes de valer.'),
  ('privacidade.c.alteracoes.texto', 'en', 'If we change this notice, the date at the top is updated. Relevant changes, such as new uses or new recipients of data (including data received from Google), are announced on the platform before they take effect.'),
  ('privacidade.c.contato.titulo', 'pt', 'Contato'),
  ('privacidade.c.contato.titulo', 'en', 'Contact'),
  ('privacidade.c.contato.texto', 'pt', 'Dúvidas, pedidos e reclamações sobre privacidade:

[[contato]]'),
  ('privacidade.c.contato.texto', 'en', 'Questions, requests and complaints about privacy:

[[contato]]'),
  ('termos.c.aceite.titulo', 'pt', 'Aceite e definições'),
  ('termos.c.aceite.titulo', 'en', 'Acceptance and definitions'),
  ('termos.c.aceite.texto', 'pt', 'Estes termos regem o uso do MilSim Ops (milsimops.falaoperador.com.br), operado pela Fala Operador. Ao criar uma conta, você declara que leu e aceita estes termos e o [Aviso de privacidade](/privacidade). Se não concordar, não use a plataforma.

- **Plataforma:** o site MilSim Ops e os serviços oferecidos nele.
- **Participante:** quem tem conta e se inscreve em eventos.
- **Organização:** pessoa ou empresa aprovada pela administração para publicar e conduzir eventos.
- **Administração:** a equipe da Fala Operador que opera a plataforma.'),
  ('termos.c.aceite.texto', 'en', 'These terms govern the use of MilSim Ops (milsimops.falaoperador.com.br), operated by Fala Operador. By creating an account, you declare that you have read and accept these terms and the [Privacy notice](/privacidade). If you do not agree, do not use the platform.

- **Platform:** the MilSim Ops website and the services offered on it.
- **Participant:** anyone with an account who registers for events.
- **Organization:** a person or company approved by the administration to publish and run events.
- **Administration:** the Fala Operador team that operates the platform.'),
  ('termos.c.plataforma.titulo', 'pt', 'O que a plataforma faz'),
  ('termos.c.plataforma.titulo', 'en', 'What the platform does'),
  ('termos.c.plataforma.texto', 'pt', 'O MilSim Ops divulga eventos de airsoft e simulação militar e oferece as ferramentas para inscrição, pagamento de ingressos, check-in, comunicação com os participantes e comunidade.

**A plataforma não organiza os eventos.** Cada evento é planejado e conduzido pela organização indicada na página dele, que define as regras do jogo, o local, o horário, o equipamento exigido, o regulamento de segurança e as condições específicas do evento.'),
  ('termos.c.plataforma.texto', 'en', 'MilSim Ops promotes airsoft and military simulation events and provides tools for registration, ticket payment, check-in, communication with participants and community.

**The platform does not organize events.** Each event is planned and run by the organization shown on its page, which defines the game rules, venue, schedule, required equipment, safety rules and the event’s specific conditions.'),
  ('termos.c.conta.titulo', 'pt', 'Conta e cadastro'),
  ('termos.c.conta.titulo', 'en', 'Account and registration'),
  ('termos.c.conta.texto', 'pt', '- A idade mínima é **15 anos**. Participantes de 15 a 17 anos só se inscrevem em eventos depois que a autorização do responsável legal for aprovada pela administração.
- Cada pessoa pode ter **uma conta**: CPF e e-mail não se repetem. Os dados informados devem ser verdadeiros e seus; contas com dados falsos ou de terceiros podem ser desativadas.
- Você é responsável por manter a sua senha em sigilo e por tudo que for feito com a sua conta. Se suspeitar de uso indevido, troque a senha e avise o suporte.
- Você pode entrar com e-mail e senha ou com a sua conta Google. O e-mail precisa ser confirmado antes do primeiro acesso.
- Você pode editar os seus dados em Meu perfil. CPF e e-mail só são corrigidos pelo suporte.'),
  ('termos.c.conta.texto', 'en', '- The minimum age is **15**. Participants aged 15 to 17 can register for events only after their legal guardian’s authorization is approved by the administration.
- Each person can have **one account**: CPF and email cannot be repeated. The data provided must be true and your own; accounts with false or third-party data may be deactivated.
- You are responsible for keeping your password secret and for everything done with your account. If you suspect misuse, change your password and tell support.
- You can sign in with email and password or with your Google account. Your email must be confirmed before the first sign-in.
- You can edit your data in My profile. CPF and email can only be corrected by support.'),
  ('termos.c.inscricao.titulo', 'pt', 'Inscrições'),
  ('termos.c.inscricao.titulo', 'en', 'Registrations'),
  ('termos.c.inscricao.texto', 'pt', '- A inscrição é feita na página do evento, escolhendo o tipo de ingresso e, quando houver, o exército. Cada pessoa tem **uma inscrição confirmada por evento**.
- A vaga só é garantida com a inscrição **confirmada**. Quando há valor a pagar, a vaga fica reservada por cerca de 30 minutos enquanto o pagamento é concluído; se o pagamento não for concluído nesse prazo, a reserva é liberada sem cobrança.
- Preços, lotes, cupons e vagas são definidos pela organização e podem mudar até a sua inscrição ser confirmada. Cupons e benefícios de recompensa seguem as condições de cada um e não se acumulam.
- A inscrição confirmada gera um ingresso com QR code, pessoal e intransferível, apresentado no check-in do evento.
- Ao se inscrever, você aceita também as regras e o regulamento do evento publicados pela organização.'),
  ('termos.c.inscricao.texto', 'en', '- Registration is done on the event page, choosing the ticket type and, when applicable, the team. Each person has **one confirmed registration per event**.
- A spot is guaranteed only with a **confirmed** registration. When there is an amount to pay, the spot is held for about 30 minutes while payment is completed; if payment is not completed in that time, the hold is released without charge.
- Prices, batches, coupons and spots are set by the organization and may change until your registration is confirmed. Coupons and reward benefits follow their own conditions and cannot be combined.
- A confirmed registration generates a personal, non-transferable QR code ticket, shown at the event check-in.
- By registering, you also accept the event rules and regulations published by the organization.'),
  ('termos.c.pagamento.titulo', 'pt', 'Pagamentos e taxas'),
  ('termos.c.pagamento.titulo', 'en', 'Payments and fees'),
  ('termos.c.pagamento.texto', 'pt', '- Os pagamentos são processados pelo **Stripe**, no ambiente dele. A plataforma não recebe nem guarda dados de cartão.
- O valor pago vai para a organização do evento. A plataforma retém uma taxa sobre cada venda, descontada do valor repassado à organização.
- A organização pode cobrar do comprador uma **taxa de serviço**. Quando houver, ela aparece separada do ingresso na revisão da inscrição, antes do pagamento.
- Se você contestar um pagamento junto ao banco ou à operadora do cartão (chargeback), a contestação é analisada pelo Stripe com a organização, e a inscrição pode ser revista.'),
  ('termos.c.pagamento.texto', 'en', '- Payments are processed by **Stripe**, in its own environment. The platform does not receive or store card details.
- The amount paid goes to the event organization. The platform keeps a fee on each sale, deducted from the amount paid out to the organization.
- The organization may charge the buyer a **service fee**. When it does, the fee is shown separately from the ticket in the registration review, before payment.
- If you dispute a payment with your bank or card issuer (chargeback), the dispute is reviewed by Stripe with the organization, and the registration may be revised.'),
  ('termos.c.cancelamento.titulo', 'pt', 'Cancelamento e reembolso'),
  ('termos.c.cancelamento.titulo', 'en', 'Cancellation and refund'),
  ('termos.c.cancelamento.texto', 'pt', '- Você pode cancelar a sua inscrição em [Meus ingressos](/app/ingressos), informando o motivo. O cancelamento gera **reembolso integral** no mesmo meio de pagamento; o prazo para o valor aparecer depende do banco ou da operadora.
- Enquanto o pagamento estiver em processamento (por exemplo, boleto), o cancelamento só é possível depois da confirmação.
- A organização e a administração também podem cancelar uma inscrição, com justificativa, e o reembolso é igualmente integral.
- Se o evento for **cancelado**, todas as inscrições são canceladas e reembolsadas integralmente, e os benefícios usados voltam a quem os usou, dentro do prazo de cada um.
- Cancelamentos e reembolsos ficam registrados no histórico da inscrição. O ingresso cancelado deixa de valer no check-in.'),
  ('termos.c.cancelamento.texto', 'en', '- You can cancel your registration in [My tickets](/app/ingressos), giving a reason. Cancellation generates a **full refund** to the same payment method; how long the amount takes to appear depends on your bank or card issuer.
- While a payment is still processing (for example, a bank slip), cancellation is only possible after confirmation.
- The organization and the administration can also cancel a registration, with justification, and the refund is likewise full.
- If the event is **canceled**, all registrations are canceled and fully refunded, and any benefits used are returned to whoever used them, within each benefit’s validity.
- Cancellations and refunds are recorded in the registration history. A canceled ticket is no longer valid at check-in.'),
  ('termos.c.evento.titulo', 'pt', 'Participação no evento e segurança'),
  ('termos.c.evento.titulo', 'en', 'Event participation and safety'),
  ('termos.c.evento.texto', 'pt', '- Airsoft e simulação militar envolvem atividade física e riscos. Use sempre o equipamento de proteção exigido pela organização, principalmente a proteção dos olhos, e siga as orientações da equipe do evento.
- Você é responsável pelo seu equipamento e por cumprir a legislação aplicável, inclusive quanto à aquisição, ao porte e ao transporte de réplicas e armas de pressão.
- A organização pode recusar a entrada ou retirar do jogo quem descumprir o regulamento ou colocar outras pessoas em risco.
- A condução do evento, a segurança do local e o atendimento no campo são responsabilidade da organização. A ficha de emergência existe para ajudar nesse atendimento e é opcional.'),
  ('termos.c.evento.texto', 'en', '- Airsoft and military simulation involve physical activity and risks. Always use the protective equipment required by the organization, especially eye protection, and follow the event staff’s instructions.
- You are responsible for your equipment and for complying with applicable law, including on the purchase, carrying and transport of replicas and air guns.
- The organization may refuse entry to or remove from play anyone who breaks the rules or puts others at risk.
- Running the event, venue safety and on-field assistance are the organization’s responsibility. The emergency record exists to help with that assistance and is optional.'),
  ('termos.c.organizacoes.titulo', 'pt', 'Organizações'),
  ('termos.c.organizacoes.titulo', 'en', 'Organizations'),
  ('termos.c.organizacoes.texto', 'pt', 'Qualquer conta pode pedir para organizar eventos; a administração analisa e aprova. Ao organizar eventos na plataforma, a organização se compromete a:

- publicar informações verdadeiras e completas sobre o evento (data, local, regras, preços e o que está incluído) e cumprir o que divulgou;
- manter uma conta de recebimento ativa no Stripe para vender ingressos pagos, aceitando os termos do Stripe;
- atender os participantes, conduzir o evento com segurança e cumprir a legislação aplicável, inclusive a de defesa do consumidor;
- arcar com os reembolsos dos cancelamentos e do cancelamento do evento;
- usar os dados dos inscritos só para conduzir o evento, protegê-los conforme a LGPD e não repassá-los a terceiros;
- moderar a comunidade do seu evento de forma justa, registrando as justificativas.

A taxa da plataforma vigente aparece no Financeiro da organização e vale para as vendas feitas a partir de cada alteração; cada venda guarda a taxa do momento.'),
  ('termos.c.organizacoes.texto', 'en', 'Any account can apply to organize events; the administration reviews and approves. By organizing events on the platform, the organization agrees to:

- publish true and complete information about the event (date, venue, rules, prices and what is included) and deliver what it advertised;
- keep an active Stripe payout account to sell paid tickets, accepting Stripe’s terms;
- assist participants, run the event safely and comply with applicable law, including consumer protection law;
- bear the refunds for cancellations and for event cancellation;
- use registrants’ data only to run the event, protect it under the LGPD and not pass it on to third parties;
- moderate its event community fairly, recording justifications.

The current platform fee is shown in the organization’s Finance area and applies to sales made after each change; each sale keeps the fee in force at that time.'),
  ('termos.c.comunidade.titulo', 'pt', 'Comunidade e conteúdo'),
  ('termos.c.comunidade.titulo', 'en', 'Community and content'),
  ('termos.c.comunidade.texto', 'pt', 'Nas comunidades, no perfil e no suporte, é proibido publicar:

- ofensas, ameaças, assédio, discriminação ou discurso de ódio;
- conteúdo sexual, violência real, apologia a crimes ou a drogas ilícitas;
- dados pessoais de outras pessoas sem autorização;
- spam, golpes, venda de itens proibidos ou propaganda não autorizada;
- conteúdo que viole direitos autorais ou de imagem de terceiros.

Você é responsável pelo que publica e mantém os direitos sobre o seu conteúdo. Ao publicar, você autoriza a plataforma a exibi-lo para o público escolhido (por exemplo, seguidores, membros de um fórum ou inscritos de um evento), enquanto ele estiver publicado.

Qualquer pessoa pode denunciar um conteúdo. A organização do evento, os moderadores dos fóruns e a administração podem ocultar conteúdos e suspender a participação de quem descumprir estas regras, sempre com registro da justificativa. Publicações com termos proibidos são bloqueadas automaticamente.'),
  ('termos.c.comunidade.texto', 'en', 'In communities, profiles and support, it is prohibited to post:

- insults, threats, harassment, discrimination or hate speech;
- sexual content, real violence, or promotion of crimes or illegal drugs;
- other people’s personal data without authorization;
- spam, scams, sale of prohibited items or unauthorized advertising;
- content that violates third parties’ copyright or image rights.

You are responsible for what you post and keep the rights to your content. By posting, you authorize the platform to display it to the audience you chose (for example, followers, members of a forum or registrants of an event) while it remains published.

Anyone can report content. The event organization, forum moderators and the administration can hide content and suspend the participation of anyone who breaks these rules, always recording the justification. Posts with prohibited terms are blocked automatically.'),
  ('termos.c.recompensas.titulo', 'pt', 'Insígnias, missões e recompensas'),
  ('termos.c.recompensas.titulo', 'en', 'Badges, missions and rewards'),
  ('termos.c.recompensas.texto', 'pt', 'Insígnias, pontos de missões e benefícios de recompensa não têm valor em dinheiro, são pessoais e intransferíveis e seguem as condições divulgadas em cada campanha (prazos, limites e eventos em que valem). A participação só conta quando o evento é concluído e a presença foi registrada no check-in. Operações registradas por você no perfil, fora da plataforma, não contam para insígnias nem recompensas.'),
  ('termos.c.recompensas.texto', 'en', 'Badges, mission points and reward benefits have no cash value, are personal and non-transferable and follow the conditions announced in each campaign (deadlines, limits and events where they apply). Participation counts only when the event is completed and attendance was recorded at check-in. Operations you record on your profile outside the platform do not count toward badges or rewards.'),
  ('termos.c.suspensao.titulo', 'pt', 'Suspensão e encerramento'),
  ('termos.c.suspensao.titulo', 'en', 'Suspension and termination'),
  ('termos.c.suspensao.texto', 'pt', 'A administração pode desativar contas que descumpram estes termos, usem dados falsos, pratiquem fraude ou coloquem outras pessoas em risco, sempre com justificativa registrada. Você pode contestar pelo suporte.

Você pode pedir o encerramento da sua conta a qualquer momento em [Minha área → Privacidade](/app/privacidade). Inscrições confirmadas em eventos futuros devem ser canceladas antes, para receber o reembolso.'),
  ('termos.c.suspensao.texto', 'en', 'The administration may deactivate accounts that breach these terms, use false data, commit fraud or put other people at risk, always with a recorded justification. You can appeal through support.

You can request closure of your account at any time in [My area → Privacy](/app/privacidade). Confirmed registrations for future events must be canceled first to receive the refund.'),
  ('termos.c.propriedade.titulo', 'pt', 'Propriedade intelectual'),
  ('termos.c.propriedade.titulo', 'en', 'Intellectual property'),
  ('termos.c.propriedade.texto', 'pt', 'A marca, o site, o código e o visual do MilSim Ops pertencem à Fala Operador. Textos, imagens e marcas de eventos e organizações pertencem a quem os publicou. Não é permitido copiar a plataforma, coletar dados dela de forma automatizada nem usá-la para fins diferentes dos previstos nestes termos.'),
  ('termos.c.propriedade.texto', 'en', 'The MilSim Ops brand, website, code and design belong to Fala Operador. Texts, images and brands of events and organizations belong to whoever published them. It is not permitted to copy the platform, collect data from it by automated means or use it for purposes other than those set out in these terms.'),
  ('termos.c.responsabilidade.titulo', 'pt', 'Responsabilidades e disponibilidade'),
  ('termos.c.responsabilidade.titulo', 'en', 'Responsibilities and availability'),
  ('termos.c.responsabilidade.texto', 'pt', '- Trabalhamos para manter a plataforma disponível e segura, mas ela pode passar por manutenções e instabilidades, inclusive de serviços de terceiros como pagamentos, e-mail e hospedagem.
- A plataforma não responde pela realização, pelo conteúdo nem pelas condições dos eventos, que são da organização, nem por conteúdos publicados por usuários, ressalvados os direitos garantidos pelo Código de Defesa do Consumidor.
- Links para sites de terceiros (por exemplo, Instagram ou grupos de WhatsApp) seguem as regras desses sites.'),
  ('termos.c.responsabilidade.texto', 'en', '- We work to keep the platform available and secure, but it may undergo maintenance and instability, including from third-party services such as payments, email and hosting.
- The platform is not responsible for holding events, for their content or for their conditions, which belong to the organization, nor for content posted by users, without prejudice to the rights guaranteed by the Brazilian Consumer Protection Code.
- Links to third-party sites (for example, Instagram or WhatsApp groups) are subject to those sites’ rules.'),
  ('termos.c.privacidade.titulo', 'pt', 'Privacidade'),
  ('termos.c.privacidade.titulo', 'en', 'Privacy'),
  ('termos.c.privacidade.texto', 'pt', 'O tratamento dos seus dados pessoais está descrito no [Aviso de privacidade](/privacidade), que faz parte destes termos.'),
  ('termos.c.privacidade.texto', 'en', 'How your personal data is processed is described in the [Privacy notice](/privacidade), which is part of these terms.'),
  ('termos.c.alteracoes.titulo', 'pt', 'Alterações destes termos'),
  ('termos.c.alteracoes.titulo', 'en', 'Changes to these terms'),
  ('termos.c.alteracoes.texto', 'pt', 'Podemos atualizar estes termos para refletir mudanças na plataforma ou na lei. A versão e a data ficam no topo da página. Mudanças relevantes são avisadas na plataforma antes de valer, e continuar usando a plataforma depois disso significa aceitar a nova versão.'),
  ('termos.c.alteracoes.texto', 'en', 'We may update these terms to reflect changes in the platform or the law. The version and date are shown at the top of the page. Relevant changes are announced on the platform before they take effect, and continuing to use the platform after that means accepting the new version.'),
  ('termos.c.lei.titulo', 'pt', 'Lei aplicável e foro'),
  ('termos.c.lei.titulo', 'en', 'Governing law and jurisdiction'),
  ('termos.c.lei.texto', 'pt', 'Estes termos seguem a lei brasileira, incluindo o Código de Defesa do Consumidor, o Marco Civil da Internet e a LGPD. Eventuais conflitos podem ser resolvidos no foro do domicílio do consumidor.'),
  ('termos.c.lei.texto', 'en', 'These terms are governed by Brazilian law, including the Consumer Protection Code, the Internet Civil Framework and the LGPD. Any disputes may be settled in the courts of the consumer’s domicile.'),
  ('termos.c.contato.titulo', 'pt', 'Contato'),
  ('termos.c.contato.titulo', 'en', 'Contact'),
  ('termos.c.contato.texto', 'pt', '[[contato]]'),
  ('termos.c.contato.texto', 'en', '[[contato]]'),
  ('comum.idioma.rotulo', 'pt', 'Idioma'),
  ('comum.idioma.rotulo', 'en', 'Language'),
  ('comum.idioma.pt', 'pt', 'Português'),
  ('comum.idioma.pt', 'en', 'Português'),
  ('comum.idioma.en', 'pt', 'English'),
  ('comum.idioma.en', 'en', 'English'),
  ('meta.titulo', 'pt', 'MilSim Ops — Eventos de Simulação Militar'),
  ('meta.titulo', 'en', 'MilSim Ops — Military Simulation Events'),
  ('meta.descricao', 'pt', 'Plataforma de divulgação e gestão de eventos de simulação militar, operações e comunidades de participantes.'),
  ('meta.descricao', 'en', 'Platform for promoting and managing military simulation events, operations and player communities.'),
  ('meta.og_descricao', 'pt', 'Descubra operações, inscreva-se e acompanhe sua comunidade.'),
  ('meta.og_descricao', 'en', 'Find operations, sign up and follow your community.'),
  ('nav.eventos', 'pt', 'Eventos'),
  ('nav.eventos', 'en', 'Events'),
  ('nav.modalidades', 'pt', 'Modalidades'),
  ('nav.modalidades', 'en', 'Game modes'),
  ('nav.comunidades', 'pt', 'Comunidades'),
  ('nav.comunidades', 'en', 'Communities'),
  ('cabecalho.marca_aria', 'pt', 'MILSIM OPS — página inicial'),
  ('cabecalho.marca_aria', 'en', 'MILSIM OPS — home page'),
  ('cabecalho.navegacao_aria', 'pt', 'Navegação principal'),
  ('cabecalho.navegacao_aria', 'en', 'Main navigation'),
  ('cabecalho.entrar', 'pt', 'Entrar'),
  ('cabecalho.entrar', 'en', 'Sign in'),
  ('cabecalho.criar_conta', 'pt', 'Criar conta'),
  ('cabecalho.criar_conta', 'en', 'Create account'),
  ('cabecalho.abrir_menu', 'pt', 'Abrir menu'),
  ('cabecalho.abrir_menu', 'en', 'Open menu'),
  ('cabecalho.fechar_menu', 'pt', 'Fechar menu'),
  ('cabecalho.fechar_menu', 'en', 'Close menu'),
  ('cabecalho.menu', 'pt', 'Menu'),
  ('cabecalho.menu', 'en', 'Menu'),
  ('cabecalho.convite_titulo', 'pt', 'Entre na operação'),
  ('cabecalho.convite_titulo', 'en', 'Join the operation'),
  ('cabecalho.convite_texto', 'pt', 'Crie sua conta para se inscrever, guardar ingressos e entrar nas comunidades.'),
  ('cabecalho.convite_texto', 'en', 'Create your account to sign up for events, keep your tickets and join the communities.'),
  ('cabecalho.navegar', 'pt', 'Navegar'),
  ('cabecalho.navegar', 'en', 'Browse'),
  ('rodape.descricao', 'pt', 'Agenda, inscrição e check-in de operações de airsoft e milsim no Brasil.'),
  ('rodape.descricao', 'en', 'Calendar, registration and check-in for airsoft and milsim operations in Brazil.'),
  ('rodape.links_aria', 'pt', 'Links do rodapé'),
  ('rodape.links_aria', 'en', 'Footer links'),
  ('rodape.plataforma', 'pt', 'Plataforma'),
  ('rodape.plataforma', 'en', 'Platform'),
  ('rodape.legal', 'pt', 'Legal'),
  ('rodape.legal', 'en', 'Legal'),
  ('rodape.termos', 'pt', 'Termos de uso'),
  ('rodape.termos', 'en', 'Terms of use'),
  ('rodape.privacidade', 'pt', 'Privacidade'),
  ('rodape.privacidade', 'en', 'Privacy'),
  ('rodape.stripe', 'pt', 'Pagamentos processados pelo Stripe.'),
  ('rodape.stripe', 'en', 'Payments processed by Stripe.'),
  ('inicio.meta.titulo', 'pt', 'MilSim Ops — Encontre sua próxima operação'),
  ('inicio.meta.titulo', 'en', 'MilSim Ops — Find your next operation'),
  ('inicio.meta.descricao', 'pt', 'MilSim Ops é a plataforma de eventos de airsoft e milsim do Brasil: agenda pública, inscrição, ingresso e check-in das operações.'),
  ('inicio.meta.descricao', 'en', 'MilSim Ops is Brazil''s airsoft and milsim events platform: public calendar, registration, tickets and check-in for operations.'),
  ('inicio.meta.og_descricao', 'pt', 'Explore eventos de simulação militar, reúna seu squad e prepare-se para a missão.'),
  ('inicio.meta.og_descricao', 'en', 'Explore military simulation events, gather your squad and get ready for the mission.'),
  ('inicio.chamada.rotulo', 'pt', 'MilSim Ops · plataforma de eventos de airsoft e milsim'),
  ('inicio.chamada.rotulo', 'en', 'MilSim Ops · airsoft and milsim events platform'),
  ('inicio.chamada.titulo', 'pt', 'Operações de airsoft e milsim pelo Brasil'),
  ('inicio.chamada.titulo', 'en', 'Airsoft and milsim operations across Brazil'),
  ('inicio.chamada.texto', 'pt', 'O MilSim Ops é uma plataforma pública para encontrar eventos de airsoft e milsim, fazer a inscrição, pagar o ingresso e fazer o check-in. Você vê a agenda sem criar conta; o login só é pedido para se inscrever. [Saiba mais](#sobre) · [Aviso de privacidade](/privacidade)'),
  ('inicio.chamada.texto', 'en', 'MilSim Ops is a public platform to find airsoft and milsim events, register, pay for tickets and check in. You can browse the calendar without an account; sign-in is only required to register. [Learn more](#sobre) · [Privacy notice](/privacidade)'),
  ('sobre.rotulo', 'pt', 'Sobre a plataforma'),
  ('sobre.rotulo', 'en', 'About the platform'),
  ('sobre.titulo', 'pt', 'O que é o MilSim Ops'),
  ('sobre.titulo', 'en', 'What is MilSim Ops'),
  ('sobre.texto', 'pt', 'O MilSim Ops é uma plataforma de divulgação e gestão de eventos de airsoft e simulação militar (milsim), operada pela Fala Operador. Jogadores encontram operações e se inscrevem; organizações publicam eventos, vendem ingressos e fazem o check-in dos participantes. Qualquer pessoa pode ver a agenda sem criar conta.'),
  ('sobre.texto', 'en', 'MilSim Ops is a platform for promoting and managing airsoft and military simulation (milsim) events, operated by Fala Operador. Players find operations and register; organizations publish events, sell tickets and check participants in. Anyone can browse the calendar without an account.'),
  ('sobre.recurso1.titulo', 'pt', 'Encontre operações'),
  ('sobre.recurso1.titulo', 'en', 'Find operations'),
  ('sobre.recurso1.texto', 'pt', 'Agenda pública de eventos de airsoft e milsim em todo o Brasil, com busca por cidade, data e modalidade.'),
  ('sobre.recurso1.texto', 'en', 'Public calendar of airsoft and milsim events across Brazil, with search by city, date and game mode.'),
  ('sobre.recurso2.titulo', 'pt', 'Inscreva-se e pague'),
  ('sobre.recurso2.titulo', 'en', 'Register and pay'),
  ('sobre.recurso2.texto', 'pt', 'Inscrição do operador e do squad, com ingresso pago pelo Stripe (cartão ou Pix) quando o evento cobra.'),
  ('sobre.recurso2.texto', 'en', 'Player and squad registration, with tickets paid through Stripe (card or Pix) when the event charges.'),
  ('sobre.recurso3.titulo', 'pt', 'Check-in no campo'),
  ('sobre.recurso3.titulo', 'en', 'On-site check-in'),
  ('sobre.recurso3.texto', 'pt', 'Ingresso com QR code para o check-in no dia, mais comunidade e avisos de cada evento.'),
  ('sobre.recurso3.texto', 'en', 'QR code ticket for check-in on the day, plus a community and announcements for each event.'),
  ('sobre.recurso4.titulo', 'pt', 'Para organizações'),
  ('sobre.recurso4.titulo', 'en', 'For organizations'),
  ('sobre.recurso4.texto', 'pt', 'Ferramentas para criar eventos, vender lotes, controlar inscritos e receber os valores das vendas.'),
  ('sobre.recurso4.texto', 'en', 'Tools to create events, sell ticket batches, manage participants and receive the sales revenue.'),
  ('sobre.google', 'pt', 'Para se inscrever, você cria uma conta com e-mail e senha ou entra com a sua conta Google. Com o Google, o MilSim Ops recebe apenas o seu nome, e-mail e foto de perfil, usados só para criar e identificar a sua conta. Veja os detalhes no [Aviso de privacidade](/privacidade) e nos [Termos de uso](/termos).'),
  ('sobre.google', 'en', 'To register, you create an account with email and password or sign in with your Google account. With Google, MilSim Ops receives only your name, email address and profile picture, used only to create and identify your account. See the details in the [Privacy notice](/privacidade) and the [Terms of use](/termos).'),
  ('legal.neste_documento', 'pt', 'Neste documento'),
  ('legal.neste_documento', 'en', 'In this document'),
  ('legal.clausulas_aria', 'pt', 'Cláusulas'),
  ('legal.clausulas_aria', 'en', 'Sections'),
  ('legal.contato.controladora', 'pt', 'Controladora'),
  ('legal.contato.controladora', 'en', 'Controller'),
  ('legal.contato.encarregado', 'pt', 'Encarregado(a) pelo tratamento de dados (LGPD, art. 41)'),
  ('legal.contato.encarregado', 'en', 'Data protection officer (LGPD, art. 41)'),
  ('legal.contato.email', 'pt', 'E-mail'),
  ('legal.contato.email', 'en', 'Email'),
  ('legal.contato.email_obs', 'pt', '(não exige conta na plataforma)'),
  ('legal.contato.email_obs', 'en', '(no account needed)'),
  ('legal.contato.plataforma', 'pt', 'Pela plataforma'),
  ('legal.contato.plataforma', 'en', 'On the platform'),
  ('legal.contato.links', 'pt', '[Minha área → Privacidade](/app/privacidade) (pedidos LGPD) ou [Minha área → Suporte](/app/suporte).'),
  ('legal.contato.links', 'en', '[My area → Privacy](/app/privacidade) (data protection requests) or [My area → Support](/app/suporte).'),
  ('privacidade.meta.titulo', 'pt', 'Aviso de privacidade — MilSim Ops'),
  ('privacidade.meta.titulo', 'en', 'Privacy policy — MilSim Ops'),
  ('privacidade.meta.descricao', 'pt', 'Quais dados o MilSim Ops coleta (inclusive da conta Google), para quê e com qual base legal, quem vê, com quem compartilha, onde guarda, por quanto tempo e como você exerce seus direitos.'),
  ('privacidade.meta.descricao', 'en', 'What data MilSim Ops collects (including from your Google account), why and on what legal basis, who sees it, who it is shared with, where it is stored, for how long and how you exercise your rights.'),
  ('privacidade.meta.og_descricao', 'pt', 'Como a MilSim Ops usa e protege os seus dados pessoais.'),
  ('privacidade.meta.og_descricao', 'en', 'How MilSim Ops uses and protects your personal data.'),
  ('privacidade.rotulo', 'pt', 'Documento legal · LGPD · atualizado em {data}'),
  ('privacidade.rotulo', 'en', 'Legal document · LGPD (Brazilian data protection law) · updated {data}'),
  ('privacidade.titulo', 'pt', 'Aviso de privacidade'),
  ('privacidade.titulo', 'en', 'Privacy policy'),
  ('privacidade.subtitulo', 'pt', 'Quais dados pessoais o MilSim Ops coleta, para quê, com qual base legal, quem vê, com quem são compartilhados, onde ficam, por quanto tempo e como você controla cada um.'),
  ('privacidade.subtitulo', 'en', 'What personal data MilSim Ops collects, why, on what legal basis, who sees it, who it is shared with, where it is stored, for how long and how you control each item.'),
  ('termos.meta.titulo', 'pt', 'Termos de uso — MilSim Ops'),
  ('termos.meta.titulo', 'en', 'Terms of use — MilSim Ops'),
  ('termos.meta.descricao', 'pt', 'Regras para usar o MilSim Ops: conta, inscrições, pagamentos, cancelamentos e reembolsos, organizações, comunidade e responsabilidades.'),
  ('termos.meta.descricao', 'en', 'Rules for using MilSim Ops: account, registrations, payments, cancellations and refunds, organizations, community and responsibilities.'),
  ('termos.meta.og_descricao', 'pt', 'Termos de uso da plataforma MilSim Ops.'),
  ('termos.meta.og_descricao', 'en', 'Terms of use of the MilSim Ops platform.'),
  ('termos.rotulo', 'pt', 'Documento legal · {versao} · atualizado em {data}'),
  ('termos.rotulo', 'en', 'Legal document · {versao} · updated {data}'),
  ('termos.titulo', 'pt', 'Termos de uso'),
  ('termos.titulo', 'en', 'Terms of use'),
  ('termos.subtitulo', 'pt', 'Regras para usar o MilSim Ops: conta, inscrições, pagamentos, cancelamentos e reembolsos, organizações, comunidade e responsabilidades. Ao criar a conta, você aceita esta versão.'),
  ('termos.subtitulo', 'en', 'Rules for using MilSim Ops: account, registrations, payments, cancellations and refunds, organizations, community and responsibilities. By creating an account, you accept this version.')
on conflict (key, locale) do nothing;

commit;

notify pgrst, 'reload schema';
