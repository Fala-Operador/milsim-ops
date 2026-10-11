import { createFileRoute } from "@tanstack/react-router";
import { Cartao } from "@/components/ui";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Aviso de privacidade (demonstrativo) — MilSim Ops" },
      { name: "description", content: "Aviso de privacidade demonstrativo: finalidade dos dados e preparação para LGPD." },
      { property: "og:title", content: "Aviso de privacidade (demonstrativo) — MilSim Ops" },
      { property: "og:description", content: "Aviso de privacidade demonstrativo." },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Cartao>
        <h1 className="font-display text-2xl font-semibold uppercase">Aviso de privacidade — demonstrativo</h1>
        <div className="mt-4 space-y-3 text-sm leading-relaxed">
          <p><strong>Finalidade dos dados:</strong> CPF e data de nascimento identificam o participante e verificam elegibilidade etária; endereço e WhatsApp servem à logística e comunicação do evento; foto e Instagram são opcionais de identificação comunitária.</p>
          <p><strong>Minimização:</strong> dados pessoais não aparecem em páginas públicas nem em comunidades; listagens autorizadas exibem CPF e telefone mascarados.</p>
          <p><strong>Seus direitos:</strong> em Minha área → Privacidade você pode solicitar acesso, correção, exportação e exclusão de dados (fluxo demonstrativo).</p>
          <p><strong>Limitações:</strong> este protótipo não garante conformidade jurídica. Para produção serão necessários: autenticação no servidor, armazenamento protegido, política de retenção, validação jurídica dos fluxos, tratamento adequado de dados de adolescentes, revisão da necessidade de cada campo e proteção de uploads.</p>
        </div>
      </Cartao>
    </div>
  ),
});
