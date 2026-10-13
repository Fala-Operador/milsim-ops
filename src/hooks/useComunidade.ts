import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { carregarBase } from "@/services/db";
import { estaSuspenso, papelNoEvento } from "@/services/comunidade";
import { garantirForuns } from "@/api/comunidade.functions";

/** Estado compartilhado das telas da comunidade (montagem, sessão, papel, refresh). */
export function useComunidade(eventoId: string, retorno: string) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [montado, setMontado] = useState(false);
  const [versao, setVersao] = useState(0);
  useVersaoBase(); // re-renderiza a cada visão nova recebida da API

  const base = carregarBase();
  const papel = papelNoEvento(base, usuario, eventoId);
  const semForuns = !!papel && !base.foruns.some((f) => f.eventoId === eventoId);

  useEffect(() => {
    // Comunidades de eventos antigos podem ainda não ter fóruns: o servidor cria os iniciais.
    if (semForuns) void garantirForuns(eventoId).catch(() => {});
    setMontado(true);
  }, [eventoId, semForuns]);

  useEffect(() => {
    if (montado && !usuario) navigate({ to: "/login", search: { redirect: retorno } });
  }, [montado, usuario, navigate, retorno]);

  const atualizar = useCallback(() => setVersao((v) => v + 1), []);
  const suspenso = !!usuario && papel === "membro" && estaSuspenso(base, usuario.id, eventoId);

  return { montado, usuario, base, papel, gestao: papel === "gestao", suspenso, atualizar, versao };
}
