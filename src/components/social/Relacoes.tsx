// Seguir, perfil público/privado e pedidos para seguir (comunidade geral).
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Globe, UserCheck, UserPlus, Clock } from "lucide-react";
import { bloquear, definirPerfilComunidade, deixarDeSeguir, lerPedidosParaSeguir, lerPerfilSocial, responderPedido, seguir } from "@/api/social.functions";
import { useAuth } from "@/contexts/AuthContext";
import type { PerfilSocialDTO } from "@/lib/comunidadeGeral";
import { tempoRelativo } from "@/lib/tempoRelativo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AvatarAutor } from "./CartaoPost";

export const chavePerfilSocial = (id: string) => ["social", "perfil", id] as const;

/** Botão de seguir no perfil de outra pessoa (pedido, quando o perfil é privado). */
export function BotaoSeguir({ perfil }: { perfil: PerfilSocialDTO }) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  if (perfil.relacao === "eu") return null;

  const agir = async (acao: () => Promise<unknown>) => {
    if (!usuario) return navigate({ to: "/login", search: { redirect: `/operador/${perfil.autor.id}` } });
    setOcupado(true);
    setErro("");
    try {
      await acao();
      // Seguir/deixar de seguir/desbloquear muda o que a ficha do operador mostra.
      await Promise.all([qc.invalidateQueries({ queryKey: ["social"] }), qc.invalidateQueries({ queryKey: ["perfil-operador", perfil.autor.id] })]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {perfil.relacao === "bloqueado" ? (
        <Button variant="outline" disabled={ocupado} onClick={() => agir(() => bloquear(perfil.autor.id, false))}>Desbloquear</Button>
      ) : perfil.relacao === "seguindo" ? (
        <Button variant="outline" disabled={ocupado} onClick={() => agir(() => deixarDeSeguir(perfil.autor.id))}>
          <UserCheck className="h-4 w-4" /> Seguindo
        </Button>
      ) : perfil.relacao === "pendente" ? (
        <Button variant="outline" disabled={ocupado} onClick={() => agir(() => deixarDeSeguir(perfil.autor.id))} title="Cancelar pedido">
          <Clock className="h-4 w-4" /> Pedido enviado
        </Button>
      ) : (
        <Button disabled={ocupado} onClick={() => agir(() => seguir(perfil.autor.id))}>
          <UserPlus className="h-4 w-4" /> {perfil.privado ? "Pedir para seguir" : "Seguir"}
        </Button>
      )}
      {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}

/** Cabeçalho social de um perfil: contagens, privacidade e o botão de seguir. */
export function CabecalhoSocial({ usuarioId }: { usuarioId: string }) {
  const q = useQuery({ queryKey: chavePerfilSocial(usuarioId), queryFn: () => lerPerfilSocial(usuarioId) });
  // Mesma altura enquanto carrega: o perfil não "pula" quando os números chegam.
  if (q.isPending) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3" role="status" aria-label="Carregando seguidores">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
    );
  }
  if (!q.data) return null;
  const p = q.data;
  return (
    <div className="surgir flex flex-wrap items-center justify-between gap-3">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{p.seguidores}</strong> seguidores</span>
        <span><strong className="text-foreground">{p.seguindo}</strong> seguindo</span>
        <span className="inline-flex items-center gap-1">
          {p.privado ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <Globe className="h-3.5 w-3.5" aria-hidden="true" />}
          {p.privado ? "Perfil privado" : "Perfil público"}
        </span>
      </p>
      <BotaoSeguir perfil={p} />
    </div>
  );
}

/** Preferência da conta: perfil público ou privado na comunidade. */
export function CartaoPerfilComunidade() {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  if (!usuario) return null;
  const privado = !!usuario.comunidadePrivada;

  const alternar = async (novo: boolean) => {
    setOcupado(true);
    setErro("");
    try {
      await definirPerfilComunidade(novo);
      await qc.invalidateQueries({ queryKey: ["social"] });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Card>
      <h2 className="font-medium">Seu perfil na comunidade</h2>
      <Label className="mt-3 flex items-start justify-between gap-3 text-sm font-normal">
        <span>
          <span className="flex items-center gap-1.5 font-medium">
            {privado ? <Lock className="h-4 w-4" aria-hidden="true" /> : <Globe className="h-4 w-4" aria-hidden="true" />}
            {privado ? "Privado" : "Público"}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {privado
              ? "Só seguidores que você aprovar veem suas publicações e os blocos do seu perfil."
              : "Qualquer pessoa vê suas publicações, inclusive visitantes."}
          </span>
        </span>
        <Switch checked={privado} disabled={ocupado} onCheckedChange={(v) => void alternar(v)} aria-label="Perfil privado" />
      </Label>
      {!privado && <p className="mt-2 text-xs text-muted-foreground">Ao tornar o perfil público, os pedidos pendentes são aceitos.</p>}
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
    </Card>
  );
}

/** Pedidos para seguir aguardando a sua aprovação. */
export function PedidosParaSeguir({ compacto = false }: { compacto?: boolean }) {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["social", "pedidos", usuario?.id], queryFn: lerPedidosParaSeguir, enabled: !!usuario });
  const [erro, setErro] = useState("");
  if (!usuario || !q.data) return null;
  if (compacto && q.data.length === 0) return null;

  const responder = async (id: string, aprovar: boolean) => {
    setErro("");
    try {
      await responderPedido(id, aprovar);
      await qc.invalidateQueries({ queryKey: ["social"] });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível responder.");
    }
  };

  return (
    <Card>
      <h2 className="font-medium">Pedidos para seguir {q.data.length > 0 && <span className="text-muted-foreground">({q.data.length})</span>}</h2>
      {q.data.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nenhum pedido no momento.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {q.data.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <AvatarAutor nome={p.nome} fotoUrl={p.fotoUrl} tamanho="h-9 w-9" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.nome}</span>
                <span className="block text-xs text-muted-foreground">{tempoRelativo(p.pedidoEm)}</span>
              </span>
              <Button className="h-8 px-3 text-xs" onClick={() => void responder(p.id, true)}>Aceitar</Button>
              <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => void responder(p.id, false)}>Recusar</Button>
            </li>
          ))}
        </ul>
      )}
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
    </Card>
  );
}
