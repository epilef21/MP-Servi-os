 PRD — Product Requirements Document
# AssistHub — Plataforma de Gestão de Atendimentos Técnicos
# Versão: 2.0 | Atualizado: Abril 2026

---

## 1. VISÃO GERAL DO PRODUTO

### 1.1 O que é o AssistHub
O AssistHub é um SaaS B2B multi-tenant para gestão
de ordens de serviço de prestadores de assistência
técnica residencial que atendem seguradoras
(Mapfre, Tempo, Maxpar, Allianz e outras).

### 1.2 Problema que resolve
Prestadores de assistência técnica perdem em média
43 minutos por OS com processos manuais:
- Anotação em papel ou WhatsApp
- Repasse manual ao técnico com risco de erro
- Relatório em papel / foto ilegível
- Redigitação para enviar à seguradora
- Sem controle de lucro real por atendimento

### 1.3 Solução
Fluxo 100% digital do acionamento ao relatório:
1. Admin cria OS → link pré-preenchido gerado
2. Técnico recebe no WhatsApp → abre no celular
3. Preenche, fotografa e assina digitalmente
4. PDF + PNG gerados automaticamente
5. Seguradora recebe relatório profissional

### 1.4 Diferenciais únicos
- Link pré-preenchido para técnico (nenhum concorrente tem)
- Dashboard de lucro real por OS
- Focado 100% no fluxo de seguradoras
- PNG para WhatsApp em 1 clique
- Módulo de orçamento integrado (linha branca/marrom + emergencial)

---

## 2. USUÁRIOS

### 2.1 Admin (cliente pagante)
Dono ou gestor da empresa prestadora de serviços.
- Cria e gerencia OS
- Define técnicos responsáveis
- Controla financeiro (lucro por OS)
- Gera PDF e PNG para seguradoras
- Gerencia orçamentos

### 2.2 Técnico (usuário do formulário)
Prestador de serviço que executa o atendimento.
- Acessa via link (sem conta)
- Preenche checklist no celular
- Faz upload de fotos
- Assina digitalmente
- Preenche orçamento no local

### 2.3 Segurado (cliente final)
Cliente da seguradora que recebeu o atendimento.
- Recebe confirmação via WhatsApp
- Avalia o atendimento (1-5 estrelas)
- Aprova orçamentos digitalmente

### 2.4 SuperAdmin (Felipe — dono do produto)
- Acessa todas as empresas
- Ativa/desativa contas
- Gerencia planos
- Monitora uso da plataforma

---

## 3. FUNCIONALIDADES

### RF01 — Gestão de OS ✅
- Criar OS manual pelo admin
- Formulário público para o técnico (link)
- Campos pré-preenchidos via URL
- Checklist de 10 itens com quantidade
- Upload de múltiplas fotos (comprimidas)
- Assinatura digital prestador + segurado
- Status: aguardando_tecnico/pendente/processado/enviado
- Anotações internas (só admin vê)
- Histórico por segurado

### RF02 — Documentos ✅
- PDF profissional com logo da empresa
- PNG para WhatsApp
- Assinaturas embutidas nos documentos
- Dados financeiros apenas no PDF admin

### RF03 — Dashboard Financeiro ✅
- Lucro real: Mão de Obra - Técnico - KM
- lucroReal salvo no Firestore
- Dashboard com filtros de período
- Gráficos: barras (6 meses) + pizza (status)
- Exportar OS em Excel/CSV

### RF04 — Comunicação WhatsApp ✅
- Link pré-preenchido para técnico
- Mensagem formatada com dados da OS
- Notificação ao segurado após conclusão
- Reenvio de link pelo painel

### RF05 — Multi-tenant ✅
- Cada empresa tem dados isolados
- Slug único na URL (/:slug/admin)
- Firebase Auth por empresa
- SuperAdmin com acesso total
- Planos: Básico(50 OS)/Pro(ilimitado)/Enterprise

### RF06 — Gestão de Técnicos ✅
- Cadastro de técnicos por empresa
- Select de técnico ao criar OS
- Cards visuais com especialidade

### RF07 — Avaliação de Satisfação ✅
- Página pública /avaliacao/:id
- Estrelas 1-5 + comentário
- Nota exibida no painel admin
- Bloqueio de avaliação duplicada

### RF08 — Orçamentos ✅
- Tipos: linha branca/marrom, emergencial, particular
- Cenários: seguradora cobre tudo / material cliente / fora contrato
- Numeração automática: ORC-2026-0001
- Admin cria → técnico preenche no local
- Admin revisa e ajusta valores
- Divisão seguradora/cliente por item
- PDF versão cliente + PDF versão seguradora
- Link para cliente aprovar digitalmente
- Converter orçamento aprovado em OS

### RF09 — Configurações ✅
- Upload de logo da empresa
- Dados da empresa (CNPJ, telefone, etc)
- Seguradoras atendidas
- Perfil do usuário admin

---

## 4. REQUISITOS NÃO FUNCIONAIS

### Performance
- Carregamento inicial < 3s
- Paginação de 25 OS por página
- lucroReal pré-calculado no Firestore
- Compressão de imagens: máx 400KB

### Segurança
- Firebase Auth (email + senha)
- Regras Firestore por empresaId
- Variáveis de ambiente (.env)
- HTTPS em produção (Vercel)

### Disponibilidade
- Deploy automático GitHub → Vercel
- Firebase 99.9% uptime
- Offline first no formulário (localStorage)

### Escalabilidade
- Multi-tenant shared database
- Firebase escala automaticamente
- Planos com limites configuráveis

---

## 5. ARQUITETURA

### Stack
- Frontend: React 19 + Vite 8
- Backend: Firebase (BaaS)
- Banco: Firestore (NoSQL)
- Auth: Firebase Auth
- Storage: Firebase Storage
- Hospedagem: Vercel
- PDF: jsPDF
- PNG: html2canvas
- Gráficos: Recharts
- Estilo: CSS puro com variáveis

### Estrutura Firestore
firestore/
empresas/{empresaId}/
checklist/{osId}
tecnicos/{tecnicoId}
orcamentos/{orcamentoId}
config/geral
config/superadmin
usuarios/{uid}

### Rotas
/                         → landing.html
/login                    → LoginPage
/cadastro                 → CadastroPage
/:slug                    → FormPage (público)
/:slug/admin              → AdminPage (protegido)
/avaliacao/:id            → AvaliacaoPage (público)
/orcamento/:slug/:id      → OrcamentoTecnicoPage (público)
/aprovar/:slug/:id        → AprovarOrcamentoPage (público)
/superadmin               → SuperAdminPage (protegido)
/*                        → NotFoundPage

---

## 6. MODELO DE NEGÓCIO

### Planos
| Plano      | Preço      | Limite OS |
|------------|------------|-----------|
| Básico     | R$97/mês   | 50/mês    |
| Pro        | R$197/mês  | Ilimitado |
| Enterprise | R$397/mês  | Ilimitado |

### Trial
- 15 dias grátis
- Sem cartão de crédito

### Faturamento (pendente)
- Stripe ou Pagar.me
- Cobrança automática mensal
- Bloqueio ao vencer

---

## 7. MÉTRICAS DE SUCESSO

- CAC (Custo de Aquisição de Cliente) < R$100
- LTV (Lifetime Value) > R$1.200 (12 meses)
- Churn < 5% ao mês
- NPS > 50
- Tempo médio de setup < 10 minutos