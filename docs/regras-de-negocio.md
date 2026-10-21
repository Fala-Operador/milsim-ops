# Regras de negócio

[← Documentação](README.md) · [Fluxos](fluxos.md) · [APIs](api/README.md) · [Arquitetura](ARQUITETURA.md)

O que o sistema decide e onde essa decisão mora no código. Cada regra existe **num lugar só**
(função pura em `src/lib/` ou operação em `src/services/`) e é reaplicada no servidor em toda
escrita. As telas só refletem o resultado. Valores entre parênteses são os limites atuais.

## Sumário

1. [Perfis e permissões](#1-perfis-e-permissões)
2. [Conta e cadastro](#2-conta-e-cadastro)
3. [Organizações](#3-organizações)
4. [Eventos](#4-eventos)
5. [Ingressos, lotes e cupons](#5-ingressos-lotes-e-cupons)
6. [Inscrição](#6-inscrição)
7. [Pagamento online (Stripe)](#7-pagamento-online-stripe)
8. [Cancelamento, estorno e reembolso](#8-cancelamento-estorno-e-reembolso)
9. [Repasse às organizações e taxa](#9-repasse-às-organizações-e-taxa)
10. [Financeiro do evento](#10-financeiro-do-evento)
11. [Check-in](#11-check-in)
12. [Participação, insígnias e recompensas](#12-participação-insígnias-e-recompensas)
13. [Comunidade](#13-comunidade)
14. [Central de Suporte](#14-central-de-suporte)
15. [Página inicial, divulgação e impulsionamento](#15-página-inicial-divulgação-e-impulsionamento)
16. [Métricas](#16-métricas)
17. [Notificações](#17-notificações)
18. [Privacidade e dados pessoais](#18-privacidade-e-dados-pessoais)
19. [Lacunas conhecidas](#19-lacunas-conhecidas)

---

## 1. Perfis e permissões

| Perfil | Quem é | Pode |
|---|---|---|
| Visitante | sem login (ou conta desativada) | ver eventos públicos, página inicial e perfis em modo restrito |
| Participante | toda conta nova | inscrever-se, comunidade dos eventos em que está confirmado, suporte, perfil, privacidade |
| Organizador | participante com organização aprovada | tudo do participante + gerir os eventos da própria organização |
| Admin | definido no banco | tudo, em qualquer organização, mais administração da plataforma |

- **Gestão do evento** = organizador da organização dona do evento **ou** admin. Vale para editar,
  publicar, cancelar, cupons, cortesias, inscritos, check-in, financeiro, comunidade e métricas.
- **Membro da comunidade** = quem tem inscrição **confirmada** no evento (reserva pendente não conta).
- A identidade vem sempre da sessão; nenhuma API confia em `usuarioId`/perfil enviados pelo navegador.
- **Leituras**: cada pessoa recebe só a sua **visão** (`visaoParaUsuario`, `src/lib/visao.ts`).
  Dados que ela não pode ver nem chegam ao navegador (ver [seção 18](#18-privacidade-e-dados-pessoais)).
- Conta **desativada** (`ativo = false`) é tratada como visitante em tudo. O último admin ativo não
  pode ser desativado. → [`desativarUsuario`](api/admin/desativarUsuario.md)

## 2. Conta e cadastro

Código: `src/services/auth.ts`, `src/server/auth.server.ts`, `src/lib/domain/validators.ts`.

- Obrigatórios: CPF válido, nome, nascimento, e-mail válido, WhatsApp com DDD, endereço,
  senha (mínimo **6** caracteres, com letra minúscula, maiúscula, número e símbolo, e confirmação)
  e aceite dos termos e do aviso de privacidade.
- Requisitos de senha em `src/lib/domain/senha.ts`, espelhando a configuração do Supabase Auth
  (Authentication → Email); se mudar lá, mude o módulo. O Supabase também recusa senhas vazadas
  (HaveIBeenPwned) e o erro chega traduzido. As telas mostram a checklist ao vivo e todo campo de
  senha tem o botão de olho (`InputSenha`).
- **Idade mínima: 15 anos.** De 15 a 17 anos a conta nasce com `autorizacaoResponsavel = pendente`
  e **não pode se inscrever** até o admin aprovar. → [`aprovarAutorizacaoResponsavel`](api/admin/aprovarAutorizacaoResponsavel.md)
- **CPF e e-mail são únicos.** Se o perfil não puder ser gravado, a conta criada no Auth é apagada.
- A conta é criada com e-mail já confirmado (ver [lacunas](#19-lacunas-conhecidas)).
- Recuperação de senha por link de e-mail de uso único; a resposta não revela se o e-mail existe.
- Login, cadastro e pedido de redefinição de senha mostram o Cloudflare Turnstile (`src/components/Turnstile.tsx`); o token é conferido pelo CAPTCHA do Supabase Auth, e cada token vale uma tentativa.
- Foto de perfil: JPEG, PNG ou WebP, recortada no navegador, até ~2,2 MB.
- Tema: visitante sempre escuro; a conta guarda claro ou escuro.
- Preferência de modalidades: `todas`, `selecionadas` (ids do catálogo) ou `pendente`; ordena a
  página inicial "Para você". Ids fora do catálogo são descartados.

## 3. Organizações

Código: `src/services/organizador.ts`, `src/services/admin.ts`.

- Qualquer conta pode pedir para virar organizador ([`solicitarOrganizador`](api/organizador/solicitarOrganizador.md)):
  nome da organização, telefone e, se tiver, CNPJ válido. **Uma solicitação em andamento por pessoa.**
- Estados da solicitação: `pendente` → `em_analise` → `aprovada` | `ajustes_solicitados` | `rejeitada`.
  Pedir ajustes ou rejeitar exige justificativa. Com ajustes, a pessoa corrige e reenvia (volta a `pendente`).
- **Aprovar cria a organização** (status `ativa`), promove a conta a organizador e libera `/organizacao`.
- Toda decisão é notificada e auditada.

## 4. Eventos

Código: `src/services/organizador.ts`, `src/lib/eventoEditor.ts`, `src/lib/contatoEvento.ts`.

**Status**: `rascunho` → `publicado` → (`cancelado`). Também existem `inscricoes_encerradas`,
`concluido` e `arquivado` no modelo, mas nenhuma tela muda para eles hoje (ver [lacunas](#19-lacunas-conhecidas)).

- Evento novo nasce em **rascunho** e só a gestão o vê. O status só muda por publicar ou cancelar;
  a organização dona e a data de criação nunca mudam numa edição.
- **Publicar** exige: nome, modalidade, descrição resumida (até 200), enredo, local, imagem
  principal, ao menos um exército, um tipo de ingresso e uma atividade no cronograma, todas dentro
  do período do evento. Publicar cria os fóruns da comunidade.
- **Capacidade**: a total e a de cada exército nunca ficam abaixo da ocupação atual
  (confirmadas + reservas de pagamento vigentes). Nomes de exército não se repetem.
- Troca de modalidade é auditada.
- **Excluir** só sem inscrições confirmadas ou aguardando pagamento (leva cupons e cortesias junto);
  com vendas, **cancele**. → [`excluirEvento`](api/organizador/excluirEvento.md), [`cancelarEvento`](api/organizador/cancelarEvento.md)
- **Contato no WhatsApp** (opcional):
  - número do organizador: normalizado com DDI (número brasileiro sem DDI ganha 55); **público**,
    vira o botão "Falar com o organizador" na página do evento. Evento novo vem preenchido com o
    telefone da organização.
  - link do grupo: só convites `https://chat.whatsapp.com/<código>`; **só inscritos confirmados e a
    gestão** recebem o link (a visão o remove dos demais, inclusive no HTML do SSR).
- O texto do manual de regras digitado pela organização só vira HTML depois de escapado (`src/lib/regras.ts`).

## 5. Ingressos, lotes e cupons

Código: `src/lib/vendas.ts`.

- Cada **tipo** de ingresso tem preço base e quantidade máxima. O preço de venda vem sempre de um
  **lote** vigente; sem lote vigente com vagas, o tipo está **indisponível** (o preço base nunca é usado como alternativa).
- Motivos de indisponibilidade: nenhum lote configurado, vendas não começaram, período terminou,
  lote inativo, lote esgotado, tipo esgotado.
- **Cupom**: código de 3 a 40 caracteres (letras, números, `-`, `_`), único por evento; desconto
  percentual inteiro de 1 a 100; validade com início e fim opcional; limite de usos opcional;
  vale só para os tipos escolhidos.
  - Situação: `inativo`, `esgotado` (usos ≥ limite), `agendado`, `expirado` ou `ativo`.
  - O uso é contado **na inscrição** (inclusive na reserva) e devolvido se a reserva for liberada.
  - Cupons nunca vão ao navegador; a prévia é feita no servidor. → [`previsualizarCupom`](api/inscricoes/previsualizarCupom.md)
- **Cortesia**: convite gratuito, de uso único, para um e-mail e um tipo de ingresso, com validade.
  Só aquele e-mail resgata; não passa por lote, não aceita cupom nem benefício. Expirada não resgata.

## 6. Inscrição

Código: `confirmarInscricao` em `src/services/inscricoes.ts`. → [API](api/inscricoes/confirmarInscricao.md)

Tudo é verificado **na mesma transação**, sobre dados atuais:

1. evento publicado;
2. menor de idade com autorização aprovada;
3. **uma inscrição confirmada por pessoa e evento** (reforçado por índice único no banco);
4. tipo ativo e exército válido;
5. capacidade do evento, do exército e do tipo (contando confirmadas + reservas vigentes);
6. lote vigente com vagas (ou cortesia válida);
7. cupom **ou** benefício de recompensa (nunca os dois; cortesia não aceita nenhum).

Resultado:
- **Sem valor a pagar** (gratuito, 100% de desconto, cortesia) **ou sem Stripe configurado**:
  inscrição **confirmada** na hora, com token do QR, movimentações e notificação.
- **Com valor a pagar e Stripe configurado**: **reserva** (`pendente`), ver [seção 7](#7-pagamento-online-stripe).
- **Idempotência**: com `clienteId`, reenviar a mesma tentativa devolve a mesma inscrição (e o mesmo
  checkout), sem gastar o cupom duas vezes.
- Uma nova tentativa da mesma pessoa **substitui** a reserva pendente anterior dela (que é
  liberada), salvo se aquele pagamento já estiver em processamento.

## 7. Pagamento online (Stripe)

Código: `src/lib/pagamentos.ts`, `src/lib/stripe.ts`, `src/server/pagamentos.server.ts`. → [Fluxo](fluxos.md#3-inscrição-com-pagamento-stripe)

- A reserva segura a **vaga, o uso do cupom e o benefício** por **32 minutos** (o prazo da Checkout
  Session). Ela é liberada por tempo só depois de uma folga de **10 minutos** (o Stripe pode avisar com atraso).
- Estados do pagamento: `aguardando` → `processando` (pagamento assíncrono, ex. boleto) → `pago`;
  ou `expirado` / `falhou` / `cancelado` (reserva liberada sem cobrança); depois de pago,
  `estorno_pendente` → `estornado`.
- **Confirmação**: pelo webhook do Stripe **e** pelo retorno do checkout, ambos idempotentes. Ao
  confirmar, a inscrição ganha o QR, a movimentação de entrada e a notificação.
- Pagamento que chega **depois** de a reserva ser liberada é confirmado se ainda couber; se não
  couber mais ou o evento saiu do ar, é **reembolsado** automaticamente.
- Só a sessão de checkout da própria reserva decide sobre ela (sessões antigas são ignoradas).
- Chamadas ao Stripe nunca acontecem dentro da transação do banco (que pode ser repetida).
- **Contestação (chargeback)**: quando o comprador contesta no banco do cartão, o Stripe avisa e a
  contestação fica registrada no pagamento (`aberta`, `em_analise`, `ganha`, `perdida` ou `encerrada`,
  com valor e motivo). O responsável pela organização é notificado na abertura; aparece em
  Financeiro e nas métricas. A inscrição não é cancelada automaticamente.
- **Sem `STRIPE_SERVER_API_KEY`** no servidor, tudo funciona como antes: confirmação direta, sem cobrança.

## 8. Cancelamento, estorno e reembolso

Código: `cancelarInscricao` (`src/services/inscricoes.ts`), `cancelarEvento` (`src/services/organizador.ts`).

- Quem cancela uma inscrição: o **titular**, a **gestão do evento** ou o **admin**, sempre com motivo.
- Inscrição confirmada → `estornada`: invalida o QR, libera a vaga, registra movimentação de
  estorno (valor negativo), notifica e audita. **Nada é apagado.**
- Paga online: vira `estorno_pendente`; depois de gravar, o servidor cria o **reembolso integral no
  Stripe** (chave de idempotência por inscrição). Falha fica registrada e é tentada de novo a cada webhook.
- Reserva pendente: é **liberada** (sem estorno, pois nada foi cobrado); cupom e benefício voltam e o
  checkout aberto é expirado. Com pagamento em processamento, não pode cancelar até o Stripe responder.
- **Cancelar o evento** estorna todas as confirmadas, libera as reservas, reembolsa no Stripe e
  devolve os benefícios. Exige justificativa.
- Benefício de recompensa usado volta ao participante se ainda estiver dentro do prazo de resgate;
  fora do prazo, fica registrada uma ocorrência para a organização avaliar.

## 9. Repasse às organizações e taxa

Código: `src/lib/repasses.ts`, `src/services/repasses.ts`.

- Cada organização pode ter uma conta **Stripe Connect** com painel Express, criada pela Accounts v2
  como conta recebedora das vendas (a plataforma responde por perdas e taxas, como nas contas Express).
  Situação: `pendente`, `em_analise`, `ativa` ou `restrita`, espelhada do Stripe e visível só para quem gere a organização.
  O site, o ramo (MCC 7922, "Ingressos para eventos") e a descrição do negócio são enviados pela plataforma (`perfilComercialPadrao`),
  então o organizador não precisa informar um site próprio nem escolher o setor no cadastro do Stripe
  (na Accounts v2: `configuration.merchant.mcc` e `defaults.profile`).
- Na reserva, se a conta tem **transferências ativas**, a cobrança nasce com destino a ela: o Stripe
  transfere o valor menos a **taxa da plataforma**. **Sem conta ativa, ingressos pagos
  não são vendidos**: a inscrição mostra ao comprador que a venda ainda não está aberta, e o painel e o
  editor de eventos avisam a organização que ela precisa concluir a conta de recebimento. Inscrições gratuitas e
  cortesias seguem normais.
- A **taxa** (%) é definida pelo admin e vale para reservas novas; cada venda guarda a taxa do momento.
- A **taxa de serviço do comprador** (%, padrão 0%) também é definida pelo admin: é somada ao valor do
  ingresso no checkout como o item "Taxa de serviço", aparece na revisão da inscrição e fica com a
  plataforma, sem mudar o que a organização recebe. Ex.: ingresso de R$ 100,00 com 3,5% do comprador e
  3,5% da organização: o comprador paga R$ 103,50, a organização recebe R$ 96,50 e a plataforma R$ 7,00.
- Reembolso de venda repassada desfaz a transferência e devolve a taxa.
- Ao trocar as chaves do Stripe de teste para produção, a conta de recebimento criada no modo de teste
  (ou numa sandbox, que é outra conta de plataforma) é esquecida na primeira consulta e a organização
  refaz o cadastro numa conta nova. O id descartado fica no log do servidor. Enquanto isso,
  um checkout cujo destino o Stripe não reconhece é recusado até o novo cadastro ficar ativo.
- Mensagens de erro do Stripe mostradas no site nunca trazem a chave de API, nem mascarada.
- Com a conta ativa, o Financeiro mostra **saldo** disponível e a liberar, próximo saque, últimos
  saques, cronograma e banco (só os últimos dígitos), lidos do Stripe com cache de 60 s.
  Com `STRIPE_BROWSER_PUBLIC_KEY`, tudo acontece dentro do site: o cadastro da conta (inclusive o
  inicial), os avisos de pendência e os dados da conta e banco (num painel lateral aberto pelo
  botão "Dados da conta") usam os componentes embutidos do Stripe. Contas Express ainda passam por uma confirmação de e-mail ou
  celular numa janela do Stripe, que só abre depois de um clique do organizador (o navegador
  bloqueia janelas abertas sozinhas); por isso os avisos de pendência aparecem junto dos dados da
  conta ou do cadastro, não ao carregar a página. Sem a chave, cadastro e painel abrem no site do Stripe.
  → [`saldoRecebimento`](api/repasses/saldoRecebimento.md), [`sessaoComponentesStripeOrg`](api/repasses/sessaoComponentesStripeOrg.md)

## 10. Financeiro do evento

Código: `resumoFinanceiro` (`src/services/inscricoes.ts`), `src/lib/movimentacoes.ts`.

- Os valores derivam **só** das inscrições confirmadas e das movimentações; nada é digitado.
  - bruto = soma dos valores das inscrições confirmadas;
  - líquido = bruto − descontos − estornos + ajustes;
  - reservas aguardando pagamento aparecem à parte e **não** entram nos valores.
- Movimentações: `inscricao` (entrada), `desconto_cupom` (registrada com valor 0; o valor real vem
  da inscrição), `estorno` (negativo) e `ajuste`.
- Pagamentos online mostram cobrado, taxa da plataforma, repassado à organização, o que ficou com a plataforma
  e, quando houver, a taxa de serviço paga pelos compradores.
- A tela de movimentações tem abas por tipo, busca (descrição ou código `OP-…`), período, meio de
  pagamento e ordenação; os totais das abas respeitam os filtros.

## 11. Check-in

Código: `src/lib/checkin.ts`, `src/services/checkin.ts`, `src/services/checkinStore.ts`. → [Fluxo](fluxos.md#6-check-in-offline)

- Operam o check-in: organização dona do evento e admin.
- O QR de entrada traz só um **token opaco** (sem CPF, nome ou e-mail), criado na confirmação e nunca trocado.
- Validação: ingresso de outro evento, inscrição não confirmada ou entrada já registrada são recusados.
- Funciona **offline**: o aparelho guarda a base mínima do evento e a fila de operações no IndexedDB,
  separadas, e sincroniza depois.
- Na sincronização, o servidor é **idempotente por id** e marca como **conflito** (com explicação)
  a segunda entrada, a inscrição cancelada antes da sincronização e o ingresso de outro evento.
  Registros de outro operador são recusados.
- Check-in manual exige motivo; desfazer uma entrada exige justificativa.

## 12. Participação, insígnias e recompensas

Código: `src/lib/participacao.ts`, `src/services/progressao.ts`, `src/services/gamificacao.ts`.

- Só dois estados visíveis: **participando** (inscrição confirmada, evento não concluído) e
  **participou** (evento **concluído** + presença válida: check-in ou correção do admin).
  Evento concluído sem presença válida não conta.
- O admin pode **validar** ou **invalidar** a participação de alguém (nunca a própria), com justificativa auditada.
- **Insígnias** (admin): critério por número de operações, de estados (UF), de modalidades ou de missões pré-evento concluídas,
  com meta de 1 a 1000. Concedidas automaticamente.
- **Campanhas de recompensa**: quem conquista a insígnia ganha um benefício (percentual, valor fixo
  ou gratuidade) em eventos da organização que concede. Limite total e por participante, prazos
  `início < conquistar até < resgatar até`. O admin só cria em nome de uma organização com a
  referência da oferta autorizada.
- A concessão (insígnias e vouchers) é **idempotente** (`recalcularProgressao`) e roda depois de
  inscrições, check-ins, correções e ao abrir o próprio perfil.
- **Operações fora da plataforma**: o operador pode registrar no perfil eventos de que participou
  fora do MilSim Ops, com nome, data (já passada), cidade/UF, organização e modalidade opcionais e
  **foto obrigatória**. Aparecem no mapa (listrado) e na lista como "Registrada pelo operador",
  seguem a privacidade do mapa e podem ser ocultadas uma a uma. **Nunca contam para insígnias,
  recompensas nem participação.** No resumo, "Estados na plataforma" fica separado de "N no total".
  → [`salvarOperacaoExterna`](api/perfil/salvarOperacaoExterna.md)

### Missões pré-evento

Código: `src/lib/missoes.ts` (regras puras), `src/services/missoes.ts`. → [APIs](api/README.md#missoes) · [Fluxo](fluxos.md#10-missões-pré-evento)

- A gestão do evento cria missões (rascunho), publica e avalia. Cada missão tem briefing e imagem,
  público (todos ou um exército), tipo de entrega (confirmação, texto/link, **foto** ou **código
  secreto**), pontos (0–10000), abertura opcional, prazo (até o fim do evento) e se exige aprovação.
- **Publicar** avisa uma única vez: post importante em "Avisos oficiais" (missão para todos) ou no
  fórum do exército; missão de um exército nunca é anunciada para o outro.
- **Envio**: só inscrito confirmado do exército de destino, dentro da janela, com a campanha aberta.
  Uma entrega por pessoa por missão; reenvio só com "ajustes solicitados". Código secreto é
  normalizado (sem acentos/maiúsculas), aprova na hora e nunca chega ao navegador do participante.
  O exército da pessoa no envio fica gravado: **os pontos ficam com esse exército**, mesmo se ela trocar.
- **Avaliação**: aprovar (dá os pontos), pedir ajustes ou recusar (com comentário obrigatório).
- **Destaque**: entrega aprovada vai para "Avisos oficiais" **só com autorização do participante**.
- **Placar**: média de pontos por inscrito confirmado do exército (o tamanho do exército não decide)
  + bônus das **metas coletivas** (X% dos inscritos do exército concluíram a missão). Desempate:
  pontos, depois nome. Calculado no servidor; o navegador não recebe as entregas dos outros.
- **Prêmios** por colocação são declarados antes. **Encerrar** exige avaliar as entregas pendentes,
  congela o placar (empate divide a colocação e o prêmio), publica o resultado na comunidade e trava
  tudo. No dia, o **check-in mostra o prêmio** do exército de quem chega.
- **Ranking individual** (top 10 do evento) e **temporada** (soma dos eventos da organização no ano).
- Insígnias podem usar o critério **"missões pré-evento concluídas"**.

## 13. Comunidade

Código: `src/services/comunidade.ts`. → [APIs](api/README.md#comunidade)

- Papéis: **gestão** (organização do evento ou admin) e **membro** (inscrição confirmada).
- Fóruns iniciais, criados ao publicar o evento: Avisos oficiais (só a gestão publica), Conversa
  geral, Dúvidas e preparação, Caronas e logística, Fotos e experiências.
- Cada fórum tem público (`todos` ou um exército) e permissões separadas de publicar e responder
  (`membros` ou `gestao`). Fórum de exército nunca aparece para outro exército; o público não muda
  depois que o fórum tem publicações; publicações só se movem entre fóruns com o mesmo público.
- Limites: texto até **2000** caracteres, até **4** imagens por publicação, 1 por resposta.
- Autor edita e exclui o próprio conteúdo. Publicação com respostas excluída pelo autor fica
  "removida pelo autor" (texto apagado) para a conversa continuar legível.
- Moderação (gestão): fixar, fechar respostas, ocultar com justificativa (nada é apagado), mover,
  arquivar/excluir fórum (só vazio), suspender participante no evento (lê, mas não interage).
  Tudo registrado na moderação.
- Denúncias vão para a gestão do evento, que decide (procedente/descartada).
- Publicação **importante** (só gestão) notifica todos com acesso; comum notifica quem segue o fórum.
- Na comunidade aparece só o **nome de exibição** (até 40 caracteres; padrão: primeiro e último nome).

## 14. Central de Suporte

Código: `src/lib/suporte.ts`, `src/services/suporte.ts`. → [Fluxo](fluxos.md#7-suporte-com-encaminhamento)

- Chamado sobre um **evento** ou sobre a **plataforma**; categorias Inscrição, Pagamento, Logística,
  Regras, Conta, Funcionamento e Outro. Mensagens até 4000 caracteres; anexo JPEG, PNG, WebP ou PDF até 5 MB.
- **Triagem é só da administração.** A organização do evento só participa quando o admin
  **encaminha** o chamado, e vê apenas o encaminhamento (orientação e anexos compartilhados), nunca
  a conversa com o participante.
- Cada mensagem guarda o seu público (`participante` ou `interno`). O canal interno nunca chega ao participante.
- Status: `aberto` → `em_atendimento` → `aguardando_participante` → `resolvido` → `fechado`.
  Também é exibido "Aguardando organizador" enquanto um encaminhamento espera retorno.
  - aguardar e resolver: só quem atende (admin); resolver exige descrever a solução;
  - reabrir: só de `resolvido` (solicitante ou admin);
  - fechar: solicitante ou admin; **fechado é somente leitura**.
  - Participante em `resolvido` precisa reabrir para escrever.
- Responsável, solução e vínculos são derivados de mensagens "sistema" **imutáveis** (o histórico nunca é reescrito).
- Envios com `clienteId` não duplicam. Anexos ficam no bucket privado, abertos por link assinado
  depois de conferir o acesso. O "lido até" de cada pessoa fica no servidor (vale em todos os aparelhos).

## 15. Página inicial, divulgação e impulsionamento

Código: `src/lib/divulgacao.ts`, `src/lib/impulsionamento.ts`.

- Só eventos **publicados e não encerrados** aparecem na página inicial.
- Seções (admin): destaques, regional, patrocinadores, apoiadores e banner; cada uma com
  abrangência (nacional, região, estado ou cidade), agendamento e curadoria manual ou seleção
  automática. A elegibilidade é recalculada a cada carregamento (não há agendador).
- Links de parceiros: só http/https; Instagram normalizado para `https://www.instagram.com/<perfil>/`;
  WhatsApp com DDI. Imagens precisam de texto alternativo.
- **Impulsionamento** (admin): o evento ganha prioridade em seções escolhidas, num período e numa região.
  - Estado exibido: rascunho, agendado, ativo, pausado, pausado por esgotar (objetivo inscrições),
    suspenso (evento fora do ar) ou encerrado.
  - Campanhas entram antes da curadoria, ordenadas por prioridade e ordem; cada evento aparece **uma vez** por seção.
  - Campanhas nunca são apagadas; encerrada não é editada.
- **Impulsos comprados** (organização): `src/lib/impulsos.ts`, página `/organizacao/impulsos`.
  - Seis tipos: 24h, 3, 5, 7, 15 e 30 dias. Preço, validade (padrão 30 dias) e venda de cada tipo
    são definidos pela administração; a compra guarda os valores do momento.
  - Só o organizador ativo compra, para a própria organização; o pagamento (Stripe Checkout) fica todo
    com a plataforma. Preço 0 libera na hora. Checkout não pago em 60 minutos é descartado.
  - Pago, o impulso fica no saldo da organização e precisa ser usado até `pagamento + validade`;
    depois disso aparece como **expirado** e não pode mais ser usado.
  - Usar = escolher uma operação publicada, não encerrada e com imagem: vira uma campanha ativa nas
    seções de destaque e no topo da listagem, em todo o Brasil, com prioridade normal. Um segundo impulso
    na mesma operação começa quando o anterior termina; o impulso termina no máximo no fim da operação.
  - Reembolso integral no Stripe cancela o impulso e encerra a campanha. A organização vê as próprias
    compras sem os ids do Stripe; o público não vê compras nem qual campanha veio de um impulso.

## 16. Métricas

Código: `src/services/analytics.ts`, `src/server/analytics.server.ts`, `src/lib/analytics.ts`.

- Coleta **anônima**: só ids aleatórios (visitante, sessão, fluxo). Nunca nome, e-mail, CPF, telefone,
  endereço, exército, pagamento ou texto digitado.
- Admin e a própria organização **não** entram na coleta dos seus eventos (o servidor reaplica a exclusão).
- O servidor descarta eventos inexistentes, campanhas de outro evento e horários fora das últimas 24 h.
- Fórmulas: CTR = cliques ÷ exibições; conversão = visitantes com inscrição confirmada ÷ visitantes
  únicos; conclusão = fluxos concluídos ÷ fluxos iniciados.
- Campanhas de rastreio (`?cmp=<id>`) por evento, criadas pela gestão.

### Visão geral do evento (admin)

Código: `src/lib/visaoGeralEvento.ts`, página `/admin/eventos/$eventoId` (botão "Ver" do dashboard).

- Só leitura, a partir da visão do admin (sem API própria).
- Vendidos = inscrições **confirmadas** (sobre a capacidade); aguardando pagamento = reservas vigentes
  (`reservaVigente`); cancelados e estornados contados à parte; por tipo de ingresso e por exército.
- Check-in = confirmadas com entrada vigente (`entradaAtiva`: sem reversão nem conflito).
- Pagamentos online: pagos, reembolsados, reembolsos pendentes e contestações em aberto (`disputaEmAberto`).
- Suporte: chamados com `eventoId` do evento, por status exibido; "em aberto" = não resolvido nem fechado.
- Valores em dinheiro vêm do Financeiro do evento ([seção 10](#10-financeiro-do-evento)), sem fórmula própria.

## 17. Notificações

- Notificações são internas (sino). Não há e-mail transacional nem WhatsApp automático.
- A pessoa pode silenciar todas ou só as da comunidade, e seguir ou silenciar fóruns.
- Participante e organizador marcam como lidas só as próprias; o admin pode marcar qualquer uma.

## 18. Privacidade e dados pessoais

- O navegador recebe só a visão da pessoa:
  - inscrições de terceiros chegam **anônimas** (sem titular, código ou token), só para contar vagas;
  - usuários: a própria conta; dos autores da comunidade, só o perfil público (sem CPF, e-mail,
    telefone ou endereço); a gestão vê os dados dos inscritos dos próprios eventos;
  - cupons, movimentações e check-ins: só a gestão do evento;
  - link do grupo do WhatsApp: só inscritos confirmados e a gestão.
- **Notas fiscais** de equipamentos: bucket privado, **só o dono** acessa (nem organizador, nem admin),
  por link assinado de 60 s. Nunca entram na visão nem no perfil.
- Perfil do operador: cada bloco é `eu` ou `autenticados`; visitante deslogado vê só nome e foto.
- Solicitações LGPD (acesso, correção, exportação, exclusão) vão para os admins, que respondem pela plataforma.
- Listagens da gestão mostram CPF e telefone mascarados.

## 19. Lacunas conhecidas

| Ponto | Situação | Impacto |
|---|---|---|
| Fim do evento | Nenhuma tela ou API muda o evento para `concluido` (nem `inscricoes_encerradas`/`arquivado`). | "Participou", insígnias e recompensas dependem de `concluido`: hoje eventos reais nunca contam. |
| Exclusão de contas | Não há exclusão definitiva nem em massa; só desativação. | Pedido em andamento: exclusão em massa com backup restaurável por 6 meses. |
| Confirmação de e-mail | Conta nasce com e-mail confirmado. | Em produção, exigir confirmação. |
| Mensagens externas | Sem e-mail transacional nem WhatsApp automático. | Avisos só pelo sino. |
| Storage | Arquivos substituídos ou de dados removidos não são apagados. | Ocupa espaço; sem dado sensível exposto (bucket privado protegido). |
| APIs legadas | `abrirChamado`/`responderChamado` (`conta`) não são usadas pelas telas. | Candidatas a remoção. |
