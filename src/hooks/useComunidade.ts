import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { carregarBase } from "@/services/db";
import { estaSuspenso, garantirForuns, papelNoEvento } from "@/services/comunidade";

/** Estado compartilhado das telas da comunidade (montagem, sessão, papel, refresh). */
export function useComunidade(eventoId: string, retorno: string) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [montado, setMontado] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    garantirForuns(eventoId);
    setMontado(true);
  }, [eventoId]);

  useEffect(() => {
    if (montado && !usuario) navigate({ to: "/login", search: { redirect: retorno } });
  }, [montado, usuario, navigate, retorno]);

  const atualizar = useCallback(() => setVersao((v) => v + 1), []);
  const base = carregarBase();
  const papel = papelNoEvento(base, usuario, eventoId);
  const suspenso = !!usuario && papel === "membro" && estaSuspenso(base, usuario.id, eventoId);

  return { montado, usuario, base, papel, gestao: papel === "gestao", suspenso, atualizar, versao };
}
