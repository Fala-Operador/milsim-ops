// Fóruns da comunidade geral: lista (busca, "meus fóruns", criar) e formulário de criar/editar.
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Lock, Plus, Search, Users } from "lucide-react";
import { criarForum, editarForum, lerForuns } from "@/api/social.functions";
import { useAuth } from "@/contexts/AuthContext";
import {
  DESCRICAO_FORUM_MAX,
  erroForum,
  LIMITE_FORUNS_POR_CONTA,
  NOME_FORUM_MAX,
  type ForumDTO,
  type VisibilidadeForum,
} from "@/lib/comunidadeGeral";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Campo, EstadoVazio, ErroSecao, Modal, SkeletonCartao } from "@/components/ui";

export function SeloVisibilidade({ v }: { v: VisibilidadeForum }) {
  return v === "privado"
    ? <Badge variant="secondary"><Lock aria-hidden="true" />Privado</Badge>
    : <Badge variant="success"><Globe aria-hidden="true" />Público</Badge>;
}

function SituacaoNoForum({ f }: { f: ForumDTO }) {
  if (f.meuPapel === "dono") return <Badge variant="warning">Dono</Badge>;
  if (f.meuPapel === "moderador") return <Badge variant="warning">Moderador</Badge>;
  if (f.minhaSituacao === "aprovado") return <Badge variant="accent">Membro</Badge>;
  if (f.minhaSituacao === "pendente") return <Badge>Pedido enviado</Badge>;
  return null;
}

export function CartaoForum({ f }: { f: ForumDTO }) {
  return (
    <Link to="/comunidades/f/$forumId" params={{ forumId: f.id }}
      className="block h-full rounded-lg border border-border bg-card p-4 transition-colors hover:bg-card/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words font-semibold">{f.nome}</h3>
        <SeloVisibilidade v={f.visibilidade} />
      </div>
      {f.descricao && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{f.descricao}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" /> {f.membros} {f.membros === 1 ? "membro" : "membros"}</span>
        <span>· criado por {f.dono.nome}</span>
        <SituacaoNoForum f={f} />
        {f.pedidosPendentes > 0 && <Badge variant="destructive">{f.pedidosPendentes} pedido{f.pedidosPendentes > 1 ? "s" : ""}</Badge>}
      </div>
    </Link>
  );
}

/** Criar (sem `forum`) ou editar (com `forum`, só o dono). */
export function ModalForum({ aberto, forum, onFechar, onSalvo }: {
  aberto: boolean; forum?: ForumDTO | undefined; onFechar: () => void; onSalvo: (f: ForumDTO) => void;
}) {
  const [nome, setNome] = useState(forum?.nome ?? "");
  const [descricao, setDescricao] = useState(forum?.descricao ?? "");
  const [visibilidade, setVisibilidade] = useState<VisibilidadeForum>(forum?.visibilidade ?? "publico");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const problema = erroForum(nome, descricao, visibilidade);
    if (problema) return setErro(problema);
    setSalvando(true);
    setErro("");
    try {
      const dados = { nome, descricao: descricao.trim() || undefined, visibilidade };
      onSalvo(forum ? await editarForum(forum.id, dados) : await criarForum(dados));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o fórum.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal aberto={aberto} titulo={forum ? "Editar fórum" : "Criar fórum"} onFechar={onFechar}>
      <div className="space-y-3">
        <Campo rotulo="Nome" htmlFor="frm-nome">
          <Input id="frm-nome" maxLength={NOME_FORUM_MAX} value={nome} onChange={(e) => { setNome(e.target.value); setErro(""); }} autoFocus />
        </Campo>
        <Campo rotulo={`Descrição (opcional, até ${DESCRICAO_FORUM_MAX} caracteres)`} htmlFor="frm-desc">
          <Textarea id="frm-desc" rows={3} maxLength={DESCRICAO_FORUM_MAX} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </Campo>
        <Campo rotulo="Quem pode ler" htmlFor="frm-vis" erro={erro}>
          <NativeSelect id="frm-vis" value={visibilidade} onChange={(e) => setVisibilidade(e.target.value as VisibilidadeForum)}>
            <option value="publico">Público — qualquer pessoa lê e entra na hora</option>
            <option value="privado">Privado — só membros aprovados leem; você aprova quem entra</option>
          </NativeSelect>
        </Campo>
        {forum && forum.visibilidade === "privado" && visibilidade === "publico" && (
          <p className="text-xs text-muted-foreground">Ao tornar o fórum público, os pedidos pendentes são aceitos e o conteúdo fica visível para todos.</p>
        )}
        {!forum && <p className="text-xs text-muted-foreground">Cada conta pode ter até {LIMITE_FORUNS_POR_CONTA} fóruns ativos. Publicações do fórum não aparecem no feed geral.</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
        <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : forum ? "Salvar" : "Criar fórum"}</Button>
      </div>
    </Modal>
  );
}

/** Aba "Fóruns" de Comunidades. */
export function ListaForuns() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [meus, setMeus] = useState(false);
  const [criando, setCriando] = useState(false);
  const termo = busca.trim();
  const q = useQuery({
    queryKey: ["social", "foruns", usuario?.id ?? "visitante", termo, meus],
    queryFn: () => lerForuns({ busca: termo || undefined, meus }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Buscar fórum pelo nome" placeholder="Buscar fórum pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>
        {usuario && (
          <Label className="flex items-center gap-2 text-sm font-normal">
            <Switch checked={meus} onCheckedChange={setMeus} /> Só os meus
          </Label>
        )}
        {usuario ? (
          <Button onClick={() => setCriando(true)} className="ml-auto"><Plus className="h-4 w-4" /> Criar fórum</Button>
        ) : (
          <Link to="/login" search={{ redirect: "/comunidades?aba=foruns" }} className="ml-auto text-sm text-accent hover:underline">Entre para criar ou participar →</Link>
        )}
      </div>
      {q.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2"><SkeletonCartao /><SkeletonCartao /></div>
      ) : q.isError ? (
        <ErroSecao titulo="Não foi possível carregar os fóruns" descricao={q.error.message} onTentar={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EstadoVazio
          titulo={termo || meus ? "Nenhum fórum encontrado" : "Nenhum fórum ainda"}
          descricao={termo || meus ? "Ajuste a busca." : "Crie o primeiro fórum: do seu time, da sua cidade ou de um tema."}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">{q.data.map((f) => <li key={f.id}><CartaoForum f={f} /></li>)}</ul>
      )}
      {criando && (
        <ModalForum aberto onFechar={() => setCriando(false)} onSalvo={(f) => {
          setCriando(false);
          void qc.invalidateQueries({ queryKey: ["social", "foruns"] });
          void navigate({ to: "/comunidades/f/$forumId", params: { forumId: f.id } });
        }} />
      )}
    </div>
  );
}
