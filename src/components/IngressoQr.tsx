// QR Code de entrada do participante: token estável e opaco (sem CPF, telefone ou e-mail).
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui";
import { conteudoQr } from "@/lib/checkin";
import { tokenDaInscricao } from "@/services/checkin";
import { consultarEntrada } from "@/api/checkin.functions";
import { aoMudarBase } from "@/services/tempoReal";
import { guardarArquivosApp } from "@/lib/sw";
import { storage } from "@/lib/storage";
import { formatarDataBR } from "@/lib/domain/money";
import type { Evento, Inscricao } from "@/lib/domain/types";
import { tr } from "@/i18n/components/IngressoQr";
import { localeAtual } from "@/i18n/dicionario";

/**
 * A cada quantos ms o modal pergunta se a portaria já confirmou a entrada. O tempo real
 * avisa na hora (cada gravação na base); a consulta periódica cobre conexão do Realtime caída.
 */
const INTERVALO_CONSULTA_MS = 10_000;
/** Depois da confirmação, o modal fecha sozinho após este tempo. */
const FECHAR_APOS_S = 15;

/**
 * Enquanto o QR Code está aberto, pergunta ao servidor se a entrada foi confirmada:
 * na hora, a cada gravação avisada pelo tempo real, e periodicamente como reserva.
 * Só consulta com a aba visível; falhas (ex.: sem sinal no local) são ignoradas e a
 * próxima tentativa segue normalmente.
 */
