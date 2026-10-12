// Leitor de QR Code pela câmera (prioriza a traseira). Ao desmontar, desliga a câmera.
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CameraOff, Loader2 } from "lucide-react";

export function LeitorQr({ pausado, onLeitura, onErro }: {
  pausado: boolean; onLeitura: (texto: string) => void; onErro: (msg: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pausadoRef = useRef(pausado);
  const ultima = useRef({ texto: "", em: 0 });
  const [estado, setEstado] = useState<"iniciando" | "ativo" | "erro">("iniciando");
  const [erro, setErro] = useState("");
  pausadoRef.current = pausado;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let quadro = 0;
    let vivo = true;
    const falhar = (m: string) => { setEstado("erro"); setErro(m); onErro(m); };
    if (!navigator.mediaDevices?.getUserMedia) { falhar("Câmera indisponível neste aparelho ou navegador."); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(async (s) => {
        if (!vivo) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        const v = video.current!;
        v.srcObject = s;
        await v.play().catch(() => {});
        setEstado("ativo");
        let ultimoQuadro = 0;
        const ler = (t: number) => {
          if (!vivo) return;
          quadro = requestAnimationFrame(ler);
          if (pausadoRef.current || t - ultimoQuadro < 180 || v.readyState < 2) return;
          ultimoQuadro = t;
          const c = canvas.current!;
          c.width = v.videoWidth; c.height = v.videoHeight;
          const ctx = c.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(v, 0, 0);
          const cod = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
          if (!cod?.data) return;
          // Evita registros duplicados por leituras consecutivas do mesmo código.
          const agora = Date.now();
          if (cod.data === ultima.current.texto && agora - ultima.current.em < 5000) return;
          ultima.current = { texto: cod.data, em: agora };
          onLeitura(cod.data);
        };
        quadro = requestAnimationFrame(ler);
      })
      .catch((e: DOMException) => falhar(e?.name === "NotAllowedError"
        ? "Acesso à câmera negado. Use a busca ou digite o código do ingresso."
        : "Câmera indisponível. Use a busca ou digite o código do ingresso."));
    return () => { vivo = false; cancelAnimationFrame(quadro); stream?.getTracks().forEach((t) => t.stop()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg border-2 border-primary bg-secondary">
      <video ref={video} playsInline muted className="h-full w-full object-cover" aria-label="Imagem da câmera" />
      <canvas ref={canvas} className="hidden" />
      {estado === "ativo" && <div className="pointer-events-none absolute inset-10 rounded-md border-4 border-dashed border-accent/80" aria-hidden="true" />}
      {estado === "iniciando" && <div className="absolute inset-0 grid place-items-center text-sm"><span className="inline-flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Solicitando acesso à câmera…</span></div>}
      {estado === "erro" && (
        <div role="alert" className="absolute inset-0 grid place-items-center p-6 text-center text-sm">
          <span><CameraOff className="mx-auto mb-2 h-8 w-8" />{erro}</span>
        </div>
      )}
    </div>
  );
}
