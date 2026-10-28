import { createFileRoute, Link } from "@tanstack/react-router";
import { DocumentoLegal } from "@/components/DocumentoLegal";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Aviso de privacidade — MilSim Ops" },
      { name: "description", content: "Quais dados o MilSim Ops coleta (inclusive da conta Google), como usa, guarda, compartilha e apaga, e como você exerce seus direitos." },
      { property: "og:title", content: "Aviso de privacidade — MilSim Ops" },
      { property: "og:description", content: "Como a MilSim Ops usa e protege os seus dados pessoais." },
    ],
  }),
  component: () => (
    <DocumentoLegal rotulo={`Documento legal · LGPD · atualizado em ${ATUALIZADO_EM}`} titulo="Aviso de privacidade" clausulas={CLAUSULAS}
      subtitulo="Quais dados pessoais o MilSim Ops coleta, para quê, onde ficam, com quem são compartilhados, por quanto tempo e como você controla cada um." />
  ),
});

const ATUALIZADO_EM = "28/10/2026";
const POLITICA_GOOGLE = "https://developers.google.com/terms/api-services-user-data-policy";

// Cada cláusula ganha título e índice; o conteúdo cobre o que a LGPD e a verificação do Google pedem.
const CLAUSULAS = [
  {
    id: "quem-somos", titulo: "Quem somos",
    texto: <p>O MilSim Ops (milsimops.falaoperador.com.br) é uma plataforma de divulgação e gestão de eventos de airsoft e simulação militar, operada pela Fala Operador, que é a controladora dos dados tratados na plataforma. Cada evento é conduzido pela organização indicada na página dele, que recebe os dados dos seus inscritos conforme a cláusula “Compartilhamento”.</p>,
  },
  {
    id: "dados-coletados", titulo: "Dados que coletamos",
    texto: (
      <>
        <p>Coletamos só o que você informa ou o que o uso da plataforma gera:</p>
        <ul>
          <li><strong>Conta:</strong> e-mail e senha (a senha fica só no serviço de autenticação, nunca junto aos seus dados).</li>
          <li><strong>Perfil de operador:</strong> nome completo, CPF, data de nascimento, WhatsApp, endereço (CEP, logradouro, número, complemento, bairro, cidade e estado) e, se você quiser, foto, Instagram e squad.</li>
          <li><strong>Ficha de emergência (opcional, dado de saúde):</strong> tipo sanguíneo, alergias e um contato de emergência.</li>
          <li><strong>Inscrições e pagamentos:</strong> eventos em que você se inscreveu, situação e valor do pagamento e identificadores da transação no Stripe. Nunca recebemos dados de cartão.</li>
          <li><strong>Organizações:</strong> CNPJ, telefone e dados da conta de recebimento de quem organiza eventos.</li>
          <li><strong>Conteúdo:</strong> publicações e mensagens nas comunidades e no suporte.</li>
          <li><strong>Uso:</strong> contagem de visitas e cliques com identificadores aleatórios, sem nome, e-mail, CPF, telefone ou endereço; endereço IP e dados técnicos do navegador nos registros de segurança.</li>
        </ul>
      </>
    ),
  },
  {
    id: "google", titulo: "Entrar com o Google",
    texto: (
      <>
        <p>Se você escolher “Entrar com o Google”, o Google nos envia, com a sua autorização, somente os dados básicos da sua conta Google (escopos <code>openid</code>, <code>email</code> e <code>profile</code>): <strong>nome, endereço de e-mail e foto de perfil</strong>. Não pedimos acesso a Gmail, Drive, contatos, agenda nem a qualquer outro dado do Google.</p>
        <p>Usamos esses dados apenas para criar a sua conta, identificar você no login e preencher o seu nome no cadastro. O e-mail do Google passa a ser o e-mail da sua conta; a foto fica registrada no serviço de autenticação e não é publicada. Não usamos dados do Google para publicidade, não os vendemos e não os usamos para treinar modelos de inteligência artificial.</p>
        <p>O uso e a transferência, para qualquer outro aplicativo, de informações recebidas das APIs do Google pelo MilSim Ops seguem a <a href={POLITICA_GOOGLE} target="_blank" rel="noopener noreferrer">Política de Dados do Usuário dos Serviços de API do Google</a> (Google API Services User Data Policy), incluindo os requisitos de Uso Limitado (Limited Use).</p>
        <p>Você pode remover o acesso do MilSim Ops à sua conta Google a qualquer momento em <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>.</p>
      </>
    ),
  },
  {
    id: "finalidade", titulo: "Como usamos os dados",
    texto: (
      <ul>
        <li>CPF e data de nascimento identificam o participante e verificam a idade mínima e a autorização de menores.</li>
        <li>Endereço e WhatsApp servem à logística e à comunicação do evento.</li>
        <li>E-mail serve para login, confirmação de conta, recuperação de senha e avisos sobre as suas inscrições.</li>
        <li>Foto, Instagram e squad são opcionais e servem à identificação na comunidade.</li>
        <li>A ficha de emergência serve exclusivamente ao atendimento em caso de acidente durante o evento.</li>
        <li>Dados de pagamento servem para confirmar a vaga, fazer reembolsos e repassar os valores à organização.</li>
        <li>Métricas anônimas servem para melhorar a plataforma e medir a divulgação dos eventos.</li>
      </ul>
    ),
  },
  {
    id: "emergencia", titulo: "Ficha de emergência",
    texto: <p>A organização só vê a ficha com a sua autorização expressa, apenas para eventos em que você tem inscrição confirmada e somente de 7 dias antes até o fim de cada evento. Você pode retirar a autorização ou apagar a ficha a qualquer momento em Meu perfil.</p>,
  },
  {
    id: "compartilhamento", titulo: "Compartilhamento",
    texto: (
      <>
        <p>Não vendemos dados pessoais. Compartilhamos apenas o necessário com:</p>
        <ul>
          <li><strong>Organização do evento:</strong> só os dados de quem se inscreveu no evento dela, com CPF e telefone mascarados nas listagens.</li>
          <li><strong>Supabase:</strong> banco de dados e serviço de autenticação onde os dados ficam guardados.</li>
          <li><strong>Stripe:</strong> processa os pagamentos e recebe o seu e-mail e os dados de pagamento diretamente no ambiente dele; também verifica as contas de recebimento das organizações.</li>
          <li><strong>Google:</strong> somente se você usar “Entrar com o Google”, para autenticar você.</li>
          <li><strong>Cloudflare:</strong> proteção do site contra ataques e verificação anti-robô no cadastro.</li>
          <li><strong>Autoridades:</strong> quando a lei ou uma ordem judicial exigir.</li>
        </ul>
        <p>Dados pessoais não aparecem em páginas públicas nem nas comunidades.</p>
      </>
    ),
  },
  {
    id: "seguranca", titulo: "Armazenamento e segurança",
    texto: (
      <>
        <p>Os dados ficam no banco de dados da plataforma, hospedado pelo Supabase. Nome, CPF, data de nascimento, e-mail, WhatsApp, endereço, ficha de emergência, CNPJ e telefone das organizações são gravados cifrados (AES-256-GCM), e toda a comunicação usa HTTPS.</p>
        <p>O acesso às informações passa sempre pelo servidor, que verifica quem está pedindo; cada organização só acessa os dados dos próprios inscritos e as ações administrativas ficam registradas em auditoria.</p>
        <p>O site guarda no seu navegador apenas o necessário para funcionar: a sessão de login, o tema escolhido, a localização e as preferências de modalidade.</p>
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
        <li>Depois de um pedido de exclusão, apagamos ou anonimizamos os dados pessoais. Guardamos apenas os registros que a lei obriga a manter (por exemplo, os de pagamentos e reembolsos), pelo prazo legal.</li>
      </ul>
    ),
  },
  {
    id: "direitos", titulo: "Seus direitos e exclusão dos dados",
    texto: (
      <>
        <p>Pela LGPD, você pode pedir confirmação e acesso, correção, exportação (portabilidade) e exclusão dos seus dados, além de retirar consentimentos. Faça o pedido em <Link to="/app/privacidade">Minha área → Privacidade</Link>; a administração da plataforma responde em até 15 dias.</p>
        <p>Para excluir a conta e os dados, escolha “Exclusão” nesse formulário. Os dados recebidos do Google são apagados junto com a conta.</p>
      </>
    ),
  },
  {
    id: "contato", titulo: "Contato",
    texto: <p>Dúvidas sobre privacidade: abra um chamado em <Link to="/app/suporte">Minha área → Suporte</Link> ou um pedido em <Link to="/app/privacidade">Minha área → Privacidade</Link>. Se mudarmos este aviso, a data no topo é atualizada.</p>,
  },
];
