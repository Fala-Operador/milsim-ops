import { createFileRoute, Link } from "@tanstack/react-router";
import { ContatoControlador, DocumentoLegal } from "@/components/DocumentoLegal";
import { DOCUMENTOS_LEGAIS_ATUALIZADOS_EM } from "@/data/termos";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Aviso de privacidade — MilSim Ops" },
      { name: "description", content: "Quais dados o MilSim Ops coleta (inclusive da conta Google), para quê e com qual base legal, quem vê, com quem compartilha, onde guarda, por quanto tempo e como você exerce seus direitos." },
      { property: "og:title", content: "Aviso de privacidade — MilSim Ops" },
      { property: "og:description", content: "Como a MilSim Ops usa e protege os seus dados pessoais." },
    ],
  }),
  component: () => (
    <DocumentoLegal rotulo={`Documento legal · LGPD · atualizado em ${DOCUMENTOS_LEGAIS_ATUALIZADOS_EM}`} titulo="Aviso de privacidade" clausulas={CLAUSULAS}
      subtitulo="Quais dados pessoais o MilSim Ops coleta, para quê, com qual base legal, quem vê, com quem são compartilhados, onde ficam, por quanto tempo e como você controla cada um." />
  ),
});

const POLITICA_GOOGLE = "https://developers.google.com/terms/api-services-user-data-policy";

