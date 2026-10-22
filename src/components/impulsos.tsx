// Administração → Página inicial e divulgação → Impulsionamentos: preço, validade e venda
// dos tipos de impulso, e as compras feitas pelas organizações.
import { useEffect, useState } from "react";
import type { BaseDados, PlanoImpulsoId } from "@/lib/domain/types";
import { ROTULO_STATUS_IMPULSO, erroPlano, imagemPadraoImpulso, planosDeImpulso, rotuloDuracao, statusDoImpulso } from "@/lib/impulsos";
import { salvarPlanosImpulso, sincronizarPlanosImpulso } from "@/api/impulsos.functions";
import { configuracaoRepasse } from "@/api/repasses.functions";
import { arquivoParaDataUrl } from "@/lib/imagens";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Linha { id: PlanoImpulsoId; rotulo: string; preco: string; validade: string; ativo: boolean; imagem: string }

const paraLinhas = (base: BaseDados): Linha[] =>
  planosDeImpulso(base).map((p) => ({
    id: p.id, rotulo: p.rotulo, preco: (p.precoCentavos / 100).toFixed(2).replace(".", ","), validade: String(p.validadeDias), ativo: p.ativo, imagem: p.imagemUrl ?? imagemPadraoImpulso(p.id),
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
      if (sinc?.erros.length) setErro(`Salvo, mas o Stripe recusou: ${sinc.erros.join(" ")}`);
      setAviso(`Impulsos atualizados. Os novos valores valem para as próximas compras.${sinc && !sinc.erros.length ? " Produtos do Stripe em dia." : ""}`);
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
      if (r.erros.length) setErro(`O Stripe recusou: ${r.erros.join(" ")}`);
      setAviso(`${r.sincronizados} de ${linhas.length} produtos sincronizados com o Stripe.`);
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

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-medium">Impulsos à venda para as organizações</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          A organização compra em Minha organização → Impulsionar, paga à plataforma pelo Stripe e usa numa operação publicada dentro da validade (contada do pagamento).
          O impulso usado vira uma campanha abaixo, nos destaques e no topo da listagem, em todo o Brasil. Preço 0 libera o tipo de graça.
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table className="w-full min-w-[760px] text-sm">
          <TableHeader className="text-left text-xs uppercase text-muted-foreground">
            <TableRow>{["Imagem", "Tipo", "Preço (R$)", "Validade (dias)", "À venda"].map((h) => <TableHead key={h} className="px-2 py-2">{h}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={l.id} className="border-t border-border">
                <TableCell className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <img src={l.imagem} alt={`Imagem do ${l.rotulo}`} className="h-12 w-[72px] shrink-0 rounded object-cover" />
                    <div className="flex flex-col gap-1">
                      <Input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Trocar imagem do ${l.rotulo}`}
                        className="h-8 max-w-48 text-xs" onChange={(e) => void trocarImagem(l.id, e.target.files?.[0])} />
                      {l.imagem !== imagemPadraoImpulso(l.id) && (
                        <Button type="button" variant="ghost" size="sm" className="h-6 justify-start px-1 text-xs" onClick={() => mudar(l.id, { imagem: imagemPadraoImpulso(l.id) })}>
                          Usar a padrão
                        </Button>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-2 py-2 font-medium">{l.rotulo}</TableCell>
                <TableCell className="px-2 py-2">
                  <Input aria-label={`Preço do ${l.rotulo}`} inputMode="decimal" value={l.preco} onChange={(e) => mudar(l.id, { preco: e.target.value })} className="max-w-32" />
                </TableCell>
                <TableCell className="px-2 py-2">
                  <Input aria-label={`Validade do ${l.rotulo}`} inputMode="numeric" value={l.validade} onChange={(e) => mudar(l.id, { validade: e.target.value })} className="max-w-24" />
                </TableCell>
                <TableCell className="px-2 py-2">
                  <Label className="flex items-center gap-2">
                    <Checkbox checked={l.ativo} onCheckedChange={(v) => mudar(l.id, { ativo: v === true })} />
                    {l.ativo ? "Sim" : "Não"}
                  </Label>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {aviso && <p role="status" className="text-sm text-success">{aviso}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={salvando} onClick={() => void salvar()}>{salvando ? "Salvando…" : "Salvar impulsos"}</Button>
        {stripeAtivo && <Button type="button" variant="outline" disabled={salvando} onClick={() => void sincronizar()}>Sincronizar com o Stripe</Button>}
      </div>
      <p className="text-xs text-muted-foreground">
        {stripeAtivo
          ? `Cada tipo é um produto do catálogo do Stripe da plataforma (nome, imagem e preço), atualizado ao salvar. ${sincronizacao ? `Última sincronização completa: ${new Date(sincronizacao).toLocaleString("pt-BR")}.` : "Ainda não sincronizado."}`
          : "Com os pagamentos online desligados, os produtos do Stripe não são criados."}
      </p>
      <VendasImpulso base={base} />
    </Card>
  );
}

function VendasImpulso({ base }: { base: BaseDados }) {
  const agora = new Date();
  const vendas = base.impulsosComprados
    .filter((i) => i.pagoEm)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .slice(0, 50);
  if (!vendas.length) return <p className="text-sm text-muted-foreground">Nenhum impulso vendido ainda.</p>;
  const nomeOrg = (id: string) => base.organizacoes.find((o) => o.id === id)?.nome ?? "Organização removida";
  const nomeEvento = (id?: string) => (id ? base.eventos.find((e) => e.id === id)?.nome ?? "Operação removida" : "—");
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Últimas vendas</h4>
      <div className="overflow-x-auto">
        <Table className="w-full min-w-[640px] text-sm">
          <TableHeader className="text-left text-xs uppercase text-muted-foreground">
            <TableRow>{["Organização", "Impulso", "Pago em", "Situação", "Operação"].map((h) => <TableHead key={h} className="px-2 py-2">{h}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {vendas.map((i) => (
              <TableRow key={i.id} className="border-t border-border">
                <TableCell className="px-2 py-2">{nomeOrg(i.organizacaoId)}</TableCell>
                <TableCell className="px-2 py-2 whitespace-nowrap">{rotuloDuracao(i.duracaoHoras)} · {formatarBRL(i.precoCentavos)}</TableCell>
                <TableCell className="px-2 py-2 whitespace-nowrap">{formatarDataBR(i.pagoEm!)}</TableCell>
                <TableCell className="px-2 py-2"><Badge variant="outline">{ROTULO_STATUS_IMPULSO[statusDoImpulso(i, agora)]}</Badge></TableCell>
                <TableCell className="px-2 py-2">{nomeEvento(i.eventoId)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
