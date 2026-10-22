import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Aviso de privacidade — MilSim Ops" },
      { name: "description", content: "Como a MilSim Ops usa e protege os seus dados pessoais." },
      { property: "og:title", content: "Aviso de privacidade — MilSim Ops" },
      { property: "og:description", content: "Como a MilSim Ops usa e protege os seus dados pessoais." },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Card>
        <h1 className="font-display text-2xl font-semibold uppercase">Aviso de privacidade</h1>
        <div className="mt-4 space-y-3 text-sm leading-relaxed">
          <p><strong>Finalidade dos dados:</strong> CPF e data de nascimento identificam o participante e verificam elegibilidade etária; endereço e WhatsApp servem à logística e comunicação do evento; foto e Instagram são opcionais de identificação comunitária.</p>
          <p><strong>Ficha de emergência (dado de saúde, opcional):</strong> tipo sanguíneo, alergias e um contato de emergência, informados só se você quiser, servem exclusivamente para atendimento em caso de acidente durante o evento. A organização só tem acesso com a sua autorização expressa, apenas para eventos em que você tem inscrição confirmada e somente de 7 dias antes até o fim de cada evento. Você pode retirar a autorização ou apagar a ficha a qualquer momento em Meu perfil.</p>
          <p><strong>Minimização:</strong> dados pessoais não aparecem em páginas públicas nem em comunidades; a organização de um evento só acessa os dados de quem se inscreveu nele, e as listagens exibem CPF e telefone mascarados.</p>
          <p><strong>Segurança:</strong> a senha é gerenciada pelo serviço de autenticação e nunca fica guardada junto aos seus dados; o acesso às informações passa sempre pelo servidor, que verifica quem está pedindo.</p>
          <p><strong>Pagamentos:</strong> ingressos pagos são cobrados pelo Stripe, que recebe seu e-mail e os dados de pagamento diretamente no ambiente dele. A plataforma guarda apenas a situação do pagamento, o valor e os identificadores da transação, nunca dados de cartão.</p>
          <p><strong>Métricas:</strong> a contagem de visitas e cliques usa identificadores aleatórios e não registra nome, e-mail, CPF, telefone ou endereço.</p>
          <p><strong>Seus direitos:</strong> em Minha área → Privacidade você pode solicitar acesso, correção, exportação e exclusão dos seus dados. As solicitações são respondidas pela administração da plataforma.</p>
        </div>
      </Card>
    </div>
  ),
});
