import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { carregarBase } from "@/services/db";
import {
  cancelarInscricao,
  retomarPagamento,
  sincronizarPagamento,
} from "@/api/inscricoes.functions";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataBR } from "@/lib/domain/money";
import { Preco } from "@/components/Preco";
import { ROTULO_PAGAMENTO, reservaVigente } from "@/lib/pagamentos";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EstadoVazio, Modal } from "@/components/ui";
import { StatusInscricao } from "@/components/StatusInscricao";
import type { Inscricao } from "@/lib/domain/types";
import { IngressoQr } from "@/components/IngressoQr";
import { CreditCard, QrCode, Users } from "lucide-react";

export const Route = createFileRoute("/app/ingressos")({
  // Retorno do checkout do Stripe: ?pagamento=sucesso&sessao=cs_...
  validateSearch: (
    s: Record<string, unknown>,
  ): { pagamento?: string | undefined; sessao?: string | undefined } => ({
    pagamento: typeof s["pagamento"] === "string" ? s["pagamento"] : undefined,
    sessao: typeof s["sessao"] === "string" ? s["sessao"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Meus ingressos — MilSim Ops" },
      { name: "description", content: "Ingressos, status e histórico de participação." },
      { property: "og:title", content: "Meus ingressos — MilSim Ops" },
      { property: "og:description", content: "Ingressos e histórico." },
    ],
  }),
  component: MeusIngressos,
});

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

type Retorno = { tom: "sucesso" | "aviso" | "perigo"; texto: string };
const AVISO_RETORNO: Record<string, Retorno> = {
  pago: { tom: "sucesso", texto: "Pagamento aprovado. Seu ingresso está confirmado." },
  processando: {
    tom: "aviso",
    texto:
      "Pagamento enviado e em processamento. Avisaremos quando for compensado; a vaga continua reservada.",
  },
  aguardando: {
    tom: "aviso",
    texto: "Ainda não recebemos a confirmação do pagamento. Esta página atualiza sozinha.",
  },
  estorno_pendente: {
    tom: "perigo",
    texto:
      "O pagamento chegou depois que a reserva expirou. O valor será reembolsado integralmente.",
  },
  estornado: {
    tom: "perigo",
    texto: "O pagamento chegou depois que a reserva expirou e foi reembolsado.",
  },
  expirado: {
    tom: "perigo",
    texto: "O prazo da reserva terminou antes do pagamento. Faça uma nova inscrição.",
  },
  falhou: {
    tom: "perigo",
    texto: "O pagamento não foi aprovado. Faça uma nova inscrição para tentar de novo.",
  },
  cancelado: { tom: "perigo", texto: "Esta reserva foi cancelada antes do pagamento." },
};
const COR_AVISO = {
  sucesso: "border-success/40 bg-success/10 text-success",
  aviso: "border-warning/40 bg-warning/10 text-warning",
  perigo: "border-destructive/40 bg-destructive/10 text-destructive",
};

/** Confere o pagamento ao voltar do checkout e repete por alguns segundos enquanto o Stripe confirma. */
function useRetornoDoCheckout(sessao: string | undefined, usuarioId: string | undefined) {
  const navigate = useNavigate();
  const [aviso, setAviso] = useState<Retorno | null>(null);
  const feito = useRef<string | null>(null);
  // Montagem da página (não do efeito): a conferência segue depois de limpar o endereço.
  const montada = useRef(true);
  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
    };
  }, []);
  useEffect(() => {
    if (!sessao || !usuarioId || feito.current === sessao) return;
    feito.current = sessao;
    let tentativas = 0;
    const conferir = async () => {
      try {
        const r = await sincronizarPagamento(sessao);
        if (!montada.current) return;
        setAviso(AVISO_RETORNO[r.situacao] ?? null);
        if (r.situacao === "aguardando" && ++tentativas < 6) setTimeout(conferir, 3000);
      } catch (err) {
        if (montada.current)
          setAviso({
            tom: "perigo",
            texto: err instanceof Error ? err.message : "Não foi possível conferir o pagamento.",
          });
      }
    };
    void conferir();
    // Tira os parâmetros do endereço para um recarregamento não repetir a conferência.
    navigate({
      to: "/app/ingressos",
      search: { pagamento: undefined, sessao: undefined },
      replace: true,
    });
  }, [sessao, usuarioId, navigate]);
  return aviso;
}

