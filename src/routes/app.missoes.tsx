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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
        <h1 className="font-display text-2xl font-semibold uppercase">Missões pré-evento</h1>
        <p className="text-sm text-muted-foreground">Cumpra as missões da organização para somar pontos ao seu exército. O exército vencedor leva os prêmios no dia do evento.</p>
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
      {organizacoes.map((o) => <Card key={o}><Temporada organizacaoId={o} /></Card>)}
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
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold uppercase">{evento.nome}</h2>
          <p className="text-sm text-muted-foreground">Seu exército: <strong className="text-foreground">{exercito ?? "—"}</strong></p>
        </div>
        {campanha?.encerradaEm && <Badge variant="secondary">Campanha encerrada</Badge>}
      </div>
      {campanha && campanha.premios.length > 0 && (
        <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
          <p className="flex items-center gap-1 font-medium"><Trophy className="size-4 text-accent" aria-hidden="true" />Prêmios no dia do evento</p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {campanha.premios.map((p) => <li key={p.colocacao}>{p.colocacao}º lugar: {p.descricao}</li>)}
          </ul>
        </div>
      )}
      <ul className="space-y-3">
        {ordenadas.map((m) => (
          <CartaoMissao key={m.id} missao={m} entrega={entregas.find((e) => e.missaoId === m.id)} campanha={campanha} />
        ))}
      </ul>
      <PlacarCompleto eventoId={evento.id} versao={versao} />
    </Card>
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
    <li className="overflow-hidden rounded-lg border border-border">
      {m.imagemUrl && <img src={m.imagemUrl} alt="" className="max-h-48 w-full object-cover" loading="lazy" />}
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 font-medium"><Icone className="size-4 text-accent" aria-hidden="true" />{m.titulo}</h3>
          <div className="flex flex-wrap gap-1">
            {!!m.pontos && <Badge variant="outline">{m.pontos} pts</Badge>}
            <Badge variant={tomStatus}>{ROTULO_STATUS_ENTREGA[status]}</Badge>
          </div>
        </div>
        <p className="whitespace-pre-line text-sm">{m.descricao}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{ROTULO_TIPO_ENTREGA[m.tipoEntrega]}</span>
          {situacao === "agendada" && m.abreEm && <span className="flex items-center gap-1"><Lock className="size-3" aria-hidden="true" />Abre {formatarDataHoraBR(m.abreEm)}</span>}
          <span className="flex items-center gap-1"><Clock className="size-3" aria-hidden="true" />Prazo {formatarDataHoraBR(m.prazo)}</span>
          {m.metaPercentual && m.metaBonus && <span>Meta coletiva: {m.metaPercentual}% do exército → +{m.metaBonus} pts</span>}
        </p>
        {entrega?.avaliacao && <p className="rounded-md bg-secondary/50 p-2 text-sm"><strong>Organização:</strong> {entrega.avaliacao}</p>}
        {entrega?.destacadaEm && <p className="text-sm text-accent">⭐ Sua entrega foi destacada na comunidade do evento.</p>}

        {!bloqueio && (
          <div className="space-y-2 border-t border-border pt-3">
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
