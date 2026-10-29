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
import { tr } from "@/i18n/routes/admin.usuarios";
import { localeAtual } from "@/i18n/dicionario";

const ROTULO_PERFIL = {
  participante: () => tr("perfil_participante"),
  organizador: () => tr("perfil_organizador"),
  admin: () => tr("perfil_admin"),
} as const;

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({
    meta: [
      { title: tr("usuarios_admin_milsim_ops") },
      { name: "description", content: tr("gestao_de_usuarios_da_plataforma") },
      { property: "og:title", content: tr("usuarios_admin_milsim_ops") },
      { property: "og:description", content: tr("gestao_de_usuarios") },
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
      <h2 className="titulo-pagina">{tr("usuarios")}</h2>
      <FaixaIndicadores className="mt-4 lg:grid-cols-4" itens={[
        { rotulo: tr("usuarios_ativos"), valor: String(ativos.length), detalhe: tr("de_length_cadastrados", { length: base.usuarios.length }) },
        { rotulo: tr("participantes"), valor: String(porPerfil("participante")) },
        { rotulo: tr("organizadores"), valor: String(porPerfil("organizador")) },
        { rotulo: tr("admins_inativos"), valor: `${porPerfil("admin")} · ${base.usuarios.length - ativos.length}` },
      ]} />

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1fr)_180px_200px]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label={tr("buscar_por_nome_e_mail_ou")}
            placeholder={tr("buscar_por_nome_e_mail_ou")}
            value={filtros.busca}
            onChange={(e) => mudarFiltros({ busca: e.target.value })}
            className="pl-9"
          />
        </div>
        <NativeSelect aria-label={tr("filtrar_por_perfil")} value={filtros.perfil} onChange={(e) => mudarFiltros({ perfil: e.target.value as FiltrosUsuarios["perfil"] })}>
          <option value="">{tr("todos_os_perfis")}</option>
          <option value="participante">{tr("participantes")}</option>
          <option value="organizador">{tr("organizadores")}</option>
          <option value="admin">{tr("admins")}</option>
        </NativeSelect>
        <NativeSelect aria-label={tr("filtrar_por_status")} value={filtros.status} onChange={(e) => mudarFiltros({ status: e.target.value as FiltrosUsuarios["status"] })}>
          <option value="">{tr("todos_os_status")}</option>
          <option value="ativo">{tr("ativos")}</option>
          <option value="inativo">{tr("inativos")}</option>
          <option value="autorizacao_pendente">{tr("autorizacao_pendente")}</option>
        </NativeSelect>
        {/* Abaixo de lg a tabela vira cartões e o cabeçalho some: a ordem é escolhida aqui. */}
        <NativeSelect
          aria-label={tr("ordenar_por")}
          className="sm:col-span-2 lg:hidden"
          value={`${ordenacao.campo}:${ordenacao.direcao}`}
          onChange={(e) => {
            const [campo, direcao] = e.target.value.split(":") as [CampoOrdenacaoUsuarios, OrdenacaoUsuarios["direcao"]];
            ordenar({ campo, direcao });
          }}
        >
          <option value="cadastro:desc">{tr("cadastro_mais_recente")}</option>
          <option value="cadastro:asc">{tr("cadastro_mais_antigo")}</option>
          <option value="nome:asc">{tr("nome_a_z")}</option>
          <option value="nome:desc">{tr("nome_z_a")}</option>
          <option value="email:asc">{tr("e_mail_a_z")}</option>
          <option value="email:desc">{tr("e_mail_z_a")}</option>
          <option value="perfil:asc">{tr("perfil_a_z")}</option>
          <option value="perfil:desc">{tr("perfil_z_a")}</option>
          <option value="status:asc">{tr("ativos_primeiro")}</option>
          <option value="status:desc">{tr("inativos_primeiro")}</option>
        </NativeSelect>
      </div>
      <div className="mt-2 flex min-h-9 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span aria-live="polite">
          {encontrados.length === 0
            ? tr("nenhum_usuario_encontrado")
            : tr.plural(encontrados.length, "faixa_usuario", "faixa_usuarios", { inicio: pag.inicio + 1, fim: pag.fim })}
        </span>
        {filtrando && (
          <Button variant="ghost" size="sm" onClick={() => { setFiltros(FILTROS_USUARIOS_VAZIOS); setPagina(1); }}>
            <X className="h-4 w-4" />{" "}{tr("limpar_filtros")}</Button>
        )}
      </div>

      {erro && <p role="alert" className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      {encontrados.length === 0 ? (
        <div className="mt-3">
          <EstadoVazio titulo={tr("nenhum_usuario_encontrado")} descricao={tr("ajuste_a_busca_ou_limpe_os")} />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <Table className="tabela-cards w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                {cabecalho("nome")}
                {cabecalho("email")}
                <TableHead className="py-2 pr-3">{tr("cpf")}</TableHead>
                {cabecalho("perfil")}
                {cabecalho("status")}
                {cabecalho("cadastro")}
                <TableHead className="py-2">{tr("acoes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pag.itens.map((u) => (
                <TableRow key={u.id} className="border-b border-border/50">
                  <TableCell className="py-2 pr-3 font-medium lg:font-normal">{u.nomeCompleto}</TableCell>
                  <TableCell data-rotulo={tr("e_mail")} className="py-2 pr-3 break-all">{u.email}</TableCell>
                  <TableCell data-rotulo="CPF" className="py-2 pr-3 font-mono text-xs">{mascararCpf(u.cpf)}</TableCell>
                  <TableCell data-rotulo={tr("perfil")} className="py-2 pr-3 text-muted-foreground">{ROTULO_PERFIL[u.perfil]()}</TableCell>
                  <TableCell data-rotulo={tr("status")} className="py-2 pr-3">
                    <Badge variant={u.ativo ? "success" : "destructive"}>{u.ativo ? tr("ativo") : tr("inativo")}</Badge>
                    {u.autorizacaoResponsavel === "pendente" && <Badge variant="warning">{tr("autorizacao_pendente")}</Badge>}
                  </TableCell>
                  <TableCell data-rotulo={tr("cadastro")} className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                    {new Date(u.criadoEm).toLocaleDateString(localeAtual())}
                  </TableCell>
                  <TableCell className="celula-acoes py-2">
                    <div className="flex flex-wrap gap-1">
                      {u.autorizacaoResponsavel === "pendente" && (
                        <Button variant="outline" onClick={() => aprovarAutorizacaoResponsavel(u.id).then(() => setVersao((v) => v + 1))}>{tr("aprovar_autorizacao")}</Button>
                      )}
                      {u.ativo && u.id !== usuario.id && (
                        <Button
                          variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setErro("");
                            setDesativando({ id: u.id, nome: u.nomeCompleto });
                          }}
                        >{tr("desativar")}</Button>
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
        <nav aria-label={tr("paginacao_de_usuarios")} className="mt-3 flex items-center justify-between gap-2 text-sm">
          <Button variant="outline" disabled={pag.pagina === 1} onClick={() => setPagina(pag.pagina - 1)}>{tr("anterior")}</Button>
          <span className="text-muted-foreground">{tr("pagina_pagina_de_totalpaginas", { pagina: pag.pagina, totalPaginas: pag.totalPaginas })}</span>
          <Button variant="outline" disabled={pag.pagina === pag.totalPaginas} onClick={() => setPagina(pag.pagina + 1)}>{tr("proxima")}</Button>
        </nav>
      )}
      <ModalTexto
        aberto={!!desativando}
        titulo={tr("desativar_usuario")}
        rotulo={tr("justificativa_obrigatoria")}
        descricao={desativando ? tr("a_conta_de_nome_sera_desativada", { nome: desativando.nome }) : undefined}
        confirmar={tr("desativar")}
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
