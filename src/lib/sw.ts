// Registro do Service Worker e preparação dos arquivos para uso sem internet.
export type EstadoSW = "indisponivel" | "registrando" | "ativo" | "erro";

export function swSuportado(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator && window.isSecureContext;
}

export async function registrarSW(): Promise<EstadoSW> {
  if (!swSuportado()) return "indisponivel";
  try {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return "ativo";
  } catch {
    return "erro";
  }
}

/** Pede ao Service Worker para guardar a página atual e todos os arquivos já carregados. */
export async function guardarArquivosApp(paginasExtras: string[] = []): Promise<{ ok: boolean; arquivos: number }> {
  if ((await registrarSW()) !== "ativo") return { ok: false, arquivos: 0 };
  const reg = await navigator.serviceWorker.ready;
  const urls = new Set<string>([location.pathname, ...paginasExtras]);
  performance.getEntriesByType("resource").forEach((e) => {
    const u = new URL(e.name);
    if (u.origin === location.origin && !u.pathname.startsWith("/_serverFn")) urls.add(u.pathname + u.search);
  });
  return new Promise((ok) => {
    const t = setTimeout(() => ok({ ok: false, arquivos: 0 }), 20000);
    const ouvir = (ev: MessageEvent) => {
      if (ev.data?.tipo !== "cacheado") return;
      clearTimeout(t);
      navigator.serviceWorker.removeEventListener("message", ouvir);
      ok({ ok: ev.data.ok > 0, arquivos: ev.data.ok });
    };
    navigator.serviceWorker.addEventListener("message", ouvir);
    reg.active?.postMessage({ tipo: "cachear", urls: [...urls] });
  });
}
