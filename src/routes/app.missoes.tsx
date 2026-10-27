import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, CheckCircle2, Clock, KeyRound, Lock, Target, Trophy } from "lucide-react";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { enviarEntrega } from "@/api/missoes.functions";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { arquivoParaDataUrl } from "@/lib/imagens";
import { bloqueioEnvio, ROTULO_STATUS_ENTREGA, ROTULO_TIPO_ENTREGA, situacaoMissao } from "@/lib/missoes";
import { PlacarCompleto, Temporada } from "@/components/missoes/Placar";
import { Badge } from "@/components/ui/badge";
import { FaixaIndicadores } from "@/components/FaixaIndicadores";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EstadoVazio } from "@/components/ui";
import type { CampanhaMissoes, EntregaMissao, Evento, Missao } from "@/lib/domain/types";

export const Route = createFileRoute("/app/missoes")({
  head: () => ({
    meta: [
      { title: "Missões — MilSim Ops" },
      { name: "description", content: "Missões pré-evento, placar dos exércitos e prêmios." },
      { property: "og:title", content: "Missões — MilSim Ops" },
      { property: "og:description", content: "Missões pré-evento e placar." },
    ],
  }),
  component: PaginaMissoes,
});

const msg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível enviar.");

function PaginaMissoes() {
  const { usuario } = useAuth();
  const versao = useVersaoBase();
  const base = carregarBase();
  if (!usuario) return null;

  // Eventos em que a pessoa está confirmada e que têm missões publicadas para ela (a visão já filtra).
  const inscricoes = base.inscricoes.filter((i) => i.usuarioId === usuario.id && i.status === "confirmada");
  const eventos = inscricoes
    .map((i) => base.eventos.find((e) => e.id === i.eventoId))
    .filter((e): e is Evento => !!e && base.missoes.some((m) => m.eventoId === e.id))
    .sort((a, b) => a.inicioEm.localeCompare(b.inicioEm));
  const organizacoes = [...new Set(inscricoes.map((i) => base.eventos.find((e) => e.id === i.eventoId)?.organizacaoId).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">Missões pré-evento</h1>
        <p className="subtitulo-pagina">Cumpra as missões da organização para somar pontos ao seu exército. O exército vencedor leva os prêmios no dia do evento.</p>
      </div>
      {eventos.length === 0 ? (
        <EstadoVazio titulo="Nenhuma missão por enquanto" descricao="Quando a organização de um evento em que você está inscrito publicar missões, elas aparecem aqui." />
      ) : (
        eventos.map((ev) => (
          <EventoMissoes
            key={ev.id}
            evento={ev}
            missoes={base.missoes.filter((m) => m.eventoId === ev.id)}
            entregas={base.entregas.filter((e) => e.usuarioId === usuario.id)}
            campanha={base.campanhasMissoes.find((c) => c.eventoId === ev.id)}
            exercito={ev.exercitos.find((x) => x.id === inscricoes.find((i) => i.eventoId === ev.id)?.exercitoId)?.nome}
            versao={versao}
          />
        ))
      )}
      {organizacoes.map((o) => <section key={o} className="border-t border-border pt-6"><Temporada organizacaoId={o} /></section>)}
    </div>
  );
}

function EventoMissoes({ evento, missoes, entregas, campanha, exercito, versao }: {
  evento: Evento; missoes: Missao[]; entregas: EntregaMissao[]; campanha: CampanhaMissoes | undefined; exercito: string | undefined; versao: unknown;
}) {
  const ordenadas = [...missoes].sort((a, b) => {
    const ordem = { aberta: 0, agendada: 1, encerrada: 2, rascunho: 3 } as const;
    return ordem[situacaoMissao(a)] - ordem[situacaoMissao(b)] || a.prazo.localeCompare(b.prazo);
  });
  return (
    <section className="space-y-5">
      <div className="relative isolate flex flex-wrap items-end justify-between gap-2 overflow-hidden rounded-lg border border-border bg-black p-5 text-white">
        {evento.imagemUrl && <img src={evento.imagemUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 to-black/30" aria-hidden />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">Exército {exercito ?? "—"}</p>
          <h2 className="mt-1 font-display text-3xl font-bold uppercase leading-none">{evento.nome}</h2>
        </div>
        {campanha?.encerradaEm && <Badge variant="secondary">Campanha encerrada</Badge>}
      </div>
      {(() => {
        const minhas = missoes.map((m) => entregas.find((e) => e.missaoId === m.id));
        const feitas = minhas.filter((e) => e?.status === "concluida").length;
        const ganhos = missoes.reduce((t, m, k) => t + (minhas[k]?.status === "concluida" ? m.pontos ?? 0 : 0), 0);
        const possiveis = missoes.reduce((t, m) => t + (m.pontos ?? 0), 0);
        const proxima = ordenadas.find((m) => situacaoMissao(m) === "aberta" && entregas.find((e) => e.missaoId === m.id)?.status !== "concluida");
        return (
          <FaixaIndicadores className="lg:grid-cols-4" itens={[
            { rotulo: "Missões concluídas", valor: `${feitas} de ${missoes.length}` },
            { rotulo: "Seus pontos", valor: String(ganhos), detalhe: `de ${possiveis} possíveis` },
            { rotulo: "Abertas agora", valor: String(ordenadas.filter((m) => situacaoMissao(m) === "aberta").length) },
            { rotulo: "Próximo prazo", valor: proxima ? formatarDataHoraBR(proxima.prazo).slice(0, 5) : "—", detalhe: proxima?.titulo },
          ]} />
        );
      })()}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <ul className="divide-y divide-border border-y border-border">
          {ordenadas.map((m) => (
            <CartaoMissao key={m.id} missao={m} entrega={entregas.find((e) => e.missaoId === m.id)} campanha={campanha} />
          ))}
        </ul>
        <aside className="space-y-6 lg:sticky lg:top-24">
          {campanha && campanha.premios.length > 0 && (
            <section>
              <h3 className="rotulo-tecnico flex items-center gap-1.5"><Trophy className="size-3.5 text-accent" aria-hidden="true" />Prêmios no dia do evento</h3>
              <ol className="mt-2 divide-y divide-border border-y border-border text-sm">
                {campanha.premios.map((p) => (
                  <li key={p.colocacao} className="flex gap-3 py-2"><span className="font-display text-xl font-bold leading-none text-accent">{p.colocacao}º</span><span>{p.descricao}</span></li>
                ))}
              </ol>
            </section>
          )}
          <PlacarCompleto eventoId={evento.id} versao={versao} empilhado />
        </aside>
      </div>
    </section>
  );
}

const ICONE_TIPO = { confirmacao: CheckCircle2, texto: Target, imagem: Camera, codigo: KeyRound } as const;

function CartaoMissao({ missao: m, entrega, campanha }: { missao: Missao; entrega: EntregaMissao | undefined; campanha: CampanhaMissoes | undefined }) {
  const [texto, setTexto] = useState("");
  const [codigo, setCodigo] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [destaque, setDestaque] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const situacao = situacaoMissao(m);
  const bloqueio = bloqueioEnvio(m, entrega, campanha);
  const Icone = ICONE_TIPO[m.tipoEntrega];
  const status = entrega?.status ?? (situacao === "encerrada" ? "prazo_encerrado" : "disponivel");
  const tomStatus = status === "concluida" ? "success" : status === "recusada" ? "destructive" : status === "ajustes_solicitados" || status === "enviada" ? "warning" : "secondary";

  const enviar = async () => {
    setErro("");
    setEnviando(true);
    try {
      await enviarEntrega({ missaoId: m.id, texto: texto || undefined, foto: foto ?? undefined, codigo: codigo || undefined, permiteDestaque: destaque });
      setTexto(""); setCodigo(""); setFoto(null);
    } catch (e) {
      setErro(msg(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <li className="grid gap-4 py-5 sm:grid-cols-[88px_minmax(0,1fr)]">
      <div className="hidden sm:block">
        <span className="grid h-14 w-14 place-items-center rounded-md border border-border text-accent"><Icone className="size-6" aria-hidden="true" /></span>
        {!!m.pontos && <p className="mt-2 font-display text-2xl font-bold leading-none">{m.pontos}<span className="ml-0.5 font-mono text-[10px] text-muted-foreground">PTS</span></p>}
      </div>
      <div className="min-w-0 space-y-2">
        {m.imagemUrl && <img src={m.imagemUrl} alt="" className="max-h-48 w-full rounded-md object-cover" loading="lazy" />}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-lg font-semibold">{m.titulo}</h3>
          <div className="flex flex-wrap gap-1">
            {!!m.pontos && <Badge variant="outline">{m.pontos} pts</Badge>}
            <Badge variant={tomStatus}>{ROTULO_STATUS_ENTREGA[status]}</Badge>
          </div>
        </div>
        <p className="whitespace-pre-line text-sm">{m.descricao}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>{ROTULO_TIPO_ENTREGA[m.tipoEntrega]}</span>
          {situacao === "agendada" && m.abreEm && <span className="flex items-center gap-1"><Lock className="size-3" aria-hidden="true" />Abre {formatarDataHoraBR(m.abreEm)}</span>}
          <span className="flex items-center gap-1"><Clock className="size-3" aria-hidden="true" />Prazo {formatarDataHoraBR(m.prazo)}</span>
          {m.metaPercentual && m.metaBonus && <span>Meta coletiva: {m.metaPercentual}% do exército → +{m.metaBonus} pts</span>}
        </p>
        {entrega?.avaliacao && <p className="rounded-md bg-secondary/50 p-2 text-sm"><strong>Organização:</strong> {entrega.avaliacao}</p>}
        {entrega?.destacadaEm && <p className="text-sm text-accent">Sua entrega foi destacada na comunidade do evento.</p>}

        {!bloqueio && (
          <div className="space-y-2 pt-1">
            {m.tipoEntrega === "texto" && (
              <Textarea aria-label="Sua entrega" placeholder="Escreva a sua entrega ou cole o link (vídeo, post…)" maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} />
            )}
            {m.tipoEntrega === "codigo" && (
              <Input aria-label="Código secreto" placeholder="Digite o código" maxLength={80} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            )}
            {m.tipoEntrega === "imagem" && (
              <div className="space-y-2">
                {foto && <img src={foto} alt="Prévia da sua foto" className="max-h-56 rounded-md object-cover" />}
                <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
                  <Camera className="size-4" aria-hidden="true" />{foto ? "Trocar foto" : "Escolher foto"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => {
                    const a = e.target.files?.[0]; e.target.value = "";
                    if (a) { try { setFoto(await arquivoParaDataUrl(a, 1600)); } catch (er) { setErro(msg(er)); } }
                  }} />
                </Label>
                <Input aria-label="Legenda (opcional)" placeholder="Legenda (opcional)" maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} />
              </div>
            )}
            {(m.tipoEntrega === "imagem" || m.tipoEntrega === "texto") && (
              <div className="flex items-start gap-2">
                <Checkbox id={`destaque-${m.id}`} checked={destaque} onCheckedChange={(v) => setDestaque(v === true)} />
                <Label htmlFor={`destaque-${m.id}`} className="text-sm font-normal">Autorizo a organização a destacar minha entrega na comunidade do evento (com meu nome de exibição).</Label>
              </div>
            )}
            {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
            <Button onClick={enviar} disabled={enviando}>
              {enviando ? "Enviando..." : m.tipoEntrega === "codigo" ? "Conferir código" : m.tipoEntrega === "confirmacao" ? "Confirmar missão cumprida" : entrega?.status === "ajustes_solicitados" ? "Reenviar entrega" : "Enviar entrega"}
            </Button>
          </div>
        )}
        {bloqueio && status !== "concluida" && status !== "enviada" && <p className="text-xs text-muted-foreground">{bloqueio}</p>}
      </div>
    </li>
  );
}
