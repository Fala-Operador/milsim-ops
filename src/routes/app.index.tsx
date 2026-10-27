import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { carregarBase } from "@/services/db";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataBR } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui";

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
        <h1 className="titulo-pagina">Olá, {usuario.nomeCompleto.split(" ")[0]}</h1>
        {usuario.autorizacaoResponsavel === "pendente" && (
          <p className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            Sua autorização do responsável está pendente. A inscrição em eventos será liberada após aprovação.
          </p>
        )}
      </div>

      {proximos.length === 0 ? (
        <EstadoVazio titulo="Nenhuma operação marcada" descricao="Escolha uma operação aberta e garanta a sua vaga." acao={<Button asChild><Link to="/">Ver operações</Link></Button>} />
      ) : (() => {
        const [prox, ...demais] = proximos;
        const ev = prox!.evento;
        const dias = Math.max(0, Math.ceil((new Date(ev.inicioEm).getTime() - Date.now()) / 86400000));
        const exercito = ev.exercitos.find((e) => e.id === prox!.inscricao.exercitoId);
        return (
          <>
            <section aria-label="Próxima operação" className="relative isolate overflow-hidden rounded-lg border border-border bg-black text-white">
              {ev.imagemUrl && <img src={ev.imagemUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-75" />}
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/55 to-transparent" aria-hidden />
              <div className="grid gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-8">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">Sua próxima operação</p>
                  <p className="mt-2 font-display text-4xl font-bold uppercase leading-none sm:text-5xl">{ev.nome}</p>
                  <p className="mt-3 font-mono text-xs uppercase tracking-wider text-white/80">{formatarDataBR(ev.inicioEm)} · {ev.cidade}/{ev.uf} · {exercito?.nome}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button asChild><Link to="/app/ingressos">Ver ingresso</Link></Button>
                    <Button asChild variant="outline" className="border-white/40 bg-black/30 text-white hover:bg-black/50"><Link to="/comunidade/$eventoId" params={{ eventoId: ev.id }}>Comunidade</Link></Button>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-display text-7xl font-bold leading-none tabular-nums">{dias}</p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">{dias === 1 ? "dia para o início" : "dias para o início"}</p>
                </div>
              </div>
            </section>
            {demais.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold">Depois dela</h2>
                <ul className="mt-2 divide-y divide-border border-y border-border">
                  {demais.map(({ inscricao, evento }) => (
                    <li key={inscricao.id} className="flex items-center gap-4 py-3">
                      <span className="w-14 shrink-0 font-display text-2xl font-bold">{formatarDataBR(evento.inicioEm).slice(0, 5)}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{evento.nome}</span><span className="text-sm text-muted-foreground">{evento.cidade}/{evento.uf}</span></span>
                      <Link to="/comunidade/$eventoId" params={{ eventoId: evento.id }} className="text-sm text-accent hover:underline">Comunidade</Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        );
      })()}

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Missões abertas</h2>
          <Link to="/app/missoes" className="text-sm text-accent hover:underline">Ver todas</Link>
        </div>
        {minhasMissoes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma missão aberta agora. O organizador publica as missões antes do evento.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {minhasMissoes.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3 text-sm">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border text-accent" aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>
                </span>
                <span className="min-w-0 flex-1 font-medium">{m.titulo}</span>
                <span className="font-mono text-xs text-muted-foreground">até {formatarDataBR(m.prazo)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
