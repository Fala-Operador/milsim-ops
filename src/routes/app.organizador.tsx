import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { carregarBase } from "@/services/db";
import { solicitarOrganizador, reenviarSolicitacao } from "@/api/organizador.functions";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { mascaraTelefone } from "@/lib/domain/validators";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/ui";
import type { StatusSolicitacao } from "@/lib/domain/types";
import { Label } from "@/components/ui/label";
import imgMilsim from "@/assets/modalidade-milsim.jpg";
import { tr } from "@/i18n/routes/app.organizador";

export const Route = createFileRoute("/app/organizador")({
  head: () => ({
    meta: [
      { title: tr("quero_ser_organizador_milsim_ops") },
      { name: "description", content: tr("solicite_o_perfil_de_organizador_e") },
      { property: "og:title", content: tr("quero_ser_organizador_milsim_ops") },
      { property: "og:description", content: tr("solicitacao_de_organizador") },
    ],
  }),
  component: QueroSerOrganizador,
});

const rotulos: Record<StatusSolicitacao, string> = {
  get pendente() { return tr("pendente"); },
  get em_analise() { return tr("em_analise"); },
  get ajustes_solicitados() { return tr("ajustes_solicitados"); },
  get aprovada() { return tr("aprovada"); },
  get rejeitada() { return tr("rejeitada"); },
};