// Cada cláusula ganha título e índice; o conteúdo cobre o que a LGPD e a verificação do Google pedem.
// Ao mudar o que a plataforma coleta ou com quem compartilha, atualize a cláusula e a data.
const CLAUSULAS = [
  {
    id: "quem-somos", titulo: "Quem somos",
    texto: (
      <>
        <p>O MilSim Ops (milsimops.falaoperador.com.br) é uma plataforma de divulgação e gestão de eventos de airsoft e simulação militar: agenda de operações, inscrição e pagamento de ingressos, check-in por QR code, comunidades dos eventos e perfil do operador. A plataforma é operada pela Fala Operador, que é a <strong>controladora</strong> dos dados pessoais tratados nela (LGPD, art. 5º, VI).</p>
        <p>Cada evento é conduzido pela organização indicada na página dele. Ela recebe os dados dos seus inscritos, conforme a cláusula “Compartilhamento”, e responde pelo uso que fizer deles fora da plataforma.</p>
        <ContatoControlador />
      </>
    ),
  },
  {
    id: "resumo", titulo: "Resumo",
    texto: (
      <ul>
        <li>Coletamos os dados necessários para criar a sua conta, inscrever você em eventos, receber pagamentos e manter a comunidade segura.</li>
        <li><strong>Não vendemos dados pessoais</strong>, não usamos seus dados para publicidade de terceiros e não usamos dados do Google para nada além do login.</li>
        <li>CPF, e-mail, telefone e endereço <strong>nunca</strong> aparecem em páginas públicas nem nas comunidades.</li>
        <li>Os dados pessoais mais sensíveis ficam <strong>cifrados</strong> no banco de dados.</li>
        <li>Você pode pedir acesso, correção, exportação e exclusão dos seus dados a qualquer momento.</li>
      </ul>
    ),
  },
  {
    id: "dados-coletados", titulo: "Dados que coletamos",
    texto: (
      <>
        <p><strong>Dados que você informa:</strong></p>
        <ul>
          <li><strong>Conta:</strong> e-mail e senha. A senha fica só no serviço de autenticação, guardada de forma irreversível (hash), e nunca junto aos seus outros dados.</li>
          <li><strong>Perfil de operador:</strong> nome completo, CPF, data de nascimento, WhatsApp e endereço (CEP, logradouro, número, complemento, bairro, cidade e estado). Opcionais: foto, nome de exibição, Instagram e squad.</li>
          <li><strong>Ficha de emergência (opcional, dado de saúde):</strong> tipo sanguíneo, alergias e um contato de emergência.</li>
          <li><strong>Preferências:</strong> modalidades favoritas, tema claro ou escuro, privacidade do perfil, notificações silenciadas e autorização (ou não) para comunicações promocionais.</li>
          <li><strong>Organizações:</strong> nome, CNPJ (se houver) e telefone de quem pede para organizar eventos, e os dados da conta de recebimento, informados diretamente ao Stripe.</li>
          <li><strong>Conteúdo:</strong> publicações, respostas, fotos e denúncias nas comunidades; mensagens e anexos no suporte; operações registradas no perfil; entregas de missões; notas fiscais de equipamentos que você guardar no perfil.</li>
        </ul>
        <p><strong>Dados gerados pelo uso:</strong></p>
        <ul>
          <li><strong>Inscrições e pagamentos:</strong> eventos em que você se inscreveu, tipo de ingresso, exército, cupom usado, situação e valor do pagamento, reembolsos e identificadores da transação no Stripe. <strong>Nunca recebemos dados de cartão.</strong></li>
          <li><strong>Participação:</strong> check-ins, presença, insígnias, recompensas e pontos de missões.</li>
          <li><strong>Registros de segurança:</strong> endereço IP, data e hora de acesso e dados técnicos do navegador, guardados pelos nossos provedores de hospedagem e autenticação.</li>
          <li><strong>Métricas de uso:</strong> visitas e cliques contados com identificadores aleatórios, sem nome, e-mail, CPF, telefone ou endereço.</li>
        </ul>
        <p><strong>Localização aproximada (opcional):</strong> se você permitir, o navegador informa a sua posição só para descobrirmos a cidade e mostrarmos eventos próximos. As coordenadas são arredondadas (cerca de 1 km) antes de consultar o serviço de mapas e <strong>nunca são gravadas</strong>; fica guardada apenas a cidade escolhida, no seu próprio navegador.</p>
      </>
    ),
  },
  {
    id: "google", titulo: "Entrar com o Google",
    texto: (
      <>
        <p>Se você escolher “Entrar com o Google”, o Google nos envia, com a sua autorização, somente os dados básicos da sua conta Google (escopos <code>openid</code>, <code>email</code> e <code>profile</code>): <strong>nome, endereço de e-mail e foto de perfil</strong>, além de um identificador da conta. Não pedimos acesso a Gmail, Drive, contatos, agenda nem a qualquer outro dado do Google.</p>
        <p><strong>Como usamos:</strong> apenas para criar a sua conta, identificar você nos próximos logins e preencher o seu nome no cadastro. O e-mail do Google passa a ser o e-mail da sua conta e, se ele já tiver uma conta confirmada aqui, o login com o Google é vinculado a ela. A foto do Google fica registrada no serviço de autenticação e não é publicada.</p>
        <p><strong>O que não fazemos:</strong> não usamos dados do Google para publicidade, não os vendemos, não os compartilhamos com organizações de eventos nem com outros terceiros além dos provedores que hospedam a plataforma, e não os usamos para treinar modelos de inteligência artificial.</p>
        <p>O uso e a transferência, para qualquer outro aplicativo, de informações recebidas das APIs do Google pelo MilSim Ops seguem a <a href={POLITICA_GOOGLE} target="_blank" rel="noopener noreferrer">Política de Dados do Usuário dos Serviços de API do Google</a> (Google API Services User Data Policy), incluindo os requisitos de Uso Limitado (Limited Use).</p>
        <p><strong>Como remover:</strong> você pode tirar o acesso do MilSim Ops à sua conta Google a qualquer momento em <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>. Os dados recebidos do Google são apagados junto com a sua conta (cláusula “Exclusão da conta”).</p>
      </>
    ),
  },
  {
    id: "finalidade", titulo: "Para que usamos e com qual base legal",
    texto: (
      <>
        <p>Cada uso tem uma base legal da LGPD (arts. 7º e 11):</p>
        <ul>
          <li><strong>Criar e manter a sua conta, inscrever você em eventos, emitir o ingresso com QR code, fazer o check-in e prestar suporte</strong>: execução do contrato que você aceita nos <Link to="/termos">Termos de uso</Link> (art. 7º, V).</li>
          <li><strong>CPF e data de nascimento</strong>: identificar cada participante com uma conta única, verificar a idade mínima e exigir a autorização do responsável para menores (art. 7º, V, e art. 14).</li>
          <li><strong>Endereço e WhatsApp</strong>: logística e comunicação do evento pela organização (art. 7º, V).</li>
          <li><strong>E-mail</strong>: login, confirmação de conta, recuperação de senha e avisos sobre as suas inscrições (art. 7º, V).</li>
          <li><strong>Pagamentos, reembolsos e repasses</strong>: execução do contrato e cumprimento de obrigações legais e fiscais (art. 7º, II e V).</li>
          <li><strong>Ficha de emergência</strong>: atendimento em caso de acidente durante o evento, só com o seu consentimento específico (art. 11, I) e, numa emergência, para proteger a sua vida (art. 11, II, “e”).</li>
          <li><strong>Comunicações promocionais</strong>: só se você autorizar no cadastro (art. 7º, I); você pode desistir quando quiser.</li>
          <li><strong>Segurança, prevenção a fraudes, moderação e registros de acesso</strong>: legítimo interesse e cumprimento do Marco Civil da Internet (art. 7º, II e IX).</li>
          <li><strong>Métricas anônimas</strong>: melhorar a plataforma e medir a divulgação dos eventos, sem identificar você (art. 7º, IX).</li>
          <li><strong>Defesa em processos</strong>: exercício regular de direitos (art. 7º, VI).</li>
        </ul>
        <p>Não tomamos decisões sobre você só com base em tratamento automatizado. As exceções são automáticas e reversíveis: a verificação anti-robô do login e do cadastro, e o bloqueio de publicações que contenham termos proibidos. Se discordar de um bloqueio, fale com o suporte.</p>
      </>
    ),
  },
  {
    id: "quem-ve", titulo: "O que outras pessoas veem",
    texto: (
      <ul>
        <li><strong>Visitantes e outros usuários:</strong> só o seu nome de exibição, a foto e o que você publicar nas comunidades, conforme a privacidade do seu perfil. Perfil <strong>privado</strong> mostra as publicações e os blocos do perfil de operador só a seguidores que você aprovar. Contas de 15 a 17 anos começam privadas.</li>
        <li><strong>Comunidade de um evento:</strong> só os inscritos confirmados e a organização do evento.</li>
        <li><strong>Organização do evento:</strong> os dados dos inscritos nos eventos dela (nome, CPF e telefone mascarados nas listagens, e-mail, ingresso, exército, pagamento e presença) e, com a sua autorização, a ficha de emergência.</li>
        <li><strong>Administração da plataforma:</strong> os dados necessários para suporte, moderação, aprovação de organizadores e de menores, e atendimento aos pedidos LGPD. Ações administrativas ficam registradas em auditoria.</li>
        <li><strong>Ninguém</strong> vê as suas notas fiscais de equipamentos: só você, por link temporário.</li>
      </ul>
    ),
  },
  {
    id: "emergencia", titulo: "Ficha de emergência",
    texto: <p>A ficha é opcional. A organização só a vê com a sua autorização expressa, apenas nos eventos em que você tem inscrição confirmada e somente de 7 dias antes do início até o fim de cada evento; fora disso ela nem chega ao navegador da organização. Você pode retirar a autorização ou apagar a ficha a qualquer momento em Meu perfil.</p>,
  },
  {
    id: "compartilhamento", titulo: "Compartilhamento",
    texto: (
      <>
        <p>Não vendemos nem alugamos dados pessoais. Compartilhamos apenas o necessário com:</p>
        <ul>
          <li><strong>Organização do evento:</strong> os dados dos inscritos no evento dela, como descrito acima, para conduzir o evento.</li>
          <li><strong>Supabase</strong> (banco de dados, autenticação e armazenamento de arquivos): onde os dados ficam guardados.</li>
          <li><strong>Stripe</strong> (pagamentos): processa os pagamentos no ambiente dele, recebe o seu e-mail e os dados de pagamento diretamente de você e verifica as contas de recebimento das organizações.</li>
          <li><strong>Resend</strong> (envio de e-mails): recebe o seu e-mail para entregar as mensagens de confirmação de conta e de recuperação de senha.</li>
          <li><strong>Cloudflare</strong> (rede e segurança): entrega o site, protege contra ataques e faz a verificação anti-robô no login e no cadastro.</li>
          <li><strong>Google</strong>: somente se você usar “Entrar com o Google”, para autenticar você.</li>
          <li><strong>OpenStreetMap (Nominatim)</strong>: recebe coordenadas arredondadas, sem nenhum dado seu, só se você pedir para usar a sua localização.</li>
          <li><strong>ViaCEP</strong>: recebe só o CEP digitado, para preencher o endereço.</li>
          <li><strong>Autoridades</strong>: quando a lei ou uma ordem judicial exigir.</li>
        </ul>
        <p>Esses provedores tratam os dados em nosso nome e só para as finalidades acima.</p>
      </>
    ),
  },
  {
    id: "transferencia", titulo: "Transferência internacional",
    texto: <p>Alguns provedores (Supabase, Stripe, Cloudflare, Resend e Google) podem processar dados em servidores fora do Brasil. Nesses casos, a transferência segue o art. 33 da LGPD: os provedores adotam cláusulas contratuais e padrões de segurança reconhecidos, e os dados continuam protegidos como descrito neste aviso.</p>,
  },
  {
    id: "cookies", titulo: "Cookies e armazenamento no navegador",
    texto: (
      <>
        <p>Usamos apenas o necessário para o site funcionar. <strong>Não usamos cookies de publicidade nem rastreadores de terceiros.</strong></p>
        <ul>
          <li><strong>Sessão:</strong> cookies que mantêm você logado e protegem o login (essenciais).</li>
          <li><strong>Segurança:</strong> cookies da Cloudflare para proteção contra ataques e verificação anti-robô.</li>
          <li><strong>Preferências:</strong> tema, cidade escolhida, modalidades e rascunhos de mensagens, guardados no próprio navegador.</li>
          <li><strong>Métricas anônimas:</strong> um identificador aleatório de visitante e de sessão, sem dados pessoais.</li>
        </ul>
        <p>Você pode apagar esses dados nas configurações do navegador; sem os cookies de sessão, não é possível ficar logado.</p>
      </>
    ),
  },
  {
    id: "seguranca", titulo: "Armazenamento e segurança",
    texto: (
      <>
        <p>Nome completo, CPF, data de nascimento, e-mail, WhatsApp, endereço, ficha de emergência, CNPJ e telefone das organizações são gravados <strong>cifrados</strong> (AES-256-GCM): nem o banco de dados, nem as cópias de segurança guardam esses dados legíveis. Toda a comunicação usa HTTPS.</p>
        <p>O acesso aos dados passa sempre pelo servidor, que verifica quem está pedindo: o seu navegador recebe só o que você pode ver, e cada organização só acessa os dados dos próprios inscritos. Notas fiscais e anexos do suporte ficam em armazenamento privado. Ações administrativas ficam registradas em auditoria.</p>
        <p>Se ocorrer um incidente de segurança que possa trazer risco ou dano relevante, avisaremos as pessoas afetadas e a Autoridade Nacional de Proteção de Dados (ANPD), como manda a LGPD.</p>
      </>
    ),
  },
  {
    id: "retencao", titulo: "Por quanto tempo guardamos",
    texto: (
      <ul>
        <li>Os dados da conta e do perfil ficam guardados enquanto a conta existir.</li>
        <li>A ficha de emergência pode ser apagada por você a qualquer momento.</li>
        <li>Se você desistir do cadastro com o Google antes de concluí-lo, a conta criada é apagada na hora.</li>
        <li>Registros de acesso ficam guardados pelos provedores de hospedagem e autenticação pelo prazo necessário à segurança e exigido pelo Marco Civil da Internet.</li>
        <li>Registros de pagamentos, reembolsos e repasses ficam guardados pelo prazo exigido pela legislação fiscal e de defesa do consumidor.</li>
        <li>Depois de um pedido de exclusão, apagamos ou anonimizamos os dados pessoais, mantendo só o que a lei obriga a guardar, pelo prazo legal.</li>
      </ul>
    ),
  },
  {
    id: "menores", titulo: "Menores de idade",
    texto: <p>A idade mínima para criar uma conta é 15 anos. Participantes de 15 a 17 anos só podem se inscrever em eventos depois que a autorização do responsável legal for aprovada pela administração, e o perfil deles começa privado na comunidade. Se soubermos de uma conta de menor de 15 anos, ela será desativada.</p>,
  },
  {
    id: "direitos", titulo: "Seus direitos",
    texto: (
      <>
        <p>Pela LGPD (art. 18), você pode pedir a qualquer momento:</p>
        <ul>
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados (a maioria você mesmo edita em Meu perfil; CPF e e-mail são corrigidos pelo suporte);</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei;</li>
          <li>portabilidade (exportação) dos seus dados;</li>
          <li>informação sobre com quem compartilhamos os seus dados;</li>
          <li>retirada de consentimentos (ficha de emergência, comunicações promocionais), sem afetar o que já foi feito antes;</li>
          <li>revisão de decisões automatizadas.</li>
        </ul>
        <p>Faça o pedido em <Link to="/app/privacidade">Minha área → Privacidade</Link> ou pelos contatos da cláusula “Contato”. Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (<a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">gov.br/anpd</a>).</p>
      </>
    ),
  },
  {
    id: "exclusao", titulo: "Exclusão da conta",
    texto: <p>Para excluir a conta e os dados, escolha “Exclusão” em <Link to="/app/privacidade">Minha área → Privacidade</Link> ou peça pelos contatos da cláusula “Contato”. A administração confirma o pedido, desativa a conta e apaga ou anonimiza os dados pessoais, inclusive os recebidos do Google. Ficam só os registros que a lei obriga a guardar, pelo prazo legal.</p>,
  },
  {
    id: "alteracoes", titulo: "Alterações deste aviso",
    texto: <p>Se mudarmos este aviso, a data no topo é atualizada. Mudanças relevantes, como novos usos ou novos destinatários dos dados, são avisadas na plataforma antes de valer.</p>,
  },
  {
    id: "contato", titulo: "Contato",
    texto: (
      <>
        <p>Dúvidas, pedidos e reclamações sobre privacidade:</p>
        <ContatoControlador />
      </>
    ),
  },
];
