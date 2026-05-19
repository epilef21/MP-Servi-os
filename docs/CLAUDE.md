# CLAUDE.md — AssistHub
# Contexto completo do projeto para o Claude Code
# Leia este arquivo SEMPRE antes de qualquer alteração

---

## SOBRE O PROJETO

Nome: AssistHub
Tipo: SaaS B2B multi-tenant
Domínio: mp-servi-os.vercel.app
Stack: React 19 + Vite 8 + Firebase + Vercel
Custo infraestrutura: R$0/mês

O AssistHub é uma plataforma de gestão de ordens
de serviço para prestadores de assistência técnica
residencial que atendem seguradoras (Mapfre, Tempo,
Maxpar, Allianz). Substitui papel, WhatsApp e planilha
por um fluxo 100% digital.

---
---

## FLUXO REAL DO NEGÓCIO (CRÍTICO — LER ANTES DE IMPLEMENTAR)

### Como funciona na prática

1. Seguradora aciona via app/portal
2. Admin aceita e despacha técnico pelo WhatsApp
3. Técnico chega no local
4. Técnico coleta a SENHA do cliente
   → 4 últimos dígitos do celular OU token de 4 dígitos
   → Comprova presença física no local
5. Técnico faz diagnóstico e manda LAUDO
   → Sempre por WhatsApp ou ligação — NUNCA pelo sistema
   → Motivo: cliente não dá detalhes na OS
   → Técnico chega e descobre o problema real
6. Admin avalia o laudo e consulta a seguradora:
   → O cliente tem limite de material?
   → Quanto é o limite?
   → O serviço está coberto?
7. Admin libera execução (por WhatsApp para o técnico)
8. Técnico executa APENAS o que está na OS
   → Nunca serviços extras solicitados pelo cliente
   → Ex: OS é "troca de torneira" → não olha a válvula
9. Técnico preenche checklist e coleta assinaturas
10. Admin tarifa (MO + deslocamento) e envia à seguradora
    → Cada seguradora tem seu processo
    → Algumas: WhatsApp / Outras: portal próprio

### Regras críticas de negócio

SENHA:
- Sempre fornecida pelo cliente
- 4 últimos dígitos do celular OU token de 4 dígitos
- Obrigatória — comprova presença

LIMITES DE MATERIAL:
- Variam por seguradora E por contrato do cliente
- Mapfre: ~R$300 MO + material (mas depende do contrato)
- Allianz: ~R$100 MO + material (passou → ligar para aprovar)
- SEMPRE consultar — nunca assumir o limite
- Técnico colocar material sem aprovação = PREJUÍZO
  (não pode cobrar o cliente depois)

ESCOPO DO SERVIÇO:
- Executar APENAS o que está descrito na OS
- Cliente sempre pede serviços extras → RECUSAR
- Ex: OS "troca torneira" → cliente quer olhar válvula → NÃO

TÉCNICOS:
- Trabalham de forma autônoma
- Têm agenda própria de serviços particulares
- Disponibilidade sempre por consulta (WhatsApp)
- Dificuldade com tecnologia — sistema deve ser simples
- Nem toda cidade tem técnico de confiança disponível
- Cada técnico tem seu próprio preço (marido de aluguel)

SEGURADORAS ATENDIDAS:
- Tempo (portal web)
- Mapfre (app mobile)
- Maxpar (portal web)
- Allianz (portal web)
- Cada uma tem processo diferente de envio do checklist

### O que NÃO implementar por causa da realidade do negócio

- ❌ Trava esperando liberação do admin no formulário
  → Técnico não vai esperar, vai ligar
- ❌ Laudo pelo sistema
  → WhatsApp e ligação funcionam melhor
- ❌ Notificação push para técnico
  → Maioria não vai configurar
- ❌ Regras fixas de limite por seguradora
  → Cada contrato é diferente — sempre consultar
- ❌ Automação de despacho de técnico
  → Disponibilidade sempre por consulta manual

