import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { carregarBase } from "@/services/db";
import { useAuth } from "@/contexts/AuthContext";
import { papelNoEvento } from "@/services/comunidade";
import { formatarDataBR } from "@/lib/domain/money";
import { Badge, Botao, Cartao, EstadoVazio } from "@/components/ui";

export const Route = createFileRoute("/app/comunidades")({
  head: () => ({
    meta: [
      { title: "Minhas comunidades — MilSim Ops" },
      { name: "description", content: "Lista das comunidades de eventos das quais você participa, com busca e filtros." },
      { property: "og:title", content: "Minhas comunidades — MilSim Ops" },
      { property: "og:description", content: "Comunidades de eventos das quais você participa." },
    ],
  }),
  component: MinhasComunidades,
});

type FiltroStatus = "todas" | "proximos" | "encerrados";

function MinhasComunidades() {
  const { usuario } = useAuth();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const base = carregarBase();

  const comunidades = useMemo(() => {
    if (!usuario) return [];
    return base.eventos
      .filter((e) => papelNoEvento(base, usuario, e.id) !== null)
      .map((evento) => {
        const papel = papelNoEvento(base, usuario, evento.id);
        const inscricao = base.inscricoes.find(
          (i) => i.eventoId === evento.id && i.usuarioId === usuario.id && i.status === "confirmada",
        );
        const exercito = inscricao
          ? evento.exercitos.find((x) => x.id === inscricao.exercitoId)
          : undefined;
        const foruns = base.foruns.filter((f) => f.eventoId === evento.id && f.status === "ativo");
        const publicacoes = base.publicacoes.filter((p) => p.eventoId === evento.id && !p.oculta && !p.removidaPeloAutor);
        const futuro = new Date(evento.inicioEm) >= new Date();
        return { evento, papel, exercito, totalForuns: foruns.length, totalPublicacoes: publicacoes.length, futuro };
      });
  }, [base, usuario]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return comunidades
      .filter((c) => {
        if (filtroStatus === "proximos" && !c.futuro) return false;
        if (filtroStatus === "encerrados" && c.futuro) return false;
        if (!termo) return true;
        return (
          c.evento.nome.toLowerCase().includes(termo) ||
          c.evento.cidade.toLowerCase().includes(termo) ||
          c.evento.uf.toLowerCase().includes(termo) ||
          (c.exercito?.nome.toLowerCase().includes(termo) ?? false)
        );
      })
      .sort((a, b) => Number(b.futuro) - Number(a.futuro) || a.evento.inicioEm.localeCompare(b.evento.inicioEm));
  }, [comunidades, busca, filtroStatus]);

  if (!usuario) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold uppercase">Minhas comunidades</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comunidades dos eventos em que você participa ou gerencia.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex-1">
          <span className="sr-only">Buscar comunidade</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome do evento, cidade ou exército…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </label>
        <div className="flex gap-1" role="group" aria-label="Filtrar por período">
          {(
            [
              ["todas", "Todas"],
              ["proximos", "Próximos"],
              ["encerrados", "Encerrados"],
            ] as const
          ).map(([valor, rotulo]) => (
            <Botao
              key={valor}
              variante={filtroStatus === valor ? "primario" : "secundario"}
              onClick={() => setFiltroStatus(valor)}
              aria-pressed={filtroStatus === valor}
            >
              {rotulo}
            </Botao>
          ))}
        </div>
      </div>

      {filtradas.length === 0 ? (
        <EstadoVazio
          titulo={comunidades.length === 0 ? "Você ainda não participa de nenhuma comunidade" : "Nenhuma comunidade encontrada"}
          descricao={
            comunidades.length === 0
              ? "Inscreva-se em um evento para acessar a comunidade dele."
              : "Ajuste a busca ou os filtros para encontrar sua comunidade."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtradas.map(({ evento, papel, exercito, totalForuns, totalPublicacoes, futuro }) => (
            <Cartao key={evento.id}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium">{evento.nome}</h2>
                <div className="flex shrink-0 gap-1">
                  {papel === "gestao" && <Badge tom="aviso">Gestão</Badge>}
                  <Badge tom={futuro ? "sucesso" : "padrao"}>{futuro ? "Próximo" : "Encerrado"}</Badge>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatarDataBR(evento.inicioEm)} · {evento.cidade}/{evento.uf}
              </p>
              {exercito && <p className="text-sm text-muted-foreground">Seu exército: {exercito.nome}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {totalForuns} fóruns · {totalPublicacoes} publicações
              </p>
              <Link
                to="/comunidade/$eventoId"
                params={{ eventoId: evento.id }}
                className="mt-2 inline-block text-sm text-accent hover:underline"
              >
                Acessar comunidade →
              </Link>
            </Cartao>
          ))}
        </div>
      )}
    </div>
  );
}
