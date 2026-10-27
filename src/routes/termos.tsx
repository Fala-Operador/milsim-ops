import { createFileRoute } from "@tanstack/react-router";
import { VERSAO_TERMOS } from "@/data/termos";
import { DocumentoLegal } from "@/components/DocumentoLegal";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — MilSim Ops" },
      { name: "description", content: "Termos de uso da plataforma MilSim Ops." },
      { property: "og:title", content: "Termos de uso — MilSim Ops" },
      { property: "og:description", content: "Termos de uso da plataforma MilSim Ops." },
    ],
  }),
  component: Termos,
});

// O texto das cláusulas não muda; o redesign só dá título e índice a cada uma.
const CLAUSULAS = [
  { id: "plataforma", titulo: "A plataforma", texto: "O MilSim Ops é uma plataforma de divulgação e gestão de eventos de simulação militar. Cada evento é organizado e conduzido pela organização responsável indicada na página do evento." },
  { id: "inscricao", titulo: "Inscrição e pagamento", texto: "A inscrição confirmada garante a vaga no evento. Quando há valor a pagar, a vaga fica reservada por cerca de 30 minutos enquanto o pagamento é concluído no ambiente do Stripe; a plataforma não recebe nem guarda dados de cartão. Cancelamentos geram reembolso integral no mesmo meio de pagamento e ficam registrados no histórico da inscrição." },
  { id: "cadastro", titulo: "Cadastro e senha", texto: "Ao se cadastrar, você declara que os dados informados são verdadeiros e se compromete a manter sua senha em sigilo." },
  { id: "comunidade", titulo: "Conduta na comunidade", texto: "Na comunidade dos eventos, é proibido publicar ofensas, spam, dados pessoais de terceiros ou conteúdo inadequado. A organização e a administração podem ocultar conteúdos e suspender a participação, com registro da justificativa." },
  { id: "menores", titulo: "Participantes menores de idade", texto: "Participantes de 15 a 17 anos dependem de autorização do responsável, aprovada pela administração, antes de se inscrever." },
];

function Termos() {
  return (
    <DocumentoLegal rotulo={`Documento legal · ${VERSAO_TERMOS}`} titulo="Termos de uso" clausulas={CLAUSULAS}
      subtitulo="Regras para usar o MilSim Ops: inscrições, pagamentos, cadastro e comunidade. Ao criar a conta, você aceita esta versão." />
  );
}
