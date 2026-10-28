import { FaixaIndicadores } from "@/components/FaixaIndicadores";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";
import { carregarBase } from "@/services/db";
import { aprovarAutorizacaoResponsavel, desativarUsuario } from "@/api/admin.functions";
import { useAuth } from "@/contexts/AuthContext";
import { mascararCpf } from "@/lib/domain/validators";
import {
  alternarOrdenacao, filtrarUsuarios, FILTROS_USUARIOS_VAZIOS, ORDENACAO_USUARIOS_PADRAO, ordenarUsuarios, paginar,
  ROTULO_ORDENACAO_USUARIOS, type CampoOrdenacaoUsuarios, type FiltrosUsuarios, type OrdenacaoUsuarios,
} from "@/lib/usuariosAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EstadoVazio, ModalTexto } from "@/components/ui";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Admin MilSim Ops" },
      { name: "description", content: "Gestão de usuários da plataforma." },
      { property: "og:title", content: "Usuários — Admin MilSim Ops" },
      { property: "og:description", content: "Gestão de usuários." },
    ],
  }),
  component: Usuarios,
});

function Usuarios() {
  const { usuario } = useAuth();
  const [, setVersao] = useState(0);
  useVersaoBase(); // contadores e lista acompanham cadastros e desativações
  const [erro, setErro] = useState("");
  const [desativando, setDesativando] = useState<{ id: string; nome: string } | null>(null);
  const [filtros, setFiltros] = useState<FiltrosUsuarios>(FILTROS_USUARIOS_VAZIOS);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoUsuarios>(ORDENACAO_USUARIOS_PADRAO);
  const [pagina, setPagina] = useState(1);
  if (!usuario) return null;
  const base = carregarBase();
  const ativos = base.usuarios.filter((u) => u.ativo);
  const porPerfil = (p: (typeof base.usuarios)[number]["perfil"]) => ativos.filter((u) => u.perfil === p).length;

  const encontrados = ordenarUsuarios(filtrarUsuarios(base.usuarios, filtros), ordenacao);
  const pag = paginar(encontrados, pagina);
  const filtrando = filtros.busca.trim() !== "" || filtros.perfil !== "" || filtros.status !== "";
  // Qualquer mudança de busca, filtro ou ordem volta para a primeira página.
  const mudarFiltros = (p: Partial<FiltrosUsuarios>) => { setFiltros((f) => ({ ...f, ...p })); setPagina(1); };
  const ordenar = (o: OrdenacaoUsuarios) => { setOrdenacao(o); setPagina(1); };
  const cabecalho = (campo: CampoOrdenacaoUsuarios) => (
    <CabecalhoOrdenavel campo={campo} ordenacao={ordenacao} onOrdenar={(c) => ordenar(alternarOrdenacao(ordenacao, c))} />
  );

  return (
    <section>
      <h2 className="titulo-pagina">Usuários</h2>
      <FaixaIndicadores className="mt-4 lg:grid-cols-4" itens={[
        { rotulo: "Usuários ativos", valor: String(ativos.length), detalhe: `de ${base.usuarios.length} cadastrados` },
        { rotulo: "Participantes", valor: String(porPerfil("participante")) },
        { rotulo: "Organizadores", valor: String(porPerfil("organizador")) },
        { rotulo: "Admins · inativos", valor: `${porPerfil("admin")} · ${base.usuarios.length - ativos.length}` },
      ]} />

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1fr)_180px_200px]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Buscar por nome, e-mail ou CPF"
            placeholder="Buscar por nome, e-mail ou CPF"
            value={filtros.busca}
            onChange={(e) => mudarFiltros({ busca: e.target.value })}
            className="pl-9"
          />
        </div>
        <NativeSelect aria-label="Filtrar por perfil" value={filtros.perfil} onChange={(e) => mudarFiltros({ perfil: e.target.value as FiltrosUsuarios["perfil"] })}>
          <option value="">Todos os perfis</option>
          <option value="participante">Participantes</option>
          <option value="organizador">Organizadores</option>
          <option value="admin">Admins</option>
        </NativeSelect>
        <NativeSelect aria-label="Filtrar por status" value={filtros.status} onChange={(e) => mudarFiltros({ status: e.target.value as FiltrosUsuarios["status"] })}>
          <option value="">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
          <option value="autorizacao_pendente">Autorização pendente</option>
        </NativeSelect>
        {/* Abaixo de lg a tabela vira cartões e o cabeçalho some: a ordem é escolhida aqui. */}
        <NativeSelect
          aria-label="Ordenar por"
          className="sm:col-span-2 lg:hidden"
          value={`${ordenacao.campo}:${ordenacao.direcao}`}
          onChange={(e) => {
            const [campo, direcao] = e.target.value.split(":") as [CampoOrdenacaoUsuarios, OrdenacaoUsuarios["direcao"]];
            ordenar({ campo, direcao });
          }}
        >
          <option value="cadastro:desc">Cadastro mais recente</option>
          <option value="cadastro:asc">Cadastro mais antigo</option>
          <option value="nome:asc">Nome (A–Z)</option>
          <option value="nome:desc">Nome (Z–A)</option>
          <option value="email:asc">E-mail (A–Z)</option>
          <option value="email:desc">E-mail (Z–A)</option>
          <option value="perfil:asc">Perfil (A–Z)</option>
          <option value="perfil:desc">Perfil (Z–A)</option>
          <option value="status:asc">Ativos primeiro</option>
          <option value="status:desc">Inativos primeiro</option>
        </NativeSelect>
      </div>
      <div className="mt-2 flex min-h-9 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span aria-live="polite">
          {encontrados.length === 0
            ? "Nenhum usuário encontrado"
            : `${pag.inicio + 1}–${pag.fim} de ${encontrados.length} ${encontrados.length === 1 ? "usuário" : "usuários"}`}
        </span>
        {filtrando && (
          <Button variant="ghost" size="sm" onClick={() => { setFiltros(FILTROS_USUARIOS_VAZIOS); setPagina(1); }}>
            <X className="h-4 w-4" /> Limpar filtros
          </Button>
        )}
      </div>

      {erro && <p role="alert" className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      {encontrados.length === 0 ? (
        <div className="mt-3">
          <EstadoVazio titulo="Nenhum usuário encontrado" descricao="Ajuste a busca ou limpe os filtros." />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <Table className="tabela-cards w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                {cabecalho("nome")}
                {cabecalho("email")}
                <TableHead className="py-2 pr-3">CPF</TableHead>
                {cabecalho("perfil")}
                {cabecalho("status")}
                {cabecalho("cadastro")}
                <TableHead className="py-2">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pag.itens.map((u) => (
                <TableRow key={u.id} className="border-b border-border/50">
                  <TableCell className="py-2 pr-3 font-medium lg:font-normal">{u.nomeCompleto}</TableCell>
                  <TableCell data-rotulo="E-mail" className="py-2 pr-3 break-all">{u.email}</TableCell>
                  <TableCell data-rotulo="CPF" className="py-2 pr-3 font-mono text-xs">{mascararCpf(u.cpf)}</TableCell>
                  <TableCell data-rotulo="Perfil" className="py-2 pr-3 capitalize text-muted-foreground">{u.perfil}</TableCell>
                  <TableCell data-rotulo="Status" className="py-2 pr-3">
                    <Badge variant={u.ativo ? "success" : "destructive"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                    {u.autorizacaoResponsavel === "pendente" && <Badge variant="warning">Autorização pendente</Badge>}
                  </TableCell>
                  <TableCell data-rotulo="Cadastro" className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                    {new Date(u.criadoEm).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="celula-acoes py-2">
                    <div className="flex flex-wrap gap-1">
                      {u.autorizacaoResponsavel === "pendente" && (
                        <Button variant="outline" onClick={() => aprovarAutorizacaoResponsavel(u.id).then(() => setVersao((v) => v + 1))}>
                          Aprovar autorização
                        </Button>
                      )}
                      {u.ativo && u.id !== usuario.id && (
                        <Button
                          variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setErro("");
                            setDesativando({ id: u.id, nome: u.nomeCompleto });
                          }}
                        >
                          Desativar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {pag.totalPaginas > 1 && (
        <nav aria-label="Paginação de usuários" className="mt-3 flex items-center justify-between gap-2 text-sm">
          <Button variant="outline" disabled={pag.pagina === 1} onClick={() => setPagina(pag.pagina - 1)}>Anterior</Button>
          <span className="text-muted-foreground">Página {pag.pagina} de {pag.totalPaginas}</span>
          <Button variant="outline" disabled={pag.pagina === pag.totalPaginas} onClick={() => setPagina(pag.pagina + 1)}>Próxima</Button>
        </nav>
      )}
      <ModalTexto
        aberto={!!desativando}
        titulo="Desativar usuário"
        rotulo="Justificativa (obrigatória)"
        descricao={desativando ? `A conta de ${desativando.nome} será desativada e perderá o acesso à plataforma.` : undefined}
        confirmar="Desativar"
        destrutivo
        maximo={1000}
        onFechar={() => setDesativando(null)}
        onConfirmar={(j) => desativarUsuario(desativando!.id, j).then(() => setVersao((v) => v + 1))}
      />
    </section>
  );
}

/** Cabeçalho que ordena ao clicar; a seta mostra a direção e `aria-sort` informa o leitor de tela. */
function CabecalhoOrdenavel({ campo, ordenacao, onOrdenar }: {
  campo: CampoOrdenacaoUsuarios;
  ordenacao: OrdenacaoUsuarios;
  onOrdenar: (campo: CampoOrdenacaoUsuarios) => void;
}) {
  const ativo = ordenacao.campo === campo;
  const Icone = !ativo ? ArrowUpDown : ordenacao.direcao === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className="py-2 pr-3" aria-sort={ativo ? (ordenacao.direcao === "asc" ? "ascending" : "descending") : "none"}>
      <Button
        variant="plain" size="none"
        onClick={() => onOrdenar(campo)}
        className={`inline-flex items-center gap-1 uppercase hover:text-foreground ${ativo ? "text-foreground" : ""}`}
      >
        {ROTULO_ORDENACAO_USUARIOS[campo]}
        <Icone className={`h-3.5 w-3.5 shrink-0 ${ativo ? "" : "opacity-50"}`} aria-hidden />
      </Button>
    </TableHead>
  );
}
