import { createFileRoute } from "@tanstack/react-router";
import { Cartao } from "@/components/ui";
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
      <Cartao>
        <h1 className="font-display text-2xl font-semibold uppercase">Termos de uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">Versão {VERSAO_TERMOS}</p>
        <div className="mt-4 space-y-3 text-sm leading-relaxed">
          <p>1. O MilSim Ops é uma plataforma de divulgação e gestão de eventos de simulação militar. Cada evento é organizado e conduzido pela organização responsável indicada na página do evento.</p>
          <p>2. A inscrição reserva a vaga no evento. Pagamentos não são processados pela plataforma; cancelamentos e estornos ficam registrados no histórico da inscrição.</p>
          <p>3. Ao se cadastrar, você declara que os dados informados são verdadeiros e se compromete a manter sua senha em sigilo.</p>
          <p>4. Na comunidade dos eventos, é proibido publicar ofensas, spam, dados pessoais de terceiros ou conteúdo inadequado. A organização e a administração podem ocultar conteúdos e suspender a participação, com registro da justificativa.</p>
          <p>5. Participantes de 15 a 17 anos dependem de autorização do responsável, aprovada pela administração, antes de se inscrever.</p>
        </div>
      </Cartao>
    </div>
  ),
});
