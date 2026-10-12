// Converte uma imagem escolhida pelo usuário em data URL reduzida (persistência local demo).
export async function arquivoParaDataUrl(arquivo: File, max = 1024, tipo: "image/jpeg" | "image/png" = "image/jpeg"): Promise<string> {
  if (!arquivo.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  if (arquivo.size > 10 * 1024 * 1024) throw new Error("Imagem muito grande (máx. 10 MB).");
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error("Não foi possível ler a imagem."));
      i.src = url;
    });
    const escala = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(tipo, 0.75);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Converte um PDF escolhido pelo usuário em data URL (persistência local demo).
export async function pdfParaDataUrl(arquivo: File): Promise<string> {
  if (arquivo.type !== "application/pdf") throw new Error("Selecione um arquivo PDF.");
  if (arquivo.size > 5 * 1024 * 1024) throw new Error("PDF muito grande (máx. 5 MB).");
  return new Promise((ok, erro) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.onerror = () => erro(new Error("Não foi possível ler o PDF."));
    leitor.readAsDataURL(arquivo);
  });
}

// Converte data URL em URL de objeto (blob) — navegadores abrem PDFs assim no leitor interno.
export function dataUrlParaBlobUrl(dataUrl: string): string {
  const [cab, dados] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(cab ?? "")?.[1] ?? "application/pdf";
  const bin = atob(dados ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}
