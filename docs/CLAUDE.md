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
VITE_FIREBASE_API_KEY=AIzaSyA3vITYav6RNoAC4ujU2xbxod_o-cWZFk0
VITE_FIREBASE_AUTH_DOMAIN=checklist-53795.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=checklist-53795
VITE_FIREBASE_STORAGE_BUCKET=checklist-53795.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=294280485643
VITE_FIREBASE_APP_ID=1:294280485643:web:fce323bf3731cba88ba00e
VITE_ADMIN_PASSWORD=mp@admin2024

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
Email: tvf23407@gmail.com
Acesso: /superadmin
Empresa de teste:
Slug: mp-servicos
Email: mpservicos834@gmail.com
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