function QueroSerOrganizador() {
  const { usuario, recarregar } = useAuth();
  const [, setVersao] = useState(0);
  const [possuiCnpj, setPossuiCnpj] = useState(false);
  const [f, setF] = useState({ cnpj: "", nomeOrganizacao: "", instagram: "", telefone: "" });
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  if (!usuario) return null;

  const solicitacoes = carregarBase()
    .solicitacoes.filter((s) => s.usuarioId === usuario.id)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const atual = solicitacoes[0];
  const podeNova = !atual || atual.status === "rejeitada";
  const precisaAjuste = atual?.status === "ajustes_solicitados";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      if (precisaAjuste && atual) {
        await reenviarSolicitacao(atual.id, f);
      } else {
        await solicitarOrganizador({ possuiCnpj, ...f });
      }
      setVersao((v) => v + 1);
      recarregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : tr("falha_ao_enviar"));
    } finally {
      setEnviando(false);
    }
  };

  if (usuario.perfil === "organizador") {
    return (
      <div className="border-l-2 border-success bg-success/5 px-5 py-4">
        <p className="font-semibold">{tr("voce_ja_e_organizador_aprovado")}</p>
        <Link to="/organizacao" className="mt-1 inline-block text-sm text-accent hover:underline">{tr("ir_para_minha_organizacao")}</Link>
      </div>
    );
  }

  // Linha do tempo do pedido: enviado → em análise → decisão.
  const etapaAtual = !atual ? -1 : atual.status === "pendente" ? 0 : atual.status === "em_analise" || atual.status === "ajustes_solicitados" ? 1 : 2;
  const ETAPAS = [
    { rotulo: tr("pedido_enviado"), detalhe: atual ? formatarDataHoraBR(atual.criadoEm) : tr("preencha_o_formulario") },
    { rotulo: atual?.status === "ajustes_solicitados" ? tr("ajustes_pedidos") : tr("em_analise"), detalhe: tr("a_administracao_confere_os_dados") },
    { rotulo: atual?.status === "rejeitada" ? tr("nao_aprovado") : tr("aprovado"), detalhe: tr("voce_recebe_a_area_da_organizacao") },
  ];

  return (
    <div className="space-y-8">
      <section className="relative isolate overflow-hidden rounded-lg border border-border bg-black text-white">
        <img src={imgMilsim} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/65 to-black/10" aria-hidden />
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-end">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">{tr("para_organizadores")}</p>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none sm:text-5xl">{tr("organize_a_sua_operacao_aqui")}</h1>
            <p className="mt-3 max-w-md text-sm text-white/80">{tr("publique_a_operacao_venda_os_ingressos")}</p>
          </div>
          <ul className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1">
            {[
              [tr("ingressos_e_lotes"), tr("venda_com_stripe_e_receba_na")],
              [tr("check_in_por_qr_code"), tr("funciona_tambem_sem_internet")],
              [tr("comunidade_e_missoes"), tr("foruns_avisos_e_pontos_por_exercito")],
            ].map(([t, d]) => (
              <li key={t} className="border-l-2 border-accent pl-3"><span className="block font-semibold">{t}</span><span className="text-white/70">{d}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="t-andamento">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="t-andamento" className="text-lg font-semibold">{tr("andamento_do_pedido")}</h2>
          {atual && (
            <span className="flex items-center gap-2 text-sm">
              <span className="font-medium">{atual.nomeOrganizacao}</span>
              <Badge variant={atual.status === "aprovada" ? "success" : atual.status === "rejeitada" ? "destructive" : "warning"}>{rotulos[atual.status]}</Badge>
            </span>
          )}
        </div>
        <ol className="mt-4 grid gap-0 overflow-hidden rounded-lg border border-border sm:grid-cols-3 sm:divide-x sm:divide-border">
          {ETAPAS.map((e, k) => {
            const feito = k < etapaAtual || (k === etapaAtual && atual?.status === "aprovada");
            const agora = k === etapaAtual && !feito;
            return (
              <li key={k} className={`flex gap-3 p-4 ${agora ? "bg-secondary" : ""}`} aria-current={agora ? "step" : undefined}>
                <span className={`grid size-7 shrink-0 place-items-center rounded-full border font-mono text-xs ${feito ? "border-success bg-success/15 text-success" : agora ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>
                  {feito ? "✓" : k + 1}
                </span>
                <span>
                  <span className={`block font-semibold ${!feito && !agora ? "text-muted-foreground" : ""}`}>{e.rotulo}</span>
                  <span className="text-xs text-muted-foreground">{k === 0 || agora ? e.detalhe : e.detalhe}</span>
                </span>
              </li>
            );
          })}
        </ol>
        {atual && <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{tr("atualizado_em_atualizadoem", { atualizadoEm: formatarDataHoraBR(atual.atualizadoEm) })}</p>}
        {atual?.observacaoAdmin && (
          <blockquote className="mt-4 border-l-2 border-warning bg-warning/5 px-4 py-3 text-sm">
            <p className="rotulo-tecnico">{tr("observacao_da_administracao")}</p>
            <p className="mt-1">{atual.observacaoAdmin}</p>
          </blockquote>
        )}
      </section>

      {(podeNova || precisaAjuste) && (
        <section aria-labelledby="t-form" className="border-t border-border pt-6">
          <h2 id="t-form" className="text-lg font-semibold">{precisaAjuste ? tr("corrija_os_dados_e_reenvie") : tr("dados_da_organizacao")}</h2>
          <form onSubmit={enviar} className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
            {!precisaAjuste && (
              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-medium">{tr("a_organizacao_tem_cnpj")}</legend>
                <RadioGroup className="mt-2 grid max-w-sm grid-cols-2 gap-2 text-sm" value={possuiCnpj ? "sim" : "nao"} onValueChange={(v) => setPossuiCnpj(v === "sim")}>
                  {[["sim", tr("sim_tenho_cnpj")], ["nao", tr("ainda_nao")]].map(([v, r]) => (
                    <Label key={v} className="flex cursor-pointer items-center gap-2 rounded-md border p-3 font-normal has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/5"><RadioGroupItem value={v!} />{r}</Label>
                  ))}
                </RadioGroup>
              </fieldset>
            )}
            {possuiCnpj && !precisaAjuste && (
              <Campo rotulo="CNPJ" htmlFor="cnpj">
                <Input id="cnpj" value={f.cnpj} onChange={(e) => setF((p) => ({ ...p, cnpj: e.target.value }))} required className="font-mono" />
              </Campo>
            )}
            <Campo rotulo={tr("nome_da_organizacao")} htmlFor="nomeorg">
              <Input id="nomeorg" value={f.nomeOrganizacao} onChange={(e) => setF((p) => ({ ...p, nomeOrganizacao: e.target.value }))} required />
            </Campo>
            <Campo rotulo={tr("instagram_da_organizacao")} htmlFor="instaorg">
              <Input id="instaorg" value={f.instagram} onChange={(e) => setF((p) => ({ ...p, instagram: e.target.value }))} placeholder="@suaorganizacao" />
            </Campo>
            <Campo rotulo={tr("telefone_para_contato")} htmlFor="telorg">
              <Input id="telorg" value={f.telefone} onChange={(e) => setF((p) => ({ ...p, telefone: mascaraTelefone(e.target.value) }))} required />
            </Campo>
            {erro && <p role="alert" className="text-sm text-destructive sm:col-span-2">{erro}</p>}
            <div className="sm:col-span-2">
              <Button type="submit" size="lg" disabled={enviando}>{precisaAjuste ? tr("corrigir_e_reenviar") : tr("enviar_pedido")}</Button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
