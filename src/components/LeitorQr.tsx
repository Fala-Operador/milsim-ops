// Leitor de QR Code pela câmera (prioriza a traseira). Ao desmontar, desliga a câmera.
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CameraOff, Loader2 } from "lucide-react";
import { tr } from "@/i18n/components/LeitorQr";

const alternativa = () => tr("enquanto_isso_use_a_busca");

/**
 * Explica por que a câmera não abriu. "NotAllowedError" cobre três casos bem diferentes:
 * o site proíbe a câmera (cabeçalho Permissions-Policy), a pessoa bloqueou no navegador
 * ou o sistema operacional não libera a câmera para o navegador.
 */
async function motivoFalhaCamera(e: DOMException | undefined): Promise<string> {
  const nome = e?.name ?? "";
  if (nome === "NotFoundError" || nome === "OverconstrainedError") return tr("nenhuma_camera_encontrada_neste_aparelho", { ALTERNATIVA: alternativa() });
  if (nome === "NotReadableError") return tr("a_camera_esta_em_uso_por", { ALTERNATIVA: alternativa() });
  if (nome !== "NotAllowedError" && nome !== "SecurityError") return tr("camera_indisponivel_alternativa", { ALTERNATIVA: alternativa() });
  if (typeof window !== "undefined" && !window.isSecureContext) return tr("a_camera_so_funciona_em_endereco", { ALTERNATIVA: alternativa() });
  // Chrome/Edge expõem a política do documento; outros navegadores caem nos casos abaixo.
  const politica = (document as Document & { permissionsPolicy?: { allowsFeature(f: string): boolean }; featurePolicy?: { allowsFeature(f: string): boolean } });
  const pol = politica.permissionsPolicy ?? politica.featurePolicy;
  if (pol && !pol.allowsFeature("camera")) {
    return tr("a_camera_esta_bloqueada_pela_configuraca", { ALTERNATIVA: alternativa() });
  }
  try {
    const p = await navigator.permissions?.query({ name: "camera" as PermissionName });
    if (p?.state === "denied") {
      return tr("o_navegador_esta_bloqueando_a_camera", { ALTERNATIVA: alternativa() });
    }
  } catch {
    /* navegador sem consulta de permissão de câmera */
  }
  return tr("acesso_a_camera_negado_verifique_a", { ALTERNATIVA: alternativa() });
}

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
    if (!navigator.mediaDevices?.getUserMedia) { falhar(tr("camera_indisponivel_neste_aparelho_ou_na")); return; }
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
      .catch(async (e: DOMException) => { if (vivo) falhar(await motivoFalhaCamera(e)); });
    return () => { vivo = false; cancelAnimationFrame(quadro); stream?.getTracks().forEach((t) => t.stop()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg border-2 border-primary bg-secondary">
      <video ref={video} playsInline muted className="h-full w-full object-cover" aria-label={tr("imagem_da_camera")} />
      <canvas ref={canvas} className="hidden" />
      {estado === "ativo" && <div className="pointer-events-none absolute inset-10 rounded-md border-4 border-dashed border-accent/80" aria-hidden="true" />}
      {estado === "iniciando" && <div className="absolute inset-0 grid place-items-center text-sm"><span className="inline-flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />{tr("solicitando_acesso_a_camera")}</span></div>}
      {estado === "erro" && (
        <div role="alert" className="absolute inset-0 grid place-items-center p-6 text-center text-sm">
          <span><CameraOff className="mx-auto mb-2 h-8 w-8" />{erro}</span>
        </div>
      )}
    </div>
  );
}
