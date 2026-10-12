// Converte uma imagem escolhida pelo usuário em data URL reduzida (persistência local demo).
export async function arquivoParaDataUrl(arquivo: File, max = 1024): Promise<string> {
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
    return canvas.toDataURL("image/jpeg", 0.75);
  } finally {
    URL.revokeObjectURL(url);
  }
}