function useEntradaConfirmada(inscricaoId: string): string | null {
  const [em, setEm] = useState<string | null>(null);
  useEffect(() => {
    if (em) return;
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let emCurso = false;
    let deNovo = false; // aviso chegou durante uma consulta: consulta outra vez em seguida
    const consultar = async () => {
      if (emCurso) { deNovo = true; return; }
      emCurso = true;
      deNovo = false;
      clearTimeout(timer);
      if (document.visibilityState === "visible" && navigator.onLine !== false) {
        try {
          const r = await consultarEntrada(inscricaoId);
          if (ativo && r.confirmada) return setEm(r.em ?? new Date().toISOString());
        } catch { /* sem conexão ou falha momentânea: tenta de novo */ }
      }
      emCurso = false;
      if (ativo) timer = setTimeout(consultar, deNovo ? 0 : INTERVALO_CONSULTA_MS);
    };
    void consultar();
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      void consultar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    const pararTempoReal = aoMudarBase(() => void consultar());
    return () => {
      ativo = false;
      pararTempoReal();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [inscricaoId, em]);
  return em;
}

function EntradaConfirmada({ em, restante }: { em: string; restante: number }) {
  const hora = new Date(em).toLocaleTimeString(localeAtual(), { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="space-y-3 py-4 text-center" role="status" aria-live="assertive">
      <div className="entrada-confirmada mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-success/10 text-success animate-in zoom-in-50 duration-300">
        <svg viewBox="0 0 56 56" className="h-32 w-32" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle className="circulo" cx="28" cy="28" r="25" />
          <path className="check" d="M16 29l8 8 16-17" />
        </svg>
      </div>
      <p className="font-display text-2xl font-semibold uppercase text-success">{tr("entrada_confirmada")}</p>
      <p className="text-sm text-muted-foreground">{tr("check_in_registrado_as_hora_boa", { hora })}</p>
      <p className="text-xs text-muted-foreground">{tr("esta_janela_fecha_em_restantes", { restante })}</p>
    </div>
  );
}

export function IngressoQr({ inscricao, evento, usuarioId, onFechar }: {
  inscricao: Inscricao; evento: Evento | undefined; usuarioId: string; onFechar: () => void;
}) {
  const [qr, setQr] = useState("");
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const confirmadaEm = useEntradaConfirmada(inscricao.id);
  const [restante, setRestante] = useState(FECHAR_APOS_S);

  // Confirmada a entrada: contagem regressiva e fecha sozinho.
  useEffect(() => {
    if (!confirmadaEm) return;
    setRestante(FECHAR_APOS_S);
    const inicio = Date.now();
    const t = setInterval(() => {
      const falta = FECHAR_APOS_S - Math.floor((Date.now() - inicio) / 1000);
      if (falta <= 0) { clearInterval(t); onFechar(); } else setRestante(falta);
    }, 250);
    return () => clearInterval(t);
  }, [confirmadaEm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      const token = tokenDaInscricao(inscricao.id, usuarioId); // reaproveita o token existente
      QRCode.toDataURL(conteudoQr(token), { width: 360, margin: 2, errorCorrectionLevel: "M" }).then(setQr);
    } catch (e) { setErro(e instanceof Error ? e.message : tr("falha_ao_gerar_o_qr_code")); }
  }, [inscricao.id, usuarioId]);

  const salvar = async () => {
    const salvos = storage.ler<Record<string, unknown>>("ingressos-salvos") ?? {};
    salvos[inscricao.id] = { qr, codigo: inscricao.codigo, evento: evento?.nome, data: evento?.inicioEm, salvoEm: new Date().toISOString() };
    storage.gravar("ingressos-salvos", salvos);
    const r = await guardarArquivosApp(["/app/ingressos"]);
    setMsg(r.ok ? tr("ingresso_salvo_neste_aparelho_voce_poder") : tr("ingresso_salvo_nos_dados_do_aparelho"));
  };

  const baixar = async () => {
    const c = document.createElement("canvas");
    c.width = 600; c.height = 860;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#1f2a14"; ctx.textAlign = "center";
    ctx.font = "bold 30px sans-serif"; ctx.fillText(tr("milsim_ops_ingresso"), 300, 60);
    ctx.font = "bold 26px sans-serif"; ctx.fillText((evento?.nome ?? tr("evento")).slice(0, 34), 300, 110);
    ctx.font = "20px sans-serif";
    if (evento) ctx.fillText(`${formatarDataBR(evento.inicioEm)} · ${evento.cidade}/${evento.uf}`, 300, 145);
    const img = new Image();
    img.src = qr;
    await img.decode();
    ctx.drawImage(img, 120, 180, 360, 360);
    ctx.font = "18px sans-serif"; ctx.fillText(tr("codigo_alternativo"), 300, 590);
    ctx.font = "bold 40px monospace"; ctx.fillText(inscricao.codigo, 300, 640);
    ctx.font = "16px sans-serif"; ctx.fillText(tr("apresente_na_portaria_nao_contem_dados"), 300, 700);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `ingresso-${inscricao.codigo}.png`;
    a.click();
  };

  return (
    <Modal aberto titulo={tr("qr_code_de_entrada")} onFechar={onFechar}>
      {confirmadaEm ? (
        <div className="space-y-3 text-center">
          <p className="font-medium">{evento?.nome}</p>
          <EntradaConfirmada em={confirmadaEm} restante={restante} />
          <p className="font-mono text-lg font-bold text-muted-foreground">{inscricao.codigo}</p>
        </div>
      ) : erro ? <p role="alert" className="text-sm text-destructive">{erro}</p> : (
        <div className="space-y-3 text-center">
          <p className="font-medium">{evento?.nome}</p>
          <div className="mx-auto w-fit rounded-lg bg-white p-2">
            {qr ? <img src={qr} alt={tr("qr_code_de_entrada_do_ingresso", { codigo: inscricao.codigo })} className="h-64 w-64" /> : <div className="h-64 w-64 animate-pulse bg-muted" />}
          </div>
          <p className="text-sm text-muted-foreground">{tr("codigo_alternativo")}</p>
          <p className="font-mono text-2xl font-bold">{inscricao.codigo}</p>
          <p className="rounded-md border border-warning/60 bg-warning/10 p-3 text-left text-sm">{tr("salve_o_ingresso_ou_baixe_a")}{" "}<strong>{tr("antes_de_ficar_sem_internet")}</strong>{" "}{tr("no_local_do_evento_pode_nao")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={salvar} disabled={!qr}><Save className="h-4 w-4" />{tr("salvar_no_aparelho")}</Button>
            <Button onClick={baixar} disabled={!qr}><Download className="h-4 w-4" />{tr("baixar_imagem")}</Button>
          </div>
          {msg && <p role="status" className="text-sm">{msg}</p>}
        </div>
      )}
    </Modal>
  );
}
