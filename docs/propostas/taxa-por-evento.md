# Proposta: taxa da plataforma por evento

> **Status:** em análise, aguardando decisões (ver [Decisões pendentes](#decisões-pendentes)).
> Nada disto está implementado. Quando for aprovado, as regras passam para
> [regras-de-negocio.md](../regras-de-negocio.md) e a API ganha a página dela em `docs/api/`.

## Objetivo

Hoje existe **uma única taxa da plataforma** (`/admin/pagamentos`), aplicada a todas as vendas.
A ideia é ter uma **taxa padrão** e permitir que o admin defina uma **taxa própria por evento**.

Exemplo: padrão de 5%; o evento 2 negociou 2%; o evento 3 paga 10%.

Além disso, o **custo do cartão (tarifa do Stripe) passa a ser repassado** e a taxa da
plataforma é somada a ele. Assim a tarifa do Stripe nunca sai do bolso da plataforma e o
percentual definido é margem de verdade.

## Como funciona hoje

- A taxa global fica em `platform_settings.platform_fee_percent`, lida por `taxaDaPlataforma`
  (`src/lib/repasses.ts`) e alterada por `definirTaxaPlataformaNaBase` (`src/services/repasses.ts`).
- Na reserva, `pagamentoInicial` (`src/services/inscricoes.ts`) calcula
  `taxaCentavos = taxaPlataforma(valor, taxaDaPlataforma(base))` e **grava o valor na reserva**.
  Esse valor vira o `application_fee` da cobrança com destino à conta da organização (Stripe Connect).
- Como a taxa é gravada na reserva, mudar a configuração **não altera vendas já feitas**, e os
  relatórios (`resumoVendas`) somam o valor gravado em cada pagamento.
- Nas cobranças com destino (*destination charges*), **a tarifa do Stripe é cobrada da plataforma**.
  Com taxa baixa (ex.: 2%), a plataforma teria prejuízo em cada venda com cartão.
- A **taxa de serviço do comprador** (`organizations.buyer_fee_percent`, definida por cada
  organização e somada ao ingresso) é outra coisa e **não muda** nesta proposta.

## Regra proposta

**Valor retido em cada venda = custo de processamento + taxa da plataforma do evento.**

| Termo | O que é | Onde fica |
|---|---|---|
| Custo de processamento | Estimativa fixa da tarifa do cartão: percentual + valor fixo (ex.: 3,99% + R$ 0,39) | Nova configuração em `platform_settings`, editada em `/admin/pagamentos` |
| Taxa padrão | Percentual da plataforma usado quando o evento não tem taxa própria | `platform_settings.platform_fee_percent` (já existe) |
| Taxa do evento | Percentual próprio, opcional; vazio = usa o padrão | Nova coluna opcional em `events` (`platform_fee_percent`) |

Exemplo com ingresso de **R$ 150,00** e custo de 3,99% + R$ 0,39 (valores ilustrativos; confirmar
a tarifa real no painel do Stripe):

| | Evento 1 (5%) | Evento 2 (2%) | Evento 3 (10%) |
|---|---|---|---|
| Custo de processamento | R$ 6,38 | R$ 6,38 | R$ 6,38 |
| Taxa da plataforma | R$ 7,50 | R$ 3,00 | R$ 15,00 |
| **Retido pela plataforma** | R$ 13,88 | R$ 9,38 | R$ 21,38 |
| **Organização recebe** | R$ 136,12 | R$ 140,62 | R$ 128,62 |

### Regras

- **Quem altera:** só o admin. O organizador vê a taxa do seu evento, mas não edita.
- **Proteção no editor de eventos:** o editor salva o evento inteiro. O servidor deve **manter a
  taxa já gravada** quando quem salva não é admin, para o organizador não conseguir apagá-la nem
  trocá-la.
- **Quem vê:** admin e quem administra o evento. Público e participantes não veem (filtrado em
  `visaoParaUsuario`, com teste).
- **Validade:** vale para reservas feitas **a partir da alteração**. Reservas existentes mantêm a
  taxa gravada nelas, como hoje.
- **Registro na reserva:** gravar as duas partes separadas (custo e taxa da plataforma), para os
  relatórios mostrarem quanto foi custo e quanto foi margem. A soma continua sendo o
  `application_fee` enviado ao Stripe.
- **Auditoria:** cada alteração entra na auditoria. Exemplo: "Taxa do evento X: padrão 5% → 2%".
- **Reembolsos:** sem mudança. Reembolsos de vendas repassadas já estornam a transferência e a taxa.

### Limitação conhecida: o custo é uma estimativa

A tarifa real do Stripe varia por meio de pagamento: Pix é mais barato e cartão estrangeiro é mais
caro. Com uma estimativa fixa, a plataforma ganha a diferença no Pix e pode perder alguns centavos
num cartão estrangeiro. O valor exato só é conhecido depois da cobrança (`balance_transaction`).
Usar esse valor exigiria ajustar a taxa depois do pagamento, o que complica bastante o fluxo.

**Recomendação:** começar com a estimativa fixa e revisar se a diferença ficar relevante.

## Telas

- **`/admin/pagamentos`:**
  - Custo de processamento: percentual + valor fixo.
  - Taxa padrão da plataforma (já existe).
  - Seção **"Taxas por evento"**: lista dos eventos com taxa própria, busca para definir a taxa de
    um evento e botão "Voltar ao padrão".
- **Organizador (Financeiro e página de gestão do evento):** mostrar a conta aberta, para evitar
  reclamação do tipo "a taxa era 2% e me descontaram 6%". Exemplo:
  "Processamento 3,99% + R$ 0,39 · Plataforma 2% · Você recebe R$ 140,62".

## Impacto técnico

| Parte | Mudança |
|---|---|
| Migration | Coluna opcional `events.platform_fee_percent numeric(5,2)` com check 0–50. Colunas do custo de processamento em `platform_settings`. Colunas da reserva para as duas partes da taxa. Sem apagar nada. |
| `src/lib/esquemaBanco.ts` | Mapear as colunas novas. |
| `src/lib/repasses.ts` | `taxaDoEvento(base, evento)` (evento → padrão) e cálculo do custo de processamento: um lugar só decide a taxa. |
| `src/services/inscricoes.ts` | `pagamentoInicial` usa `taxaDoEvento` + custo de processamento. |
| `src/services/repasses.ts` + `src/api/repasses.functions.ts` | Novas operações de admin: definir/limpar taxa do evento e definir custo de processamento. |
| `src/lib/visao.ts` | Esconder a taxa do evento de quem não administra o evento. |
| Editor de eventos | Servidor preserva a taxa em salvamentos de não admin. |
| Testes | Regra da taxa (evento, padrão, limites), cálculo do valor retido, visão, preservação no editor. |
| Docs | `regras-de-negocio.md`, `fluxos.md` (pagamento) e páginas das APIs novas. |

## Decisões pendentes

1. **Quem paga o custo de processamento?**
   - **Organizador** (descontado do repasse, como no exemplo acima). Entendimento atual.
   - Comprador (somado ao valor do ingresso no checkout).
2. **Taxa por organização também?**
   - Só evento → padrão.
   - Evento → organização → padrão (útil para acordos que valem para todos os eventos de um organizador).
3. **Eventos encerrados ou cancelados:** bloquear a alteração da taxa? Recomendação: bloquear, porque
   não teria efeito.
4. **Limite da taxa do evento:** manter 0% a 50%, igual à taxa padrão?
5. **Valor do custo de processamento:** confirmar a tarifa real no painel do Stripe antes de configurar.
