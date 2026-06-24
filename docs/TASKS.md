# TASKS - AssistHub
# Backlog completo em ordem de prioridade
# Atualizado: 2026-05-24

---

## Estado Geral do Projeto

O AssistHub funciona de ponta a ponta: multi-tenant, cadastro/login, painel admin,
criacao de OS, formulario publico para tecnico, fotos, assinaturas remotas, PDF/PNG,
dashboard financeiro, tecnicos, segurados, avaliacoes, orcamentos, agenda operacional,
relatorio mensal, extensao Chrome e Cloud Function para criar OS via extensao.

Ultima verificacao (2026-05-24):
- Build: `npm run build` passou limpo
- Testes: 75 testes passando com Vitest (7 arquivos)
- AdminPage.jsx: 2182 linhas (era 3572 — reducao de 39% com extracao de abas)
- Lint: `npm run lint` falha — falta `eslint.config.js` para ESLint 9
- HMR: vite.config.js renomeado + polling ativo para funcionar no OneDrive

---

## P0 — Correcoes Criticas (Antes de Vender para Terceiros)

- [x] SEC-001: Proteger links publicos de OS com token
      Solucao: campo `publicToken` (UUID) gerado ao criar OS no AdminPage.
      Token incluido nas URLs de tecnico, relatorio e avaliacao.
      Paginas publicas (FormPage, RelatorioPage, AvaliacaoPage) validam o token
      ao carregar o documento e bloqueiam acesso se nao conferir.
      OS antigas sem publicToken continuam funcionando (compatibilidade).

- [x] SEC-002: Restringir update publico de orcamentos
      Analise: regras ja estavam corretas — update restrito por status e campos.
      Nao havia `allow update: if true`; descricao do TASKS estava desatualizada.

