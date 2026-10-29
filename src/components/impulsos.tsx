// Administração → Loja da plataforma → Impulsos de operações: preço, validade e venda
// dos tipos de impulso, e as compras feitas pelas organizações.
import { useEffect, useState } from "react";
import { ImageUp } from "lucide-react";
import type { BaseDados, PlanoImpulsoId } from "@/lib/domain/types";
import { ROTULO_STATUS_IMPULSO, erroPlano, imagemPadraoImpulso, planosDeImpulso, duracaoNaTela, nomeImpulso, statusDoImpulso } from "@/lib/impulsos";
import { salvarPlanosImpulso, sincronizarPlanosImpulso } from "@/api/impulsos.functions";
import { configuracaoRepasse } from "@/api/repasses.functions";
import { arquivoParaDataUrl } from "@/lib/imagens";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EstadoVazio } from "@/components/ui";
import { FaixaIndicadores } from "@/components/FaixaIndicadores";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tr } from "@/i18n/components/impulsos";
import { localeAtual } from "@/i18n/dicionario";

interface Linha { id: PlanoImpulsoId; rotulo: string; preco: string; validade: string; ativo: boolean; imagem: string }

const paraLinhas = (base: BaseDados): Linha[] =>
  planosDeImpulso(base).map((p) => ({
    id: p.id, rotulo: nomeImpulso(p.duracaoHoras), preco: (p.precoCentavos / 100).toFixed(2).replace(".", ","), validade: String(p.validadeDias), ativo: p.ativo, imagem: p.imagemUrl ?? imagemPadraoImpulso(p.id),
  }));

const centavos = (preco: string) => Math.round(Number(preco.trim().replace(/\./g, "").replace(",", ".")) * 100);

