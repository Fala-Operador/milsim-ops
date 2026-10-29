import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { carregarBase } from "@/services/db";
import { useAuth } from "@/contexts/AuthContext";
import { papelNoEvento } from "@/services/comunidade";
import { formatarDataBR } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tr } from "@/i18n/routes/app.comunidades";

export const Route = createFileRoute("/app/comunidades")({
  head: () => ({
    meta: [
      { title: tr("minhas_comunidades_milsim_ops") },
      { name: "description", content: tr("lista_das_comunidades_de_eventos_das") },
      { property: "og:title", content: tr("minhas_comunidades_milsim_ops") },
      { property: "og:description", content: tr("comunidades_de_eventos_das_quais_voce") },
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
        <h1 className="titulo-pagina">{tr("minhas_comunidades")}</h1>
        <p className="subtitulo-pagina">{tr("comunidades_dos_eventos_em_que_voce")}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Label className="flex-1 text-[length:inherit] font-normal text-inherit">
          <span className="sr-only">{tr("buscar_comunidade")}</span>
          <Input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={tr("buscar_por_nome_do_evento_cidade")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </Label>
        <div className="flex gap-1" role="group" aria-label={tr("filtrar_por_periodo")}>
          {(
            [
              ["todas", tr("todas")],
              ["proximos", tr("proximos")],
              ["encerrados", tr("encerrados")],
            ] as const
          ).map(([valor, rotulo]) => (
            <Button
              key={valor}
              variant={filtroStatus === valor ? "default" : "secondary"}
              onClick={() => setFiltroStatus(valor)}
              aria-pressed={filtroStatus === valor}
            >
              {rotulo}
            </Button>
          ))}
        </div>
      </div>

      {filtradas.length === 0 ? (
        <EstadoVazio
          titulo={comunidades.length === 0 ? tr("voce_ainda_nao_participa_de_nenhuma") : tr("nenhuma_comunidade_encontrada")}
          descricao={
            comunidades.length === 0
              ? tr("inscreva_se_em_um_evento_para")
              : tr("ajuste_a_busca_ou_os_filtros")
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtradas.map(({ evento, papel, exercito, totalForuns, totalPublicacoes, futuro }) => (
            <Card key={evento.id}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium">{evento.nome}</h2>
                <div className="flex shrink-0 gap-1">
                  {papel === "gestao" && <Badge variant="warning">{tr("gestao")}</Badge>}
                  <Badge variant={futuro ? "success" : "secondary"}>{futuro ? tr("proximo") : tr("encerrado")}</Badge>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatarDataBR(evento.inicioEm)} · {evento.cidade}/{evento.uf}
              </p>
              {exercito && <p className="text-sm text-muted-foreground">{tr("seu_exercito_nome", { nome: exercito.nome })}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {tr("totalforuns_foruns_totalpublicacoes_publ", { totalForuns, totalPublicacoes })}</p>
              <Link
                to="/comunidade/$eventoId"
                params={{ eventoId: evento.id }}
                className="mt-2 inline-block text-sm text-accent hover:underline"
              >{tr("acessar_comunidade")}</Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
