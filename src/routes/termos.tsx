import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { VERSAO_TERMOS } from "@/data/termos";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — MilSim Ops" },
      { name: "description", content: "Termos de uso da plataforma MilSim Ops." },
      { property: "og:title", content: "Termos de uso — MilSim Ops" },
      { property: "og:description", content: "Termos de uso da plataforma MilSim Ops." },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Card>
        <h1 className="font-display text-2xl font-semibold uppercase">Termos de uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">Versão {VERSAO_TERMOS}</p>
        <div className="mt-4 space-y-3 text-sm leading-relaxed">
          <p>1. O MilSim Ops é uma plataforma de divulgação e gestão de eventos de simulação militar. Cada evento é organizado e conduzido pela organização responsável indicada na página do evento.</p>
          <p>2. A inscrição confirmada garante a vaga no evento. Quando há valor a pagar, a vaga fica reservada por cerca de 30 minutos enquanto o pagamento é concluído no ambiente do Stripe; a plataforma não recebe nem guarda dados de cartão. Cancelamentos geram reembolso integral no mesmo meio de pagamento e ficam registrados no histórico da inscrição.</p>
          <p>3. Ao se cadastrar, você declara que os dados informados são verdadeiros e se compromete a manter sua senha em sigilo.</p>
          <p>4. Na comunidade dos eventos, é proibido publicar ofensas, spam, dados pessoais de terceiros ou conteúdo inadequado. A organização e a administração podem ocultar conteúdos e suspender a participação, com registro da justificativa.</p>
          <p>5. Participantes de 15 a 17 anos dependem de autorização do responsável, aprovada pela administração, antes de se inscrever.</p>
        </div>
      </Card>
    </div>
  ),
});
