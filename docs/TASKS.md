# TASKS — AssistHub
# Backlog completo em ordem de prioridade
# Atualizado: Abril 2026

---

## 🔴 PRIORIDADE 1 — BUGS CRÍTICOS

- [ ] BUG-001: Redirecionamento pós-login abre /cadastro
      Esperado: redirecionar para /:slug/admin
      Arquivo: LoginPage.jsx + AuthContext.jsx

- [ ] BUG-002: Campo telefone do técnico travado no form
      Esperado: sempre editável pelo técnico
      Arquivo: FormPage.jsx — remover tel_segurado do LOCKED

- [ ] BUG-003: Campo Número deslocando layout do formulário
      Esperado: Endereço (3fr) + Número (1fr) na mesma linha
      Arquivo: FormPage.jsx

- [ ] BUG-004: Campos de senha sem olhinho
      Esperado: toggle mostrar/ocultar em Login e Cadastro
      Arquivo: LoginPage.jsx + CadastroPage.jsx

- [ ] BUG-005: Regras Firestore incompletas
      Faltando: orcamentos, tecnicos (permissões)
      Arquivo: Firebase Console → Firestore → Regras

---

## 🟠 PRIORIDADE 2 — PRODUTO CORE

- [x] FEAT-001: lucroReal salvo no Firestore
      Fórmula: MO - Técnico - KM
      Arquivo: AdminPage.jsx

- [x] FEAT-002: Paginação nas OS (25 por página)
      Cursor-based pagination do Firestore
      Arquivo: AdminPage.jsx

- [x] FEAT-003: Página 404 personalizada
      Rota catch-all no App.jsx
      Arquivo: NotFoundPage.jsx (novo)

- [x] FEAT-004: Compressão de imagens
      Máx 400KB antes do upload
      Biblioteca: browser-image-compression
      Arquivo: FormPage.jsx

- [x] FEAT-005: Exportar OS em Excel
      Modal com seleção de período e colunas
      Biblioteca: xlsx
      Arquivo: AdminPage.jsx

- [x] FEAT-006: Filtros de período no dashboard
      Hoje / Esta semana / Este mês / Este ano
      Arquivo: AdminPage.jsx

- [ ] FEAT-007: Compressão de imagens no orçamento
      Mesmo padrão do FormPage
      Arquivo: OrcamentoTecnicoPage.jsx

- [ ] FEAT-008: Relatório mensal em PDF
      Resumo: total OS, lucro, técnicos, seguradoras
      Arquivo: utils/relatorioMensalPdf.js (novo)

---

## 🟡 PRIORIDADE 3 — MONETIZAÇÃO

- [ ] PAY-001: Integração Stripe ou Pagar.me
      Fluxo: cadastro → trial → cobrança automática
      Webhook de pagamento confirmado

- [ ] PAY-002: Bloqueio automático ao vencer assinatura
      Middleware de verificação de plano
      Mensagem amigável com botão de renovação

- [ ] PAY-003: Upgrade/downgrade de plano self-service
      Tela em Configurações → Minha Conta
      Integrado ao Stripe

- [ ] PAY-004: Email de boas-vindas após cadastro
      Serviço: Resend ou EmailJS
      Template: logo + 3 passos para começar

- [ ] PAY-005: Onboarding guiado (checklist)
      Primeira vez no admin: checklist de setup
      Itens: perfil, técnico, primeira OS

- [ ] LEGAL-001: Termos de uso
      Página: /termos
      Aceite obrigatório no cadastro

- [ ] LEGAL-002: Política de privacidade (LGPD)
      Página: /privacidade
      Consentimento no cadastro

- [ ] LEGAL-003: Direito ao esquecimento
      Deletar conta + dados do Firestore
      Tela em Configurações → Minha Conta

---

## 🟢 PRIORIDADE 4 — DIFERENCIAL COMPETITIVO

- [ ] DIFF-001: Extensão Chrome para capturar OS
      Portais: Tempo, Maxpar, Allianz
      Lê a tela → preenche OS automaticamente

- [ ] DIFF-002: OCR para Mapfre (app mobile)
      Técnico tira print → sobe no AssistHub
      Claude Vision ou Google Vision API

- [ ] DIFF-003: WhatsApp automático (Evolution API)
      OS criada → técnico recebe link automaticamente
      OS concluída → segurado recebe avaliação
      Custo: ~R$30/mês servidor

- [ ] DIFF-004: Portal do técnico (área logada)
      Login próprio para o técnico
      Vê apenas suas OS
      Recebe notificação de nova OS

- [ ] DIFF-005: Ranking de técnicos
      OS por técnico no mês
      Média de avaliação
      Exibir no dashboard

- [ ] DIFF-006: Agendamento com calendário
      Vista mensal/semanal de OS
      Cores por técnico/seguradora

---

## 🔵 PRIORIDADE 5 — ESCALA

- [ ] SCALE-001: Firestore Aggregation API
      Substituir reduce() no dashboard
      1 leitura ao invés de N

- [ ] SCALE-002: Documento de métricas pré-calculadas
      Cloud Function atualiza ao criar/fechar OS
      empresas/{id}/metricas/dashboard

- [ ] SCALE-003: PWA (Progressive Web App)
      Instalar como app no celular
      Service Worker + notificações push

- [ ] SCALE-004: Modo escuro
      Toggle na sidebar
      CSS variables já preparadas
      localStorage para persistir

- [ ] SCALE-005: Monitoramento Sentry
      Error tracking em produção
      Alertas por email

- [ ] SCALE-006: 2FA — Autenticação em dois fatores
      Firebase Auth MFA
      Opcional para plano Enterprise

- [ ] SCALE-007: Log de auditoria
      Quem fez o quê e quando
      Histórico de alterações na OS

---

## 🎓 PRIORIDADE 6 — TCC

- [ ] TCC-001: FastAPI + Pandas (Railway/Render)
      Microsserviço Python para análise de dados
      Endpoint: GET /metricas/{empresaId}

- [ ] TCC-002: Análises avançadas
      Lucro por mês/trimestre/ano
      Sazonalidade dos atendimentos
      Ranking de seguradoras mais lucrativas
      Top cidades

- [ ] TCC-003: Gráficos com Plotly
      Dashboard analítico separado
      Exportar gráficos em PNG

- [ ] TCC-004: Comparativo de performance
      Antes: reduce() no frontend = 4s
      Depois: Python pré-calculado = 50ms
      Documentar como problema + solução no TCC

---

## ✅ CONCLUÍDO

- [x] Setup inicial React + Vite + Firebase
- [x] Multi-tenant com Firebase Auth
- [x] Formulário público para técnico
- [x] Link pré-preenchido via URL
- [x] Assinatura digital (prestador + segurado)
- [x] Upload de fotos (Firebase Storage)
- [x] Geração de PDF (jsPDF)
- [x] Geração de PNG para WhatsApp (html2canvas)
- [x] Dashboard financeiro (lucro por OS)
- [x] Gestão de técnicos
- [x] Avaliação de satisfação do segurado
- [x] Histórico por segurado
- [x] SuperAdmin com painel geral
- [x] Sidebar + dashboard com gráficos (Recharts)
- [x] Cards visuais de OS
- [x] Configurações da empresa + upload de logo
- [x] Módulo de orçamentos completo
- [x] Offline first (localStorage)
- [x] Deploy automático GitHub → Vercel
- [x] Domínio: mp-servi-os.vercel.app