- [x] SEC-003: Endurecer regras do Storage
      Solucao: upload de fotos agora exige imagem (contentType image/*) e max 5 MB.
      Regras deployadas em producao.

- [x] BUG-001: Corrigir status final da OS pre-preenchida
      Problema: `status: 'pendente'` hardcoded no update, ignorando `resultado_visita`.
      Solucao: removido o override — `base.status` (que usa `statusFinal`) e respeitado.
      Tambem adicionado `cliente_ausente` ao calculo de `statusFinal`.
      Arquivo: FormPage.jsx

- [x] BUG-002: Validar colisao de slug no cadastro
      Solucao: CadastroPage consulta Firestore antes de criar a empresa.
      Se slug ja existe, exibe mensagem e bloqueia o cadastro.
      Arquivo: CadastroPage.jsx

- [x] BUG-003: Revisar encoding dos textos
      Investigacao: todos os arquivos .jsx, .js, .md e da extensao estao em UTF-8 correto.
      Nenhum arquivo de producao com caracteres quebrados encontrado.
      A descricao anterior continha o exemplo `OrÃ§amento` como ilustracao — nao era real.

- [x] BUG-004: Revisar 404/catch-all
      Solucao: criado NotFoundPage.jsx com mensagem clara e link para /login.
      App.jsx atualizado — rota `*` agora usa NotFoundPage em vez de redirecionar.
      Arquivo: App.jsx, NotFoundPage.jsx

---

## P1 — Produto Core Para Uso Diario

- [x] CORE-001: Importar OS por texto (OCR manual — multi-portal)
      Implementado modal "Importar OS por Texto" com parser por portal:
      - Mapfre: Google Lens / Live Text (labels em ingles, endereco sem label)
      - Maxpar: Ctrl+A (Ordem de Servico, Beneficiario, Item de Cobertura, endereco "Rua, NUM, BAIRRO, Cidade")
      - Portal Juvo / Tempo Assist: Ctrl+A (endereco formato 8 digitos, desc_problema de "Descricao")
      - Mondial: Ctrl+A (tabela com tab ou proxima linha; servico pega 2a linha ELETRODOMESTICO; remove prefixo "R RUA")
      Correcoes aplicadas pos-uso real: parsers Mapfre, Maxpar, Juvo e Mondial ajustados com dados reais.
      Arquivo: components/admin/ImportarMapfreModal.jsx

- [ ] CORE-002: Importar OS Mapfre por imagem (OCR automatico)
      Motivo: depois de validar o parser por texto, automatizar upload do print.
      Solucao: Cloud Function com OCR/visao para extrair campos do print.
      Opcoes: Google Vision, OpenAI Vision ou Gemini Vision.
      Arquivos: functions/index.js, AdminPage.jsx, storage.rules

- [ ] CORE-003: Compressao de imagens no formulario de OS
      Observacao: OrcamentoTecnicoPage ja usa `browser-image-compression`.
      Esperado: fotos da OS tambem comprimidas para max 400KB antes do upload.
      Arquivo: mp-react/src/pages/FormPage.jsx

- [x] CORE-004: Compressao de imagens no orcamento
      Implementado em OrcamentoTecnicoPage com `browser-image-compression`.

- [x] CORE-005: Relatorio mensal em PDF
      Implementado fluxo de relatorio mensal com download em PDF.

- [x] CORE-006: Melhorar agenda operacional
      Reescrita completa da agenda (2026-05-22):
      - 4 secoes visuais: A Fazer, Respondidas, Retorno, Finalizadas
      - Filtros por seguradora e cidade (dinamicos por dia)
      - Stats clicaveis para filtrar por secao
      - Cor automatica por tecnico (faixa lateral no card)
      - Badge "Atrasada" com animacao quando horario passou +15 min
      - Badge "Conflito" quando dois tecnicos tem OS no mesmo horario
      - Destaque para OS sem horario (borda tracejada + badge)
      - Botao Reagendar com modal (data + hora + opcao de avisar WhatsApp)
      - Botao "Ver OS" abre modal correto no AdminPage via navigate state
      Arquivos: AgendaPage.jsx, AgendaPage.css

- [x] CORE-009: Assinatura remota do cliente
      Admin preenche a OS (desc_servico, data/hora) e assina como responsavel tecnico.
      Link gerado e enviado ao cliente para assinar pelo celular (sem login).
      Novo status: aguardando_assinatura_cliente (entre concluido e processado).
      Novos botoes no painel: "Preencher e Enviar" e "Reenviar Link".
      Regras Firestore especificas e fechadas para permitir apenas o campo assinatura_cliente.
      Arquivos: PreencherOSModal.jsx, AssinarClientePage.jsx, App.jsx, firestore.rules

- [ ] CORE-007: Ranking de tecnicos no dashboard
      Metricas: OS concluidas, avaliacao media, lucro total, retorno/pendencia.
      Arquivo: components/admin/DashboardTab.jsx

- [ ] CORE-008: Melhorar historico do segurado
      Proximo passo: mostrar recorrencia por endereco/telefone, ultima OS, nota media e pendencias.
      Arquivo: components/admin/SeguradosTab.jsx

---

## P2 — Refatoracao e Qualidade Tecnica

- [ ] TECH-001: Criar `eslint.config.js`
      Problema: ESLint 9 nao encontra arquivo de configuracao.
      Esperado: `npm run lint` funcionando sem erros.
      Arquivo: mp-react/eslint.config.js

- [ ] TECH-008: Adicionar testes para Assinatura Remota (CORE-009)
      Cobrir: PreencherOSModal gera link, AssinarClientePage valida token e salva assinatura.
      Arquivos: src/__tests__/assinaturaRemota.test.jsx

- [ ] TECH-009: Adicionar testes para Agenda
      Cobrir: renderizacao das 4 secoes, filtros por seguradora/cidade, badge "Atrasada".
      Arquivo: src/__tests__/agenda.test.jsx

- [ ] TECH-010: Historico de status (timeline) visivel no modal da OS
      O changeStatus ja grava {de, para, quando, por} via arrayUnion no Firestore.
      Verificar se o modal de detalhe exibe essa linha do tempo corretamente para todos os status novos
      (concluido, aguardando_assinatura_cliente).
      Arquivo: AdminPage.jsx (modal DetalheOS)

- [x] TECH-002: Criar AdminContext
      Concluido: AdminContext.jsx criado com todos os dados e funcoes compartilhados.
      Arquivo: mp-react/src/contexts/AdminContext.jsx

- [x] TECH-003: Extrair abas do Admin
      Todos os 7 componentes de aba extraidos e funcionando:
      - DashboardTab.jsx (graficos Recharts, metricas, plano)
      - OrdensServicoTab.jsx (lista de OS com filtros)
      - OrcamentosTab.jsx (lista de orcamentos com filtros)
      - SeguradosTab.jsx (historico por segurado)
      - TecnicosTab.jsx (cadastro de tecnicos)
      - ConfigTab.jsx (configuracoes da empresa)
      - RelatorioTab.jsx (relatorio mensal)
      AdminPage.jsx passou de 3572 para 2293 linhas (-36%).

- [ ] TECH-004: Extrair modais do Admin
      Ainda dentro do AdminPage.jsx (2293 linhas). Extrair nesta ordem:
      Fase A — modais simples (menor risco):
      - [ ] LinkGeradoModal.jsx (linhas ~1192) — exibe link do tecnico, botoes copiar/WhatsApp
      - [ ] LinkRelatorioModal.jsx (linhas ~1227) — exibe link do relatorio para seguradora
      - [ ] ConverterOsModal.jsx (linhas ~2229) — confirma conversao de orcamento em OS
      Fase B — modais medios:
      - [ ] NovoOrcamentoModal.jsx (linhas ~?) — 3 etapas: tipo, dados, equipamento
      - [ ] LinksOrcamentoModal.jsx (linhas ~?) — links tecnico + cliente do orcamento
      Fase C — modais grandes (mais complexos):
      - [ ] NovaOsModal.jsx (linhas ~1039) — formulario completo de nova OS
      - [ ] RevisarOrcamentoModal.jsx (linhas ~2010) — admin ajusta itens e valores
      - [ ] DetalheOsModal.jsx (linhas ~1280) — view completa da OS com financeiro,
            tecnico, fotos, assinaturas, anotacao interna e avaliacao (~360 linhas)

- [ ] TECH-005: Reduzir duplicacao na extensao Chrome
      Problema: seletores/parsers existem em `scraper.js` e dentro de `popup.js`.
      Esperado: um parser unico por portal.
      Arquivos: assisthub-extension/content-scripts/scraper.js, popup/popup.js

- [ ] TECH-006: Criar testes para parsers de OS
      Incluir parsers: Mapfre OCR, Mondial, Juvo/Tempo, Maxpar, Allianz.
      Esperado: fixtures de texto/HTML e resultado normalizado.
      Arquivos: mp-react/src/utils ou assisthub-extension/utils

- [ ] TECH-007: Melhorar estrategia de metricas
      Problema: dashboard ainda depende de leitura/reduce de muitas OS.
      Solucao: Firestore Aggregation API ou documento `metricas/dashboard`.
      Arquivos: firebase.js, functions/index.js, DashboardTab.jsx

---

## P3 — Diferenciais Competitivos

- [x] DIFF-001: Extensao Chrome para capturar OS
      Portais funcionando: Maxpar (novo + legado), Juvo/Tempo, Allianz, Mondial.
      Pendente: Mapfre (app mobile — ver CORE-001 e CORE-002).

- [ ] DIFF-002: Melhorar confiabilidade da extensao Chrome
      Proximo passo: pre-visualizacao editavel, logs de erro, deteccao de portal
      e campos obrigatorios por seguradora.
      Arquivos: assisthub-extension/*

- [ ] DIFF-007: Notificacao de assinatura remota pendente
      Quando OS entra em aguardando_assinatura_cliente, exibir badge/alerta no painel
      para o admin lembrar de cobrar o cliente ou reenviar o link.
      Arquivo: AdminPage.jsx, OrdensServicoTab.jsx

- [ ] DIFF-008: Copiar link de assinatura com 1 clique no card da OS
      Hoje o link so aparece no modal PreencherOSModal.
      Proximo passo: botao rapido "Copiar link" no card da OS quando status = aguardando_assinatura_cliente.
      Arquivo: OrdensServicoTab.jsx

- [ ] DIFF-003: WhatsApp automatico
      Fluxo: OS criada → tecnico recebe link automaticamente.
      Fluxo: OS concluida → segurado recebe link de avaliacao automaticamente.
      Opcao: Evolution API, Z-API ou provedor similar.

- [ ] DIFF-004: Portal do tecnico
      Login proprio para tecnico.
      Ver apenas OS atribuidas a ele.
      Atualizar status, preencher checklist, subir fotos e assinar.

- [ ] DIFF-005: PWA mobile
      Instalar como app no celular.
      Melhorar experiencia do tecnico em campo.
      Base para notificacoes push e modo offline melhor.

- [ ] DIFF-006: Auditoria de alteracoes
      Registrar quem fez o que e quando.
      Eventos: criar OS, alterar status, alterar financeiro, trocar tecnico,
      aprovar/reprovar orcamento.

---

## P4 — Monetizacao, Venda e Operacao SaaS

- [ ] BIZ-001: Landing page comercial
      Foco: prestadores de assistencia residencial que atendem seguradoras.
      Conteudo: dor, video curto do fluxo, prints, beneficios, preco e botao WhatsApp.

- [ ] BIZ-002: Roteiro de demo de 10 minutos
      Fluxo: criar OS → enviar link → tecnico preenche → PDF/PNG → lucro no dashboard.
      Objetivo: vender sem depender de trafego pago.

- [ ] BIZ-003: Planilha de prospeccao
      Campos: empresa, cidade, nicho, telefone, atende seguradora?, contato, status, obs.
      Canais: Google Maps, Instagram, Facebook, grupos de assistencia, indicacoes.

- [ ] PAY-001: Trial de 15 dias
      Criar campos de trial no documento da empresa.
      Exibir aviso de dias restantes no admin.

- [ ] PAY-002: Bloqueio por assinatura vencida
      Bloquear criacao de OS apos trial/vencimento.
      Manter acesso para visualizar dados.

- [ ] PAY-003: Integracao Stripe ou Pagar.me
      Checkout, webhook de pagamento, renovacao mensal e troca de plano.

- [ ] PAY-004: Upgrade/downgrade self-service
      Tela em Configuracoes → Minha Conta.

- [ ] PAY-005: Email/WhatsApp de boas-vindas
      Enviar apos cadastro com 3 passos: configurar empresa, cadastrar tecnico, criar 1a OS.

---

## P5 — Legal, Privacidade e Confianca

- [ ] LEGAL-001: Termos de uso — pagina `/termos`, aceite obrigatorio no cadastro.
- [ ] LEGAL-002: Politica de privacidade LGPD — pagina `/privacidade`.
- [ ] LEGAL-003: Consentimento e retencao de dados — definir por quanto tempo
      fotos e assinaturas ficam armazenadas.
- [ ] LEGAL-004: Direito ao esquecimento — deletar conta + dados mediante solicitacao.
- [ ] LEGAL-005: Melhorar isolamento multi-tenant — revisar regras Firestore/Storage
      depois dos tokens publicos implementados.

---

## P6 — Escala e Observabilidade

- [ ] SCALE-001: Monitoramento de erros (Sentry) — alertas para erros em producao.
- [ ] SCALE-002: Logs estruturados nas Cloud Functions.
- [ ] SCALE-003: Backups/exportacao por empresa.
- [ ] SCALE-004: 2FA para contas admin — opcional plano Enterprise via Firebase MFA.
- [ ] SCALE-005: Performance do dashboard — contadores/metricas pre-calculadas.

---

## P7 — TCC / Analises Avancadas

- [ ] TCC-001: Microsservico Python com FastAPI + Pandas — endpoint `GET /metricas/{empresaId}`.
- [ ] TCC-002: Analises avancadas — lucro por periodo, sazonalidade, ranking de seguradoras.
- [ ] TCC-003: Graficos com Plotly — dashboard analitico separado.
- [ ] TCC-004: Comparativo de performance — antes/depois das metricas pre-calculadas.

---

## Concluido

### Infraestrutura e fundacao
- [x] Setup inicial React + Vite + Firebase
- [x] Multi-tenant com Firebase Auth
- [x] Cadastro de empresa e login
- [x] SuperAdmin com painel geral
- [x] Planos Basico, Pro e Enterprise definidos
- [x] Deploy automatico GitHub → Vercel
- [x] Dominio atual: mp-servi-os.vercel.app

### Fluxo de OS
- [x] Formulario publico para tecnico
- [x] Link pre-preenchido por OS
- [x] Assinatura digital do prestador
- [x] Assinatura digital do segurado
- [x] Upload de fotos no Firebase Storage
- [x] Geracao de PDF com jsPDF
- [x] Geracao de PNG para WhatsApp com html2canvas
- [x] Offline first simples com localStorage no formulario

### Dashboard e gestao
- [x] Dashboard financeiro com Recharts
- [x] Lucro real por OS (campo `lucroReal` salvo no Firestore)
- [x] Gestao de tecnicos
- [x] Avaliacao de satisfacao do segurado
- [x] Historico por segurado
- [x] Configuracoes da empresa e upload de logo
- [x] Seguradoras configuraveis por empresa
- [x] Agenda visual inicial
- [x] Relatorio mensal com PDF

### Modulo de orcamentos
- [x] Orcamento tecnico por link publico
- [x] Aprovacao/reprovacao de orcamento pelo cliente
- [x] PDF de orcamento para cliente
- [x] PDF de orcamento para seguradora
- [x] Conversao de orcamento aprovado em OS
- [x] Compressao de imagens no orcamento

### Extensao Chrome AssistHub
- [x] Popup + service worker + Cloud Function `criarOSFromExtension`
- [x] Autenticacao da extensao com token Firebase
- [x] Maxpar novo (`prestador.maxpar.com`) — 9/9 campos
- [x] Maxpar legado (`sistemas.maxpar.com.br`) — 7/9 campos
- [x] Portal Juvo / Tempo (`novo-portal-prestador.prd.tempoassist.cloud`) — 8/9 campos
- [x] Tempo Assist legado (`portal.tempoassist.com.br`) — 7/9 campos
- [x] Allianz (`portal.allianz.com.br`) — 7/9 campos
- [x] Mondial (`vianet.webmondial.com.br`) — 8/9 campos

### Refatoracao do AdminPage
- [x] AdminContext criado — dados e funcoes compartilhados entre componentes
- [x] DashboardTab.jsx extraido (graficos, metricas, plano)
- [x] OrdensServicoTab.jsx extraido (lista OS com filtros)
- [x] OrcamentosTab.jsx extraido (lista orcamentos com filtros)
- [x] SeguradosTab.jsx extraido (historico por segurado)
- [x] TecnicosTab.jsx extraido (cadastro de tecnicos)
- [x] ConfigTab.jsx extraido (configuracoes da empresa)
- [x] RelatorioTab.jsx extraido (relatorio mensal)
- [x] AdminPage.jsx: 3572 → 2182 linhas (-39%)

### Status de OS
- [x] Novo status: `concluido` — tecnico conclui visita via FormPage (era "pendente")
- [x] Novo status: `aguardando_assinatura_cliente` — admin aguarda assinatura remota
- [x] changeStatus grava historico {de, para, quando, por} via arrayUnion
- [x] Modal da OS exibe linha do tempo de mudancas de status
- [x] Filtro de status inclui todos os estados (OrdensServicoTab)

### Importar por texto (CORE-001)
- [x] Parser Mapfre (Google Lens / Live Text)
- [x] Parser Maxpar — formato real Ctrl+A corrigido
- [x] Parser Juvo/Tempo — desc_problema de campo "Descricao", ignora ":" no final
- [x] Parser Mondial — servico da 2a linha, remove prefixo "R RUA" duplicado

### Agenda operacional (CORE-006)
- [x] Reescrita completa com 4 secoes: A Fazer, Respondidas, Retorno, Finalizadas
- [x] Filtros por seguradora e cidade dinamicos
- [x] Badge "Atrasada" (horario passou +15min) e badge "Conflito" (mesmo horario)
- [x] Cor automatica por tecnico, botao Reagendar com modal

### Assinatura remota (CORE-009)
- [x] PreencherOSModal.jsx — admin preenche desc_servico, data/hora, assina como responsavel
- [x] AssinarClientePage.jsx — pagina publica /assinar/:slug/:osId
- [x] Regras Firestore fechadas para escrita apenas de assinatura_cliente

### Qualidade
- [x] Testes unitarios configurados com Vitest 4.1.5
- [x] 75 testes passando (7 arquivos: smoke, utils, firebase, authContext, rotasEmpresa, osFluxo, orcamentoFluxo)
- [x] HMR corrigido para funcionar no OneDrive (polling + vite.config.js renomeado)