## ESTRUTURA DO PROJETO
mp-react/
├── public/
│   ├── logo.png              ← Logo AssistHub (engrenagem laranja)
│   └── landing.html          ← Landing page standalone (HTML puro)
├── src/
│   ├── App.jsx               ← Rotas principais
│   ├── main.jsx              ← Entry point
│   ├── firebase.js           ← Config Firebase + exports
│   ├── index.css             ← CSS global com variáveis
│   ├── contexts/
│   │   └── AuthContext.jsx   ← Contexto de autenticação Firebase
│   ├── hooks/
│   │   └── useEmpresa.js     ← Hook que busca empresa pelo slug
│   ├── pages/
│   │   ├── AdminPage.jsx     ← Painel admin (MAIOR arquivo)
│   │   ├── FormPage.jsx      ← Formulário público do técnico
│   │   ├── LoginPage.jsx     ← Login Firebase Auth
│   │   ├── CadastroPage.jsx  ← Cadastro de nova empresa
│   │   ├── SuperAdminPage.jsx← Painel geral (só Felipe)
│   │   ├── AvaliacaoPage.jsx ← Avaliação pública do segurado
│   │   ├── OrcamentoTecnicoPage.jsx ← Técnico preenche orçamento
│   │   ├── AprovarOrcamentoPage.jsx ← Cliente aprova orçamento
│   │   ├── EmpresaNaoEncontrada.jsx ← Empresa inativa/inválida
│   │   └── NotFoundPage.jsx  ← Página 404
│   └── utils/
│       ├── pdfGenerator.js           ← PDF das OS
│       ├── pngGenerator.js           ← PNG para WhatsApp
│       └── orcamentoPdfGenerator.js  ← PDF dos orçamentos
├── docs/
│   ├── PRD.md                ← Product Requirements Document
│   └── TASKS.md              ← Backlog completo
├── .env                      ← Variáveis Firebase (NÃO commitar)
├── .env.example              ← Template das variáveis
├── firebase.json             ← Config Firebase CLI
├── firestore.rules           ← Regras de segurança Firestore
├── storage.rules             ← Regras de segurança Storage
├── vercel.json               ← Config SPA rewrite
└── package.json

---

## VARIÁVEIS DE AMBIENTE (.env)
# Valores reais estão no .env local (não commitado).
# Use .env.example como referência.
VITE_FIREBASE_API_KEY=<ver .env local>
VITE_FIREBASE_AUTH_DOMAIN=checklist-53795.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=checklist-53795
VITE_FIREBASE_STORAGE_BUCKET=checklist-53795.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=<ver .env local>
VITE_FIREBASE_APP_ID=<ver .env local>
# VITE_ADMIN_PASSWORD foi removido em Mai/2026 — autenticação migrada para bcrypt + custom claims

---

## PALETA DE CORES

```css
--primary:      #1a3fa8   /* azul escuro */
--primary-h:    #2550c8   /* azul hover */
--primary-dark: #0d2470   /* azul mais escuro */
--accent:       #f05a1a   /* laranja */
--accent-h:     #ff6b2b   /* laranja hover */
--bg:           #f0f4fb   /* fundo */
--text:         #1a2340   /* texto */
--muted:        #6b7c93   /* texto secundário */
--border:       #d0dae8   /* bordas */
--success:      #2d8a4e   /* verde */
--danger:       #c0392b   /* vermelho */
```

---

## ESTRUTURA FIRESTORE
empresas/{empresaId}/
├── nome, slug, email, plano, ativo, telefone
├── logoUrl, cnpj, site, seguradoras[]
├── checklist/{osId}
│    ├── Todos os campos da OS
│    ├── lucroReal (calculado: MO - técnico - KM)
│    ├── nome_tecnico, tel_tecnico, tecnico_id
│    ├── avaliacao_nota, avaliacao_comentario
│    └── anotacao_interna (só admin vê)
├── tecnicos/{tecnicoId}
│    ├── nome, telefone, email, especialidade, ativo
├── orcamentos/{orcamentoId}
│    ├── numero (ORC-2026-0001), tipo, status
│    ├── nome_cliente, tel_cliente, endereco, cidade
│    ├── tipo_equipamento, marca, modelo, voltagem
│    ├── itens[] (descricao, qtd, valor, paga_seg, paga_cliente)
│    ├── total_geral, total_seguradora, total_cliente
│    └── assinatura_cliente, aprovado_por, aprovado_em
└── config/geral
config/superadmin → { email: "tvf23407@gmail.com" }
usuarios/{uid}    → { empresaId }

---

