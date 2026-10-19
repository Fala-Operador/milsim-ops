// QR Code de entrada do participante: token estável e opaco (sem CPF, telefone ou e-mail).
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui";
import { conteudoQr } from "@/lib/checkin";
import { tokenDaInscricao } from "@/services/checkin";
import { guardarArquivosApp } from "@/lib/sw";
import { storage } from "@/lib/storage";
import { formatarDataBR } from "@/lib/domain/money";
import type { Evento, Inscricao } from "@/lib/domain/types";

export function IngressoQr({ inscricao, evento, usuarioId, onFechar }: {
  inscricao: Inscricao; evento: Evento | undefined; usuarioId: string; onFechar: () => void;
}) {
  const [qr, setQr] = useState("");
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    try {
      const token = tokenDaInscricao(inscricao.id, usuarioId); // reaproveita o token existente
      QRCode.toDataURL(conteudoQr(token), { width: 360, margin: 2, errorCorrectionLevel: "M" }).then(setQr);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao gerar o QR Code."); }
  }, [inscricao.id, usuarioId]);

  const salvar = async () => {
    const salvos = storage.ler<Record<string, unknown>>("ingressos-salvos") ?? {};
    salvos[inscricao.id] = { qr, codigo: inscricao.codigo, evento: evento?.nome, data: evento?.inicioEm, salvoEm: new Date().toISOString() };
    storage.gravar("ingressos-salvos", salvos);
    const r = await guardarArquivosApp(["/app/ingressos"]);
    setMsg(r.ok ? "Ingresso salvo neste aparelho. Você poderá abrir Meus ingressos sem internet." : "Ingresso salvo nos dados do aparelho, mas este navegador não permitiu guardar a página para uso sem internet. Baixe a imagem por garantia.");
  };

  const baixar = async () => {
    const c = document.createElement("canvas");
    c.width = 600; c.height = 860;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#1f2a14"; ctx.textAlign = "center";
    ctx.font = "bold 30px sans-serif"; ctx.fillText("MILSIM OPS — INGRESSO", 300, 60);
    ctx.font = "bold 26px sans-serif"; ctx.fillText((evento?.nome ?? "Evento").slice(0, 34), 300, 110);
    ctx.font = "20px sans-serif";
    if (evento) ctx.fillText(`${formatarDataBR(evento.inicioEm)} · ${evento.cidade}/${evento.uf}`, 300, 145);
    const img = new Image();
    img.src = qr;
    await img.decode();
    ctx.drawImage(img, 120, 180, 360, 360);
    ctx.font = "18px sans-serif"; ctx.fillText("Código alternativo", 300, 590);
    ctx.font = "bold 40px monospace"; ctx.fillText(inscricao.codigo, 300, 640);
    ctx.font = "16px sans-serif"; ctx.fillText("Apresente na portaria. Não contém dados pessoais.", 300, 700);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `ingresso-${inscricao.codigo}.png`;
    a.click();
  };

  return (
    <Modal aberto titulo="QR Code de entrada" onFechar={onFechar}>
      {erro ? <p role="alert" className="text-sm text-destructive">{erro}</p> : (
        <div className="space-y-3 text-center">
          <p className="font-medium">{evento?.nome}</p>
          <div className="mx-auto w-fit rounded-lg bg-white p-2">
            {qr ? <img src={qr} alt={`QR Code de entrada do ingresso ${inscricao.codigo}`} className="h-64 w-64" /> : <div className="h-64 w-64 animate-pulse bg-muted" />}
          </div>
          <p className="text-sm text-muted-foreground">Código alternativo</p>
          <p className="font-mono text-2xl font-bold">{inscricao.codigo}</p>
          <p className="rounded-md border border-warning/60 bg-warning/10 p-3 text-left text-sm">Salve o ingresso ou baixe a imagem <strong>antes de ficar sem internet</strong> — no local do evento pode não haver sinal.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={salvar} disabled={!qr}><Save className="h-4 w-4" />Salvar no aparelho</Button>
            <Button onClick={baixar} disabled={!qr}><Download className="h-4 w-4" />Baixar imagem</Button>
          </div>
          {msg && <p role="status" className="text-sm">{msg}</p>}
        </div>
      )}
    </Modal>
  );
}