function MeusIngressos() {
  const { usuario } = useAuth();
  const [, setVersao] = useState(0);
  const [cancelando, setCancelando] = useState<Inscricao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [qrDe, setQrDe] = useState<Inscricao | null>(null);
  const [abrindoPagamento, setAbrindoPagamento] = useState<string | null>(null);
  const [erroPagamento, setErroPagamento] = useState("");
  const { sessao } = Route.useSearch();
  const aviso = useRetornoDoCheckout(sessao, usuario?.id);
  const base = carregarBase();
  if (!usuario) return null;

  const minhas = base.inscricoes
    .filter((i) => i.usuarioId === usuario.id)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  const concluirPagamento = async (ins: Inscricao) => {
    setErroPagamento("");
    setAbrindoPagamento(ins.id);
    try {
      const r = await retomarPagamento(ins.id);
      if (r.urlPagamento) window.location.assign(r.urlPagamento);
    } catch (err) {
      setErroPagamento(err instanceof Error ? err.message : "Não foi possível abrir o pagamento.");
      setAbrindoPagamento(null);
    }
  };

  const cancelarReserva = async (ins: Inscricao) => {
    setErroPagamento("");
    try {
      await cancelarInscricao(ins.id, "Reserva cancelada antes do pagamento");
    } catch (err) {
      setErroPagamento(err instanceof Error ? err.message : "Falha ao cancelar a reserva.");
    }
  };

  const aoCancelar = async () => {
    if (!cancelando) return;
    setErro("");
    try {
      await cancelarInscricao(cancelando.id, motivo);
      setCancelando(null);
      setMotivo("");
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao cancelar.");
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold uppercase">Meus ingressos</h1>
      {aviso && (
        <p
          role="status"
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${COR_AVISO[aviso.tom]}`}
        >
          {aviso.texto}
        </p>
      )}
      {erroPagamento && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {erroPagamento}
        </p>
      )}
      {minhas.length === 0 ? (
        <div className="mt-4">
          <EstadoVazio
            titulo="Você ainda não possui ingressos"
            descricao="Inscreva-se em uma operação na página inicial."
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {minhas.map((ins) => {
            const evento = base.eventos.find((e) => e.id === ins.eventoId);
            const tipo = evento?.tipos.find((t) => t.id === ins.tipoId);
            const lote = evento?.lotes.find((l) => l.id === ins.loteId);
            const exercito = evento?.exercitos.find((e) => e.id === ins.exercitoId);
            const aguardandoPagamento =
              ins.pagamento?.status === "aguardando" && reservaVigente(ins);
            return (
              <Card key={ins.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-medium">{evento?.nome ?? "Evento"}</h2>
                    <p className="text-sm text-muted-foreground">
                      {evento &&
                        `${formatarDataBR(evento.inicioEm)} · ${evento.cidade}/${evento.uf}`}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tipo?.nome}
                      {lote ? ` · ${lote.nome}` : ""} · Exército: {exercito?.nome}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {ins.origem === "cortesia"
                        ? "Cortesia por convite"
                        : ins.descontoCentavos >= ins.valorCentavos && ins.valorCentavos > 0
                          ? "Inscrição integralmente descontada"
                          : <>Valor: <Preco centavos={ins.valorCentavos - ins.descontoCentavos} /></>}
                    </p>
                    {ins.pagamento && (
                      <p className="text-sm text-muted-foreground">
                        Pagamento online: {ROTULO_PAGAMENTO[ins.pagamento.status]}
                        {aguardandoPagamento &&
                          ` · vaga reservada até ${hora(ins.pagamento.expiraEm)}`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:block sm:shrink-0 sm:text-right">
                    <StatusInscricao status={ins.status} />
                    <p className="font-mono text-sm text-accent sm:mt-2">{ins.codigo}</p>
                    <p className="w-full text-[11px] text-muted-foreground">
                      Código do ingresso — sem dados pessoais
                    </p>
                  </div>
                </div>
                {aguardandoPagamento && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => concluirPagamento(ins)}
                      disabled={abrindoPagamento === ins.id}
                    >
                      <CreditCard className="h-4 w-4" />
                      {abrindoPagamento === ins.id ? "Abrindo pagamento..." : "Concluir pagamento"}
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      variant="outline"
                      onClick={() => cancelarReserva(ins)}
                    >
                      Cancelar reserva
                    </Button>
                  </div>
                )}
                {ins.status === "confirmada" && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button className="w-full sm:w-auto" onClick={() => setQrDe(ins)}>
                      <QrCode className="h-4 w-4" />
                      Abrir QR Code de entrada
                    </Button>
                    {evento?.whatsappGrupoUrl && (
                      <a
                        href={evento.whatsappGrupoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:w-auto"
                      >
                        <Users className="h-4 w-4" aria-hidden="true" />
                        Entrar no grupo do WhatsApp
                      </a>
                    )}
                    <Button
                      className="w-full sm:w-auto"
                      variant="outline"
                      onClick={() => setCancelando(ins)}
                    >
                      Cancelar inscrição
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {qrDe && (
        <IngressoQr
          inscricao={qrDe}
          evento={base.eventos.find((e) => e.id === qrDe.eventoId)}
          usuarioId={usuario.id}
          onFechar={() => setQrDe(null)}
        />
      )}
      <Modal
        aberto={!!cancelando}
        titulo={cancelando?.status === "pendente" ? "Cancelar reserva" : "Cancelar inscrição"}
        onFechar={() => setCancelando(null)}
      >
        <p className="text-sm text-muted-foreground">
          O cancelamento invalida o ingresso, libera a vaga e registra o estorno integral.
          {cancelando?.pagamento &&
            " Como o pagamento foi online, o reembolso integral é feito no mesmo meio de pagamento."}{" "}
          O histórico é preservado.
        </p>
        <div className="mt-3">
          <Textarea
            placeholder="Justificativa do cancelamento (obrigatória)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        {erro && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {erro}
          </p>
        )}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setCancelando(null)}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={aoCancelar}>
            Confirmar cancelamento
          </Button>
        </div>
      </Modal>
    </div>
  );
}
