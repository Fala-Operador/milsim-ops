-- Aviso de privacidade mais detalhado para a verificação do Google OAuth: nova cláusula
-- "Abrangência" e a cláusula do Google reescrita (dados acessados, uso, Uso Limitado,
-- armazenamento, compartilhamento, proteção, retenção, exclusão e revogação).
insert into public.site_texts (key, locale, value) values
  ('privacidade.c.escopo.titulo', 'pt', 'Abrangência deste aviso'),
  ('privacidade.c.escopo.titulo', 'en', 'Scope of this policy'),
  ('privacidade.c.escopo.texto', 'pt', 'Este aviso vale para o site MilSim Ops (milsimops.falaoperador.com.br), para todas as funções da plataforma (agenda, inscrição, pagamento, check-in, comunidades e perfil) e para o login com a conta Google (“Entrar com o Google”). Ele explica:

- quais dados pessoais coletamos, inclusive os **dados do usuário do Google**;
- como e por que usamos cada dado, e com qual base legal;
- com quem compartilhamos e onde os dados ficam guardados;
- como protegemos, por quanto tempo guardamos e como apagamos os dados;
- como você acessa, corrige, exporta ou exclui os seus dados e retira consentimentos.

Ao usar a plataforma, você declara que leu este aviso. Ele complementa os [Termos de uso](/termos).'),
  ('privacidade.c.escopo.texto', 'en', 'This policy applies to the MilSim Ops website (milsimops.falaoperador.com.br), to every feature of the platform (event calendar, registration, payment, check-in, communities and profile) and to signing in with a Google account (“Sign in with Google”). It explains:

- what personal data we collect, including **Google user data**;
- how and why we use each item of data, and on what legal basis;
- who we share it with and where it is stored;
- how we protect it, how long we keep it and how we delete it;
- how you can access, correct, export or delete your data and withdraw consent.

By using the platform, you acknowledge that you have read this policy. It complements the [Terms of use](/termos).'),
  ('privacidade.c.google.texto', 'pt', 'O MilSim Ops oferece o login opcional “Entrar com o Google”. Esta cláusula descreve exatamente como o app **acessa, usa, guarda, compartilha e apaga** os dados do usuário do Google. Você também pode criar a conta só com e-mail e senha, sem usar o Google.

**1. Dados do Google que acessamos.** Pedimos apenas os escopos básicos `openid`, `email` e `profile`. Com a sua autorização na tela de consentimento do Google, recebemos somente:

- identificador da conta Google (código numérico que identifica a conta);
- endereço de e-mail e a indicação de que ele foi confirmado pelo Google;
- nome e sobrenome da conta Google;
- endereço (URL) da foto de perfil do Google.

Não pedimos e não acessamos Gmail, Google Drive, Contatos, Agenda, Fotos, YouTube, localização ou qualquer outra API do Google. Não recebemos a sua senha do Google.

**2. Como usamos esses dados.** Somente para:

- criar a sua conta no MilSim Ops e identificar você nos próximos logins;
- preencher o seu nome no cadastro (você pode editá-lo);
- usar o e-mail do Google como e-mail da conta, para login, avisos das suas inscrições e recuperação de acesso; se esse e-mail já tiver uma conta confirmada aqui, o login com o Google é vinculado a ela.

A foto do Google fica registrada no serviço de autenticação e não é publicada no seu perfil.

**3. Uso limitado (Limited Use).** O uso e a transferência, para qualquer outro aplicativo, de informações recebidas das APIs do Google pelo MilSim Ops seguem a [Política de Dados do Usuário dos Serviços de API do Google](https://developers.google.com/terms/api-services-user-data-policy) (Google API Services User Data Policy), incluindo os requisitos de Uso Limitado (Limited Use). Em especial:

- usamos os dados do Google apenas para oferecer o login e a conta descritos acima;
- não transferimos dados do Google a terceiros, exceto aos provedores que hospedam a plataforma (abaixo), quando a lei exigir ou numa fusão ou aquisição, com aviso prévio;
- não usamos dados do Google para publicidade, inclusive anúncios personalizados ou de redirecionamento;
- não vendemos dados do Google e não os repassamos a corretores de dados ou revendedores;
- nenhuma pessoa da equipe lê dados do Google, exceto com o seu consentimento, para investigar segurança ou abuso, para cumprir a lei ou quando os dados estiverem agregados e anonimizados;
- não usamos dados do Google para desenvolver, melhorar ou treinar modelos de inteligência artificial ou aprendizado de máquina.

**4. Onde guardamos e com quem compartilhamos.** Os dados do Google ficam no Supabase, provedor que hospeda o serviço de autenticação e o banco de dados da plataforma. Não são repassados a organizações de eventos, anunciantes, corretores de dados nem outros terceiros. As organizações de eventos veem só os dados de inscrição descritos em “Quem vê os seus dados”, nunca o identificador ou a foto do Google.

**5. Como protegemos.** O login usa OAuth 2.0 com PKCE, feito pelo nosso servidor. Não guardamos os tokens de acesso às APIs do Google, porque não chamamos nenhuma API do Google depois do login. No perfil da plataforma, nome e e-mail ficam cifrados (AES-256-GCM). A cópia usada pelo serviço de autenticação fica no Supabase, com acesso restrito ao servidor da plataforma. Todo o tráfego usa HTTPS, e o acesso administrativo é registrado em log de auditoria.

**6. Por quanto tempo guardamos.** Enquanto a sua conta existir. Se você abandonar o cadastro com o Google antes de concluir, a conta criada é apagada na hora.

**7. Como apagar ou revogar.**

- Peça a exclusão da conta em [Minha área → Privacidade](/app/privacidade) ou pelo e-mail da cláusula “Contato”. Apagamos os dados recebidos do Google junto com a conta, em até 15 dias.
- Você pode revogar a qualquer momento o acesso do MilSim Ops à sua conta Google em [myaccount.google.com/permissions](https://myaccount.google.com/permissions). Depois disso, o login com o Google deixa de funcionar até você autorizar de novo.
- Dúvidas sobre os dados do Google: use os contatos da cláusula “Contato”.'),
  ('privacidade.c.google.texto', 'en', 'MilSim Ops offers an optional “Sign in with Google” option. This section describes exactly how the app **accesses, uses, stores, shares and deletes** Google user data. You can also create an account with only an email address and password, without using Google.

**1. Google data we access.** We request only the basic `openid`, `email` and `profile` scopes. With your permission on Google’s consent screen, we receive only:

- your Google account identifier (a numeric code that identifies the account);
- your email address and whether Google has verified it;
- the first and last name on your Google account;
- the address (URL) of your Google profile picture.

We do not request or access Gmail, Google Drive, Contacts, Calendar, Photos, YouTube, location or any other Google API. We never receive your Google password.

**2. How we use this data.** Only to:

- create your MilSim Ops account and identify you on later sign-ins;
- prefill your name during registration (you can edit it);
- use your Google email as your account email, for sign-in, notices about your registrations and account recovery; if that email already belongs to a confirmed account here, Google sign-in is linked to that account.

Your Google profile picture is kept by the authentication service and is not published on your profile.

**3. Limited Use.** MilSim Ops’ use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. In particular:

- we use Google user data only to provide the sign-in and account features described above;
- we do not transfer Google user data to third parties, except to the providers that host the platform (below), when required by law, or as part of a merger or acquisition with prior notice;
- we do not use Google user data for advertising, including personalized or retargeted ads;
- we do not sell Google user data and do not pass it on to data brokers or information resellers;
- no person on our team reads Google user data, except with your consent, to investigate security issues or abuse, to comply with the law, or when the data is aggregated and anonymized;
- we do not use Google user data to develop, improve or train artificial intelligence or machine-learning models.

**4. Where we store it and who we share it with.** Google user data is stored with Supabase, the provider that hosts the platform’s authentication service and database. It is not passed on to event organizers, advertisers, data brokers or any other third party. Event organizers see only the registration data described in “What other people see”, never your Google account identifier or Google profile picture.

**5. How we protect it.** Sign-in uses OAuth 2.0 with PKCE, handled by our server. We do not store Google API access tokens, because we do not call any Google API after sign-in. In the platform profile, your name and email are encrypted (AES-256-GCM). The copy the authentication service uses is kept at Supabase, with access restricted to the platform’s server. All traffic uses HTTPS, and administrative access is recorded in an audit log.

**6. How long we keep it.** For as long as your account exists. If you abandon Google registration before completing it, the account created is deleted immediately.

**7. How to delete it or revoke access.**

- Request account deletion in [My area → Privacy](/app/privacidade) or by email through the “Contact” section. We delete the data received from Google together with your account within 15 days.
- You can revoke MilSim Ops’ access to your Google account at any time at [myaccount.google.com/permissions](https://myaccount.google.com/permissions). After that, Google sign-in stops working until you authorize it again.
- Questions about Google user data: use the contacts in the “Contact” section.')
on conflict (key, locale) do update set value = excluded.value, updated_at = now();
