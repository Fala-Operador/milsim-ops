import { createFileRoute } from "@tanstack/react-router";
import { Cartao } from "@/components/ui";
import { SeletorEvento, TabelaInscritos, useEventoSelecionado, useEventosOrg } from "@/components/organizacao";

export const Route = createFileRoute("/organizacao/inscritos")({
  head: () => ({
    meta: [
      { title: "Inscritos — Minha organização — MilSim Ops" },
      { name: "description", content: "Lista de inscritos por evento, com exportação em CSV." },
    ],
  }),
  component: PaginaInscritos,
});

function PaginaInscritos() {
  const { eventos } = useEventosOrg();
  const [eventoId, setEventoId] = useEventoSelecionado(eventos);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold uppercase">Inscritos</h2>
        <SeletorEvento eventos={eventos} valor={eventoId} onChange={setEventoId} />
      </div>
      {eventos.length === 0 ? (
        <Cartao><p className="text-sm text-muted-foreground">Nenhum evento criado ainda. Crie um evento no Painel.</p></Cartao>
      ) : (
        <Cartao>{eventoId && <TabelaInscritos eventoId={eventoId} />}</Cartao>
      )}
    </div>
  );
}
