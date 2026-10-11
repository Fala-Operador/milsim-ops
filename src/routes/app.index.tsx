import { createFileRoute, Link } from "@tanstack/react-router";
import { carregarBase } from "@/services/db";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataBR } from "@/lib/domain/money";
import { Badge, Cartao, EstadoVazio } from "@/components/ui";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Minha área — MilSim Ops" },
      { name: "description", content: "Painel do participante: próximos eventos, missões e comunidades." },
      { property: "og:title", content: "Minha área — MilSim Ops" },
      { property: "og:description", content: "Painel do participante." },
    ],
  }),
  component: VisaoGeral,
});

function VisaoGeral() {
  const { usuario } = useAuth();
  const base = carregarBase();
  if (!usuario) return null;

  const minhas = base.inscricoes.filter((i) => i.usuarioId === usuario.id && i.status === "confirmada");
  const proximos = minhas
    .map((i) => ({ inscricao: i, evento: base.eventos.find((e) => e.id === i.eventoId)! }))
    .filter((x) => x.evento && new Date(x.evento.inicioEm) >= new Date())
    .sort((a, b) => a.evento.inicioEm.localeCompare(b.evento.inicioEm));

  const minhasMissoes = base.missoes.filter((m) =>
    minhas.some((i) => {
      if (i.eventoId !== m.eventoId) return false;
      return m.publico === "todos" || m.publico === i.exercitoId;
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold uppercase">Olá, {usuario.nomeCompleto.split(" ")[0]}</h1>
        {usuario.autorizacaoResponsavel === "pendente" && (
          <p className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            Sua autorização do responsável está pendente. A inscrição em eventos será liberada após aprovação.
          </p>
        )}
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold uppercase">Próximos eventos e operações</h2>
        {proximos.length === 0 ? (
          <div className="mt-3">
            <EstadoVazio titulo="Nenhum evento futuro" descricao="Explore as operações abertas na página inicial." />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {proximos.map(({ inscricao, evento }) => {
              const exercito = evento.exercitos.find((e) => e.id === inscricao.exercitoId);
              return (
                <Cartao key={inscricao.id}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium">{evento.nome}</h3>
                    <Badge tom="sucesso">Confirmado</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatarDataBR(evento.inicioEm)} · {evento.cidade}/{evento.uf}
                  </p>
                  <p className="text-sm text-muted-foreground">Seu exército: {exercito?.nome}</p>
                  <Link
                    to="/comunidade/$eventoId"
                    params={{ eventoId: evento.id }}
                    className="mt-2 inline-block text-sm text-accent hover:underline"
                  >
                    Acessar comunidade →
                  </Link>
                </Cartao>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold uppercase">Missões ativas</h2>
        {minhasMissoes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma missão disponível no momento.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {minhasMissoes.map((m) => (
              <li key={m.id} className="rounded-md border border-border bg-card p-3 text-sm">
                <span className="font-medium">{m.titulo}</span>
                <span className="text-muted-foreground"> — prazo {formatarDataBR(m.prazo)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