export function PlanosImpulso({ base }: { base: BaseDados }) {
  const [linhas, setLinhas] = useState(() => paraLinhas(base));
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [stripeAtivo, setStripeAtivo] = useState(false);
  useEffect(() => { configuracaoRepasse().then((c) => setStripeAtivo(c.pagamentoOnline)).catch(() => setStripeAtivo(false)); }, []);
  const chave = JSON.stringify(planosDeImpulso(base));
  // Mantém os campos em dia quando os preços mudam (outra aba, outro admin).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setLinhas(paraLinhas(base)), [chave]);

  const mudar = (id: PlanoImpulsoId, campo: Partial<Linha>) => {
    setErro(""); setAviso("");
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...campo } : l)));
  };

  const salvar = async () => {
    setErro(""); setAviso("");
    const planos = linhas.map((l) => ({ id: l.id, precoCentavos: centavos(l.preco), validadeDias: Number(l.validade), ativo: l.ativo, imagemUrl: l.imagem }));
    for (const [i, p] of planos.entries()) {
      const e = erroPlano(p);
      if (e) return setErro(`${linhas[i]!.rotulo}: ${e}`);
    }
    setSalvando(true);
    try {
      const sinc = await salvarPlanosImpulso(planos);
      if (sinc?.erros.length) setErro(tr("salvo_mas_o_stripe_recusou_valor", { valor: sinc.erros.join(" ") }));
      setAviso(tr("impulsos_atualizados") + (sinc && !sinc.erros.length ? ` ${tr("produtos_do_stripe_em_dia")}` : ""));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const sincronizar = async () => {
    setErro(""); setAviso(""); setSalvando(true);
    try {
      const r = await sincronizarPlanosImpulso();
      if (r.erros.length) setErro(tr("o_stripe_recusou_valor", { valor: r.erros.join(" ") }));
      setAviso(tr("sincronizados_de_length_produtos_sincron", { sincronizados: r.sincronizados, length: linhas.length }));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };
  const trocarImagem = async (id: PlanoImpulsoId, arquivo: File | undefined) => {
    if (!arquivo) return;
    try { mudar(id, { imagem: await arquivoParaDataUrl(arquivo, 1200) }); } catch (e) { setErro((e as Error).message); }
  };
  const datas = planosDeImpulso(base).map((p) => p.sincronizadoEm);
  const sincronizacao = datas.every(Boolean) ? (datas as string[]).sort().at(0) : undefined;

  const pagos = base.impulsosComprados.filter((i) => i.pagoEm);
  const receita = pagos.reduce((t, i) => t + i.precoCentavos, 0);
  const agora = new Date();
  const disponiveis = pagos.filter((i) => statusDoImpulso(i, agora) === "disponivel").length;

  return (
    <div className="space-y-8">
      <FaixaIndicadores className="lg:grid-cols-4" itens={[
        { rotulo: tr("impulsos_vendidos"), valor: String(pagos.length) },
        { rotulo: tr("receita_bruta"), valor: formatarBRL(receita) },
        { rotulo: tr("comprados_e_nao_usados"), valor: String(disponiveis) },
        { rotulo: tr("tipos_a_venda"), valor: `${linhas.filter((l) => l.ativo).length} de ${linhas.length}` },
      ]} />

      <section aria-labelledby="t-catalogo">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 id="t-catalogo" className="text-lg font-semibold">{tr("catalogo")}</h4>
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${stripeAtivo ? "bg-success" : "bg-muted-foreground"}`} aria-hidden />
            {stripeAtivo ? tr("stripe_ligado_catalogo_sincronizado_ao_s") : tr("pagamentos_online_desligados")}
          </p>
        </div>
        <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">{tr("a_organizacao_compra_em_minha_organizaca")}</p>
        <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {linhas.map((l) => {
            const preco = centavos(l.preco);
            return (
              <li key={l.id} className={`overflow-hidden rounded-lg border border-border ${l.ativo ? "" : "opacity-70"}`}>
                <div className="relative aspect-[16/9] bg-secondary">
                  <img src={l.imagem} alt={tr("imagem_do_rotulo", { rotulo: l.rotulo })} className="absolute inset-0 h-full w-full object-cover" />
                  <Label className="absolute right-3 top-3 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-white/30 bg-black/40 px-2.5 text-xs font-medium text-white hover:bg-black/60 focus-within:ring-2 focus-within:ring-ring">
                    <ImageUp className="size-3.5" aria-hidden="true" />{tr("trocar")}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={tr("trocar_imagem_do_rotulo", { rotulo: l.rotulo })}
                      onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ""; void trocarImagem(l.id, a); }} />
                  </Label>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-3">
                  <p className="flex min-w-0 items-center gap-2 font-semibold">
                    <span className="truncate">{l.rotulo}</span>
                    <Badge variant={l.ativo ? "success" : "secondary"}>{l.ativo ? tr("a_venda") : tr("pausado")}</Badge>
                  </p>
                  <p className="font-display text-2xl font-bold tabular-nums leading-none">{Number.isFinite(preco) ? (preco === 0 ? tr("gratis") : formatarBRL(preco)) : "—"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 p-4">
                  <div>
                    <Label htmlFor={`preco-${l.id}`} className="rotulo-tecnico">{tr("preco")}</Label>
                    <div className="mt-1 flex items-center rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
                      <span className="pl-3 font-mono text-xs text-muted-foreground">R$</span>
                      <Input id={`preco-${l.id}`} inputMode="decimal" value={l.preco} onChange={(e) => mudar(l.id, { preco: e.target.value })}
                        className="border-0 font-mono tabular-nums shadow-none focus-visible:ring-0" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`validade-${l.id}`} className="rotulo-tecnico">{tr("validade")}</Label>
                    <div className="mt-1 flex items-center rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
                      <Input id={`validade-${l.id}`} inputMode="numeric" value={l.validade} onChange={(e) => mudar(l.id, { validade: e.target.value })}
                        className="border-0 font-mono tabular-nums shadow-none focus-visible:ring-0" />
                      <span className="pr-3 font-mono text-xs text-muted-foreground">{tr("dias")}</span>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-between gap-3 border-t border-border pt-3">
                    <Label htmlFor={`ativo-${l.id}`} className="text-sm">{tr("vender_para_as_organizacoes")}</Label>
                    <Switch id={`ativo-${l.id}`} checked={l.ativo} onCheckedChange={(v) => mudar(l.id, { ativo: v })} />
                  </div>
                  {l.imagem !== imagemPadraoImpulso(l.id) && (
                    <Button type="button" variant="link" size="none" className="col-span-2 justify-start text-xs text-muted-foreground" onClick={() => mudar(l.id, { imagem: imagemPadraoImpulso(l.id) })}>{tr("voltar_para_a_imagem_padrao")}</Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
          <div className="min-w-0 text-sm">
            {erro ? <p role="alert" className="text-destructive">{erro}</p>
              : aviso ? <p role="status" className="text-success">{aviso}</p>
              : <p className="text-muted-foreground">{tr("os_novos_valores_valem_para_as")}{stripeAtivo && ` ${sincronizacao ? tr("ultima_sincronizacao_valor", { valor: new Date(sincronizacao).toLocaleString(localeAtual()) }) : tr("ainda_nao_sincronizado")}`}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {stripeAtivo && <Button type="button" variant="ghost" disabled={salvando} onClick={() => void sincronizar()}>{tr("sincronizar_com_o_stripe")}</Button>}
            <Button type="button" disabled={salvando} onClick={() => void salvar()}>{salvando ? tr("salvando") : tr("salvar_catalogo")}</Button>
          </div>
        </div>
      </section>

      <VendasImpulso base={base} />
    </div>
  );
}

function VendasImpulso({ base }: { base: BaseDados }) {
  const agora = new Date();
  const vendas = base.impulsosComprados
    .filter((i) => i.pagoEm)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .slice(0, 50);
  if (!vendas.length) return <EstadoVazio titulo={tr("nenhum_impulso_vendido")} descricao={tr("as_compras_das_organizacoes_aparecem_aqu")} />;
  const nomeOrg = (id: string) => base.organizacoes.find((o) => o.id === id)?.nome ?? tr("organizacao_removida");
  const nomeEvento = (id?: string) => (id ? base.eventos.find((e) => e.id === id)?.nome ?? tr("operacao_removida") : "—");
  return (
    <section aria-labelledby="t-vendas" className="space-y-2">
      <h4 id="t-vendas" className="text-lg font-semibold">{tr("ultimas_vendas")}</h4>
      <div className="overflow-x-auto">
        <Table className="w-full min-w-[640px] text-sm">
          <TableHeader className="text-left text-xs uppercase text-muted-foreground">
            <TableRow>{[tr("pago_em"), tr("organizacao"), tr("impulso"), tr("operacao"), tr("situacao"), tr("valor")].map((h) => <TableHead key={h} className={`rotulo-tecnico px-2 py-2 ${h === "Valor" ? "text-right" : ""}`}>{h}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {vendas.map((i) => (
              <TableRow key={i.id} className="border-t border-border">
                <TableCell className="px-2 py-2 whitespace-nowrap font-mono text-xs text-muted-foreground">{formatarDataBR(i.pagoEm!)}</TableCell>
                <TableCell className="px-2 py-2 font-medium">{nomeOrg(i.organizacaoId)}</TableCell>
                <TableCell className="px-2 py-2 whitespace-nowrap">{duracaoNaTela(i.duracaoHoras)}</TableCell>
                <TableCell className="px-2 py-2">{nomeEvento(i.eventoId)}</TableCell>
                <TableCell className="px-2 py-2"><Badge variant="outline">{ROTULO_STATUS_IMPULSO[statusDoImpulso(i, agora)]}</Badge></TableCell>
                <TableCell className="px-2 py-2 text-right font-mono tabular-nums">{formatarBRL(i.precoCentavos)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
