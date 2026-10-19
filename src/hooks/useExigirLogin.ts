// Áreas que exigem conta (/app, /organizacao, /admin): sem sessão, manda para o login com
// volta ao mesmo endereço. Um lugar só para as três, porque a versão copiada em cada layout
// entrava em laço: durante a navegação para /login o layout ainda está montado, o endereço
// já é /login?redirect=… e o efeito redirecionava de novo, aninhando o redirect sem fim.
import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth, type EstadoCarga } from "@/contexts/AuthContext";

/** O endereço ainda está dentro da área protegida (e não, por exemplo, já em /login). */
export function dentroDaArea(endereco: string, prefixo: string): boolean {
  const caminho = endereco.split(/[?#]/)[0]!;
  return caminho === prefixo || caminho.startsWith(`${prefixo}/`);
}

/**
 * Redireciona só com a visão carregada (antes disso o usuário ainda é `null` mesmo logado) e
 * só enquanto o endereço é da própria área.
 */
export function deveIrParaLogin(p: { carga: EstadoCarga; logado: boolean; endereco: string; prefixo: string }): boolean {
  return p.carga === "pronto" && !p.logado && dentroDaArea(p.endereco, p.prefixo);
}

export function useExigirLogin(prefixo: "/app" | "/organizacao" | "/admin"): void {
  const { usuario, carga } = useAuth();
  const navigate = useNavigate();
  const endereco = useRouterState({ select: (s) => s.location.href });
  const logado = !!usuario;
  useEffect(() => {
    if (deveIrParaLogin({ carga, logado, endereco, prefixo })) {
      // replace: o "voltar" do navegador não retorna à página protegida.
      navigate({ to: "/login", search: { redirect: endereco }, replace: true });
    }
  }, [carga, logado, endereco, prefixo, navigate]);
}
