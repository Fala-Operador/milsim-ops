import { createFileRoute } from "@tanstack/react-router";
import { Cartao } from "@/components/ui";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso (demonstrativos) — MilSim Ops" },
      { name: "description", content: "Termos de uso demonstrativos do protótipo. Sem validade jurídica." },
      { property: "og:title", content: "Termos de uso (demonstrativos) — MilSim Ops" },
      { property: "og:description", content: "Termos demonstrativos do protótipo." },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Cartao>
        <h1 className="font-display text-2xl font-semibold uppercase">Termos de uso — demonstrativos</h1>
        <p className="mt-2 text-sm text-muted-foreground">Versão termos-demo-v1 · documento fictício, sem validade jurídica.</p>
        <div className="mt-4 space-y-3 text-sm leading-relaxed">
          <p>1. Esta plataforma é um protótipo para demonstração de eventos de simulação militar. Nenhum serviço real é prestado.</p>
          <p>2. Inscrições, pagamentos, estornos e comunicações são integralmente simulados.</p>
          <p>3. Utilize apenas dados fictícios. Não insira dados pessoais reais.</p>
          <p>4. A conformidade jurídica (incluindo LGPD) será tratada na etapa de produção e não é garantida por este protótipo.</p>
        </div>
      </Cartao>
    </div>
  ),
});
