# Roadmap

## Editor de eventos — validação
- [x] Testar celular e tema TAN, recortes, publicação e leitura pública; corrigir problemas encontrados.
- [x] Validar recorte imediato de banner/card e restauração ao voltar à etapa com testes de regressão.
- [ ] Persistir recorte independente do banner e CEP após reabrir do servidor — bloqueado: coluna imagem ausente (API 42703); sem conexão SQL nem acesso de migração ao banco externo atual. Aplicar supabase/migrations/20261013220000_evento_imagem_cep.sql no editor SQL do projeto existente e confirmar leitura após salvar.
- [x] Ajustar badges, proporções da tabela e filtros em Inscritos; verificar celular, larguras intermediárias e os dois temas (390, 820, 1024 e 1280 px; 154 testes passando).

- [x] Carrosséis compartilhados sem scrollbar, com setas, indicadores, deslize e validação de overflow

- [x] Base mockada, autenticação, temas, páginas públicas e áreas (participante/organizador/admin)
- [x] Testes das regras de negócio (104 passando, incluindo persistência e visão por perfil)
- [x] Skeletons de loading em páginas e componentes
- [x] Verificação visual no preview (home, login, área do participante, página do evento)
- [x] Correção de erro de armazenamento no SSR e de hidratação do cabeçalho

- [x] Comunidade com fóruns e feed social (publicações, respostas, curtidas, denúncias, moderação, gestão de fóruns)
- [x] Manual de regras editável pela organização (formulário do evento → página pública e comunidade)
- [x] Manual de regras em PDF: organizador anexa o arquivo no formulário do evento; participante lê dentro do app (página pública e comunidade)
- [x] Página inicial e divulgação: seções ordenáveis/agendáveis, destaques manuais e automáticos por região, parceiros com links, banners, prévia (admin)
- [x] Métricas por evento: exibições, cliques, visitas, funil, origens/campanhas (organizador) e visão consolidada (admin)
- [x] Inscritos: painel lateral de detalhes, troca de evento em bottom sheet no celular, cartão de operação compartilhado (Inscritos/Comunidade/Financeiro)
- [x] Check-in e credenciamento (QR Code, manual, offline com Service Worker + IndexedDB, sincronização com o servidor)
- [ ] "Adicionar participante" (módulo pendente)
- [x] Página inicial refeita: tema escuro para visitantes, aparência por conta, localização real + seletor de cidade
- [x] Modalidades dos eventos e preferências (sem configuração por seção automática ainda)
- [x] Monólito com Supabase: APIs (server functions), Postgres com RLS fechado, Supabase Auth (cookies), Storage para mídia, seed e restauração
- [ ] Escala: consultas por página/agregado no lugar da base inteira por requisição
- [ ] SMTP próprio e confirmação de e-mail no cadastro

## Perfil do Operador
- [x] Perfil, histórico, mapa, insígnias, privacidade, equipamentos, notas fiscais privadas, galeria, recompensas, admin e organização
- [ ] Conferir no navegador (computador/celular, dois temas) — bloqueado: chaves do banco precisam ser salvas nos segredos

## Impulsionamento de operações
- [x] Parte 1: cadastro, elegibilidade, estados, exibição automática nas seções e na listagem, botão na lista de eventos
- [ ] Executar SQL supabase/migrations/20261014140000_impulsionamentos.sql no banco (bloqueado: sem acesso SQL; banco fora do ar)
- [x] Parte 2: métricas por campanha, bloco "Divulgação da operação" do organizador, prévia com diagnóstico
- [ ] Conferir no navegador (bloqueado: tabela impulsionamentos ainda não criada no banco)