## ROTAS DO SISTEMA
PÚBLICAS (sem auth):
/landing.html              → Landing page
/:slug                     → FormPage (técnico)
/avaliacao/:id             → AvaliacaoPage (segurado)
/orcamento/:slug/:id       → OrcamentoTecnicoPage
/aprovar/:slug/:id         → AprovarOrcamentoPage
AUTH (não autenticados):
/login                     → LoginPage
/cadastro                  → CadastroPage
PROTEGIDAS (autenticado):
/:slug/admin               → AdminPage
/superadmin                → SuperAdminPage
ERRO:
/*                         → NotFoundPage

---

## ADMINPAGE — ABAS DA SIDEBAR
📊 Dashboard
→ 4 cards métricas
→ Gráfico barras 6 meses (Recharts)
→ Gráfico pizza status (Recharts)
→ Últimas 5 OS
→ Plano atual
→ Filtros: hoje/semana/mês/ano
📋 Ordens de Serviço
→ Cards visuais (grid 3 colunas)
→ Filtros: texto, status, data
→ Paginação 25 por página
→ Modal Nova OS
→ Modal Detalhe OS (completo)
→ Botão exportar Excel
📄 Orçamentos
→ Cards de orçamentos
→ Modal Novo Orçamento (3 etapas)
→ Modal Revisar (admin ajusta valores)
→ Modal Converter em OS
→ PDF versão cliente + seguradora
👥 Segurados
→ Cards com histórico
→ Modal histórico completo
👷 Técnicos
→ Cards com especialidade
→ Modal Novo/Editar técnico
⚙️ Configurações
→ Sub-aba: Minha Conta
→ Sub-aba: Minha Empresa

---

## FÓRMULA DO LUCRO

```javascript
// SEMPRE usar esta fórmula:
lucroReal = maoDeObraSeguradora - valorPagoTecnico - kmDeslocamento

// SEMPRE salvar no Firestore ao atualizar financeiro:
await updateDoc(osRef, { lucroReal })

// NÃO calcular com reduce() no frontend para dashboard
// Usar o campo lucroReal já salvo no documento
```

---

## FLUXO PRINCIPAL — OS

Admin recebe acionamento da seguradora
Admin cria OS no painel (+ Nova OS)
Link pré-preenchido gerado automaticamente
Admin seleciona técnico → WhatsApp Web abre
Técnico abre link no celular
Campos já preenchidos (travados)
Técnico preenche: serviço, fotos, assinatura
Admin vê OS com status "pendente"
Admin revisa → PDF/PNG → envia seguradora
Admin marca como "processado" ou "enviado"


## FLUXO PRINCIPAL — ORÇAMENTO

Admin cria orçamento (tipo + cliente + equipamento)
Admin seleciona técnico → link gerado
Técnico abre no celular no local
Técnico preenche: diagnóstico, marca, modelo,
voltagem, itens, valores, prazo, pagamento
Admin revisa e ajusta valores
Admin define divisão: seguradora / cliente
Admin envia link para cliente aprovar
Cliente visualiza, assina digitalmente
Admin converte em OS com 1 clique
OS criada com dados do orçamento


---

## REGRAS IMPORTANTES DE CÓDIGO

1. Nunca enviar campo `undefined` para o Firebase
   → Usar: `campo: valor || ''`

2. lucroReal sempre salvo no Firestore ao atualizar financeiro
   → Nunca calcular só no frontend

3. Imagens sempre comprimidas antes do upload
   → Máx 400KB usando browser-image-compression

4. Campos financeiros NUNCA aparecem no formulário
   do técnico nem no PDF que vai para o cliente

5. anotacao_interna NUNCA aparece em PDFs

6. Páginas públicas (/:slug, /avaliacao, /orcamento,
   /aprovar) NÃO precisam de autenticação

7. CSS: sempre usar variáveis CSS (--primary, --accent, etc)
   Nunca hardcodar cores

8. Mobile first em todas as páginas públicas

---

## CREDENCIAIS E ACESSOS
SuperAdmin:
Email: <guardado no 1Password/gestor de senhas — não colocar aqui>
Senha painel: <hash bcrypt em functions/.env — não colocar aqui>
Acesso: /superadmin
Empresa de teste:
Slug: mp-servicos
Admin: mp-servi-os.vercel.app/mp-servicos/admin
Firebase Console:
Projeto: checklist-53795
URL: console.firebase.google.com/project/checklist-53795
GitHub:
Repo: github.com/epilef21/MP-Servi-os
Branch principal: main
Vercel:
URL: mp-servi-os.vercel.app
Deploy: automático a cada push na main

---

## COMANDOS ÚTEIS

```bash
# Rodar localmente
cd mp-react && npm run dev

# Build de produção
npm run build

# Deploy (automático via push)
git add .
git commit -m "feat: descrição"
git push origin principal:main

# Publicar regras Firebase
firebase deploy --only firestore:rules,storage
```

---

## DEPENDÊNCIAS PRINCIPAIS

```json
{
  "firebase": "^12.12.0",
  "react": "^19.2.4",
  "react-router-dom": "^7.14.0",
  "react-signature-canvas": "^1.1.0-alpha.2",
  "recharts": "instalado",
  "jspdf": "^4.2.1",
  "html2canvas": "^1.4.1",
  "browser-image-compression": "instalado",
  "xlsx": "instalado"
}
```

---

## O QUE NÃO FAZER

- ❌ Não recriar a configuração do Firebase
- ❌ Não mudar as variáveis CSS de cor
- ❌ Não remover funcionalidades existentes
- ❌ Não usar inline styles onde há classe CSS
- ❌ Não calcular lucro só no frontend (salvar no Firestore)
- ❌ Não mostrar dados financeiros ao técnico
- ❌ Não mostrar anotacao_interna em documentos
- ❌ Não fazer upload de imagem sem compressão
- ❌ Não commitar o arquivo .env
