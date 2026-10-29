-- Cláusula do Google no aviso de privacidade organizada pelos requisitos do Google para a
-- verificação OAuth: dados acessados, uso, usos proibidos (Uso Limitado, crédito, bancos de dados,
-- IA), compartilhamento, proteção, retenção e exclusão, mudanças e contato.
insert into public.site_texts (key, locale, value) values
  ('privacidade.c.google.titulo', 'pt', 'Dados do usuário do Google (Entrar com o Google)'),
  ('privacidade.c.google.titulo', 'en', 'Google user data (Sign in with Google)'),
  ('privacidade.c.google.texto', 'pt', 'O MilSim Ops oferece o login opcional “Entrar com o Google”. Esta cláusula descreve, de forma completa, como o app **acessa, usa, compartilha, protege, guarda e apaga** os dados do usuário do Google. Ela vale para todos que usam o login com o Google. Você também pode criar a conta só com e-mail e senha, sem usar o Google.

**1. Dados acessados.** Pedimos apenas os escopos básicos `openid`, `email` e `profile`, que não são sensíveis. Depois que você autoriza na tela de consentimento do Google, recebemos somente:

- identificador da conta Google (código numérico que identifica a conta);
- endereço de e-mail e a indicação de que ele foi confirmado pelo Google;
- nome e sobrenome da conta Google;
- endereço (URL) da foto de perfil do Google.

Não pedimos e não acessamos Gmail, Google Drive, Contatos, Agenda, Fotos, YouTube, localização, APIs do Google Workspace ou qualquer outro dado do Google. Não recebemos a sua senha do Google.

**2. Uso dos dados.** Usamos os dados do Google somente para oferecer funções que você vê e pediu:

- criar a sua conta no MilSim Ops e identificar você nos próximos logins;
- preencher o seu nome no cadastro (você pode editá-lo);
- usar o e-mail do Google como e-mail da conta, para login, avisos das suas inscrições e recuperação de acesso; se esse e-mail já tiver uma conta confirmada aqui, o login com o Google é vinculado a ela.

A foto do Google fica registrada no serviço de autenticação e não é publicada no seu perfil.

**3. Usos proibidos (Uso Limitado).** O uso e a transferência, para qualquer outro aplicativo, de informações recebidas das APIs do Google pelo MilSim Ops seguem a [Política de Dados do Usuário dos Serviços de API do Google](https://developers.google.com/terms/api-services-user-data-policy) (Google API Services User Data Policy), incluindo os requisitos de Uso Limitado (Limited Use). Por isso, **nunca** usamos nem transferimos dados do Google para:

- publicidade, inclusive anúncios direcionados, personalizados, de redirecionamento (retargeting) ou baseados em interesses;
- venda a corretores de dados, revendedores de informação ou qualquer outra pessoa;
- avaliar crédito, capacidade de pagamento ou concessão de empréstimos;
- criar bancos de dados ou perfis para outros fins além do login descrito acima;
- desenvolver, melhorar ou treinar modelos de inteligência artificial ou aprendizado de máquina, generalizados ou não personalizados;
- qualquer finalidade sem relação com as funções do MilSim Ops que você usa.

Nenhuma pessoa da equipe lê dados do Google, exceto com o seu consentimento expresso, para investigar segurança ou abuso, para cumprir a lei ou quando os dados estiverem agregados e anonimizados.

**4. Compartilhamento, transferência e divulgação.** Os dados do Google ficam só no Supabase, provedor que hospeda o serviço de autenticação e o banco de dados da plataforma e que os trata apenas em nosso nome. Não vendemos, alugamos nem repassamos dados do Google a organizações de eventos, anunciantes, corretores de dados ou outros terceiros. Divulgamos dados apenas se a lei ou uma ordem judicial exigir, ou numa fusão ou aquisição, com aviso prévio a você e as mesmas proteções deste aviso. As organizações de eventos veem só os dados de inscrição descritos em “Quem vê os seus dados”, nunca o identificador ou a foto do Google.

**5. Proteção dos dados.**

- O login usa OAuth 2.0 com PKCE, feito pelo nosso servidor.
- Não guardamos tokens de acesso às APIs do Google, porque não chamamos nenhuma API do Google depois do login.
- No perfil da plataforma, nome e e-mail ficam cifrados (AES-256-GCM).
- A cópia usada pelo serviço de autenticação fica no Supabase, com acesso restrito ao servidor da plataforma pela chave secreta.
- Todo o tráfego usa HTTPS (TLS).
- O acesso administrativo é limitado à equipe que precisa dele e fica registrado em log de auditoria.

**6. Retenção e exclusão.**

- Guardamos os dados do Google enquanto a sua conta existir.
- Se você abandonar o cadastro com o Google antes de concluir, a conta criada é apagada na hora.
- Para apagar os seus dados, peça a exclusão da conta em [Minha área → Privacidade](/app/privacidade) ou pelo e-mail da cláusula “Contato”. Apagamos os dados recebidos do Google junto com a conta, em até 15 dias, inclusive das cópias do serviço de autenticação.
- Você pode revogar a qualquer momento o acesso do MilSim Ops à sua conta Google em [myaccount.google.com/permissions](https://myaccount.google.com/permissions). Depois disso, o login com o Google deixa de funcionar até você autorizar de novo.

**7. Mudanças.** Se mudarmos a forma como usamos dados do Google, atualizamos este aviso e avisamos você na plataforma e por e-mail **antes** da mudança valer. Quando a lei ou o Google exigirem, pedimos o seu consentimento de novo.

**8. Dúvidas.** Para qualquer pergunta sobre dados do Google, use os contatos da cláusula “Contato”.'),
  ('privacidade.c.google.texto', 'en', 'MilSim Ops offers an optional “Sign in with Google” option. This section fully describes how the app **accesses, uses, shares, protects, retains and deletes** Google user data. It applies to everyone who signs in with Google. You can also create an account with only an email address and password, without using Google.

**1. Data accessed.** We request only the basic, non-sensitive `openid`, `email` and `profile` scopes. After you grant permission on Google’s consent screen, we receive only:

- your Google account identifier (a numeric code that identifies the account);
- your email address and whether Google has verified it;
- the first and last name on your Google account;
- the address (URL) of your Google profile picture.

We do not request or access Gmail, Google Drive, Contacts, Calendar, Photos, YouTube, location, Google Workspace APIs or any other Google data. We never receive your Google password.

**2. Data usage.** We use Google user data only to provide user-facing features that you see and request:

- create your MilSim Ops account and identify you on later sign-ins;
- prefill your name during registration (you can edit it);
- use your Google email as your account email, for sign-in, notices about your registrations and account recovery; if that email already belongs to a confirmed account here, Google sign-in is linked to that account.

Your Google profile picture is kept by the authentication service and is not published on your profile.

**3. Prohibited uses (Limited Use).** MilSim Ops’ use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Therefore, we **never** use or transfer Google user data for:

- advertising, including targeted, personalized, retargeted or interest-based ads;
- sale to data brokers, information resellers or anyone else;
- determining credit-worthiness or for lending purposes;
- creating databases or profiles for any purpose other than the sign-in described above;
- developing, improving or training generalized or non-personalized artificial intelligence or machine-learning models;
- any purpose unrelated to the MilSim Ops features you use.

No person on our team reads Google user data, except with your express consent, to investigate security issues or abuse, to comply with the law, or when the data is aggregated and anonymized.

**4. Data sharing, transfer and disclosure.** Google user data is stored only with Supabase, the provider that hosts the platform’s authentication service and database and processes it only on our behalf. We do not sell, rent or pass on Google user data to event organizers, advertisers, data brokers or any other third party. We disclose data only when required by law or a court order, or as part of a merger or acquisition, with prior notice to you and the same protections as this policy. Event organizers see only the registration data described in “What other people see”, never your Google account identifier or Google profile picture.

**5. Data protection.**

- Sign-in uses OAuth 2.0 with PKCE, handled by our server.
- We do not store Google API access tokens, because we do not call any Google API after sign-in.
- In the platform profile, your name and email are encrypted (AES-256-GCM).
- The copy the authentication service uses is kept at Supabase, with access restricted to the platform’s server through a secret key.
- All traffic uses HTTPS (TLS).
- Administrative access is limited to the staff who need it and is recorded in an audit log.

**6. Data retention and deletion.**

- We keep Google user data for as long as your account exists.
- If you abandon Google registration before completing it, the account created is deleted immediately.
- To delete your data, request account deletion in [My area → Privacy](/app/privacidade) or by email through the “Contact” section. We delete the data received from Google together with your account within 15 days, including from the authentication service.
- You can revoke MilSim Ops’ access to your Google account at any time at [myaccount.google.com/permissions](https://myaccount.google.com/permissions). After that, Google sign-in stops working until you authorize it again.

**7. Changes.** If we change how we use Google user data, we update this policy and notify you on the platform and by email **before** the change takes effect. Where required by law or by Google, we ask for your consent again.

**8. Questions.** For any question about Google user data, use the contacts in the “Contact” section.')
on conflict (key, locale) do update set value = excluded.value, updated_at = now();
