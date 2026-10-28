import { createFileRoute, Link } from "@tanstack/react-router";
import { DOCUMENTOS_LEGAIS_ATUALIZADOS_EM, VERSAO_TERMOS } from "@/data/termos";
import { ContatoControlador, DocumentoLegal } from "@/components/DocumentoLegal";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — MilSim Ops" },
      { name: "description", content: "Regras para usar o MilSim Ops: conta, inscrições, pagamentos, cancelamentos e reembolsos, organizações, comunidade e responsabilidades." },
      { property: "og:title", content: "Termos de uso — MilSim Ops" },
      { property: "og:description", content: "Termos de uso da plataforma MilSim Ops." },
    ],
  }),
  component: Termos,
});

// Mudou uma regra de negócio que aparece aqui (cancelamento, taxas, idade)? Atualize a cláusula,
// a data e, se a mudança for relevante, a versão em src/data/termos.ts.
const CLAUSULAS = [
  {
    id: "aceite", titulo: "Aceite e definições",
    texto: (
      <>
        <p>Estes termos regem o uso do MilSim Ops (milsimops.falaoperador.com.br), operado pela Fala Operador. Ao criar uma conta, você declara que leu e aceita estes termos e o <Link to="/privacidade">Aviso de privacidade</Link>. Se não concordar, não use a plataforma.</p>
        <ul>
          <li><strong>Plataforma:</strong> o site MilSim Ops e os serviços oferecidos nele.</li>
          <li><strong>Participante:</strong> quem tem conta e se inscreve em eventos.</li>
          <li><strong>Organização:</strong> pessoa ou empresa aprovada pela administração para publicar e conduzir eventos.</li>
          <li><strong>Administração:</strong> a equipe da Fala Operador que opera a plataforma.</li>
        </ul>
      </>
    ),
  },
  {
    id: "plataforma", titulo: "O que a plataforma faz",
    texto: (
      <>
        <p>O MilSim Ops divulga eventos de airsoft e simulação militar e oferece as ferramentas para inscrição, pagamento de ingressos, check-in, comunicação com os participantes e comunidade.</p>
        <p><strong>A plataforma não organiza os eventos.</strong> Cada evento é planejado e conduzido pela organização indicada na página dele, que define as regras do jogo, o local, o horário, o equipamento exigido, o regulamento de segurança e as condições específicas do evento.</p>
      </>
    ),
  },
  {
    id: "conta", titulo: "Conta e cadastro",
    texto: (
      <ul>
        <li>A idade mínima é <strong>15 anos</strong>. Participantes de 15 a 17 anos só se inscrevem em eventos depois que a autorização do responsável legal for aprovada pela administração.</li>
        <li>Cada pessoa pode ter <strong>uma conta</strong>: CPF e e-mail não se repetem. Os dados informados devem ser verdadeiros e seus; contas com dados falsos ou de terceiros podem ser desativadas.</li>
        <li>Você é responsável por manter a sua senha em sigilo e por tudo que for feito com a sua conta. Se suspeitar de uso indevido, troque a senha e avise o suporte.</li>
        <li>Você pode entrar com e-mail e senha ou com a sua conta Google. O e-mail precisa ser confirmado antes do primeiro acesso.</li>
        <li>Você pode editar os seus dados em Meu perfil. CPF e e-mail só são corrigidos pelo suporte.</li>
      </ul>
    ),
  },
  {
    id: "inscricao", titulo: "Inscrições",
    texto: (
      <ul>
        <li>A inscrição é feita na página do evento, escolhendo o tipo de ingresso e, quando houver, o exército. Cada pessoa tem <strong>uma inscrição confirmada por evento</strong>.</li>
        <li>A vaga só é garantida com a inscrição <strong>confirmada</strong>. Quando há valor a pagar, a vaga fica reservada por cerca de 30 minutos enquanto o pagamento é concluído; se o pagamento não for concluído nesse prazo, a reserva é liberada sem cobrança.</li>
        <li>Preços, lotes, cupons e vagas são definidos pela organização e podem mudar até a sua inscrição ser confirmada. Cupons e benefícios de recompensa seguem as condições de cada um e não se acumulam.</li>
        <li>A inscrição confirmada gera um ingresso com QR code, pessoal e intransferível, apresentado no check-in do evento.</li>
        <li>Ao se inscrever, você aceita também as regras e o regulamento do evento publicados pela organização.</li>
      </ul>
    ),
  },
  {
    id: "pagamento", titulo: "Pagamentos e taxas",
    texto: (
      <ul>
        <li>Os pagamentos são processados pelo <strong>Stripe</strong>, no ambiente dele. A plataforma não recebe nem guarda dados de cartão.</li>
        <li>O valor pago vai para a organização do evento. A plataforma retém uma taxa sobre cada venda, descontada do valor repassado à organização.</li>
        <li>A organização pode cobrar do comprador uma <strong>taxa de serviço</strong>. Quando houver, ela aparece separada do ingresso na revisão da inscrição, antes do pagamento.</li>
        <li>Se você contestar um pagamento junto ao banco ou à operadora do cartão (chargeback), a contestação é analisada pelo Stripe com a organização, e a inscrição pode ser revista.</li>
      </ul>
    ),
  },
  {
    id: "cancelamento", titulo: "Cancelamento e reembolso",
    texto: (
      <ul>
        <li>Você pode cancelar a sua inscrição em <Link to="/app/ingressos">Meus ingressos</Link>, informando o motivo. O cancelamento gera <strong>reembolso integral</strong> no mesmo meio de pagamento; o prazo para o valor aparecer depende do banco ou da operadora.</li>
        <li>Enquanto o pagamento estiver em processamento (por exemplo, boleto), o cancelamento só é possível depois da confirmação.</li>
        <li>A organização e a administração também podem cancelar uma inscrição, com justificativa, e o reembolso é igualmente integral.</li>
        <li>Se o evento for <strong>cancelado</strong>, todas as inscrições são canceladas e reembolsadas integralmente, e os benefícios usados voltam a quem os usou, dentro do prazo de cada um.</li>
        <li>Cancelamentos e reembolsos ficam registrados no histórico da inscrição. O ingresso cancelado deixa de valer no check-in.</li>
      </ul>
    ),
  },
  {
    id: "evento", titulo: "Participação no evento e segurança",
    texto: (
      <ul>
        <li>Airsoft e simulação militar envolvem atividade física e riscos. Use sempre o equipamento de proteção exigido pela organização, principalmente a proteção dos olhos, e siga as orientações da equipe do evento.</li>
        <li>Você é responsável pelo seu equipamento e por cumprir a legislação aplicável, inclusive quanto à aquisição, ao porte e ao transporte de réplicas e armas de pressão.</li>
        <li>A organização pode recusar a entrada ou retirar do jogo quem descumprir o regulamento ou colocar outras pessoas em risco.</li>
        <li>A condução do evento, a segurança do local e o atendimento no campo são responsabilidade da organização. A ficha de emergência existe para ajudar nesse atendimento e é opcional.</li>
      </ul>
    ),
  },
  {
    id: "organizacoes", titulo: "Organizações",
    texto: (
      <>
        <p>Qualquer conta pode pedir para organizar eventos; a administração analisa e aprova. Ao organizar eventos na plataforma, a organização se compromete a:</p>
        <ul>
          <li>publicar informações verdadeiras e completas sobre o evento (data, local, regras, preços e o que está incluído) e cumprir o que divulgou;</li>
          <li>manter uma conta de recebimento ativa no Stripe para vender ingressos pagos, aceitando os termos do Stripe;</li>
          <li>atender os participantes, conduzir o evento com segurança e cumprir a legislação aplicável, inclusive a de defesa do consumidor;</li>
          <li>arcar com os reembolsos dos cancelamentos e do cancelamento do evento;</li>
          <li>usar os dados dos inscritos só para conduzir o evento, protegê-los conforme a LGPD e não repassá-los a terceiros;</li>
          <li>moderar a comunidade do seu evento de forma justa, registrando as justificativas.</li>
        </ul>
        <p>A taxa da plataforma vigente aparece no Financeiro da organização e vale para as vendas feitas a partir de cada alteração; cada venda guarda a taxa do momento.</p>
      </>
    ),
  },
  {
    id: "comunidade", titulo: "Comunidade e conteúdo",
    texto: (
      <>
        <p>Nas comunidades, no perfil e no suporte, é proibido publicar:</p>
        <ul>
          <li>ofensas, ameaças, assédio, discriminação ou discurso de ódio;</li>
          <li>conteúdo sexual, violência real, apologia a crimes ou a drogas ilícitas;</li>
          <li>dados pessoais de outras pessoas sem autorização;</li>
          <li>spam, golpes, venda de itens proibidos ou propaganda não autorizada;</li>
          <li>conteúdo que viole direitos autorais ou de imagem de terceiros.</li>
        </ul>
        <p>Você é responsável pelo que publica e mantém os direitos sobre o seu conteúdo. Ao publicar, você autoriza a plataforma a exibi-lo para o público escolhido (por exemplo, seguidores, membros de um fórum ou inscritos de um evento), enquanto ele estiver publicado.</p>
        <p>Qualquer pessoa pode denunciar um conteúdo. A organização do evento, os moderadores dos fóruns e a administração podem ocultar conteúdos e suspender a participação de quem descumprir estas regras, sempre com registro da justificativa. Publicações com termos proibidos são bloqueadas automaticamente.</p>
      </>
    ),
  },
  {
    id: "recompensas", titulo: "Insígnias, missões e recompensas",
    texto: <p>Insígnias, pontos de missões e benefícios de recompensa não têm valor em dinheiro, são pessoais e intransferíveis e seguem as condições divulgadas em cada campanha (prazos, limites e eventos em que valem). A participação só conta quando o evento é concluído e a presença foi registrada no check-in. Operações registradas por você no perfil, fora da plataforma, não contam para insígnias nem recompensas.</p>,
  },
  {
    id: "suspensao", titulo: "Suspensão e encerramento",
    texto: (
      <>
        <p>A administração pode desativar contas que descumpram estes termos, usem dados falsos, pratiquem fraude ou coloquem outras pessoas em risco, sempre com justificativa registrada. Você pode contestar pelo suporte.</p>
        <p>Você pode pedir o encerramento da sua conta a qualquer momento em <Link to="/app/privacidade">Minha área → Privacidade</Link>. Inscrições confirmadas em eventos futuros devem ser canceladas antes, para receber o reembolso.</p>
      </>
    ),
  },
  {
    id: "propriedade", titulo: "Propriedade intelectual",
    texto: <p>A marca, o site, o código e o visual do MilSim Ops pertencem à Fala Operador. Textos, imagens e marcas de eventos e organizações pertencem a quem os publicou. Não é permitido copiar a plataforma, coletar dados dela de forma automatizada nem usá-la para fins diferentes dos previstos nestes termos.</p>,
  },
  {
    id: "responsabilidade", titulo: "Responsabilidades e disponibilidade",
    texto: (
      <ul>
        <li>Trabalhamos para manter a plataforma disponível e segura, mas ela pode passar por manutenções e instabilidades, inclusive de serviços de terceiros como pagamentos, e-mail e hospedagem.</li>
        <li>A plataforma não responde pela realização, pelo conteúdo nem pelas condições dos eventos, que são da organização, nem por conteúdos publicados por usuários, ressalvados os direitos garantidos pelo Código de Defesa do Consumidor.</li>
        <li>Links para sites de terceiros (por exemplo, Instagram ou grupos de WhatsApp) seguem as regras desses sites.</li>
      </ul>
    ),
  },
  {
    id: "privacidade", titulo: "Privacidade",
    texto: <p>O tratamento dos seus dados pessoais está descrito no <Link to="/privacidade">Aviso de privacidade</Link>, que faz parte destes termos.</p>,
  },
  {
    id: "alteracoes", titulo: "Alterações destes termos",
    texto: <p>Podemos atualizar estes termos para refletir mudanças na plataforma ou na lei. A versão e a data ficam no topo da página. Mudanças relevantes são avisadas na plataforma antes de valer, e continuar usando a plataforma depois disso significa aceitar a nova versão.</p>,
  },
  {
    id: "lei", titulo: "Lei aplicável e foro",
    texto: <p>Estes termos seguem a lei brasileira, incluindo o Código de Defesa do Consumidor, o Marco Civil da Internet e a LGPD. Eventuais conflitos podem ser resolvidos no foro do domicílio do consumidor.</p>,
  },
  {
    id: "contato", titulo: "Contato",
    texto: <ContatoControlador />,
  },
];

function Termos() {
  return (
    <DocumentoLegal rotulo={`Documento legal · ${VERSAO_TERMOS} · atualizado em ${DOCUMENTOS_LEGAIS_ATUALIZADOS_EM}`} titulo="Termos de uso" clausulas={CLAUSULAS}
      subtitulo="Regras para usar o MilSim Ops: conta, inscrições, pagamentos, cancelamentos e reembolsos, organizações, comunidade e responsabilidades. Ao criar a conta, você aceita esta versão." />
  );
}
