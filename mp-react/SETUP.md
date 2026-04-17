# 🚀 SETUP — MP Serviços Checklist

Sistema completo: formulário para prestadores + painel administrativo com PDF.

---

## PRÉ-REQUISITOS

- Node.js instalado (baixe em https://nodejs.org — versão LTS)
- Conta Google (para o Firebase)

---

## PASSO 1 — Instalar dependências

Abra o terminal dentro da pasta do projeto e rode:

```bash
npm install
```

---

## PASSO 2 — Criar projeto no Firebase

1. Acesse **https://console.firebase.google.com**
2. Clique em **"Adicionar projeto"**
3. Nome: `mp-servicos` → clique em Continuar
4. Desative o Google Analytics (não precisa) → Criar projeto

### Ativar o Firestore (banco de dados):
1. No menu lateral, clique em **"Firestore Database"**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Iniciar no modo de produção"** → Avançar
4. Região: **southamerica-east1 (São Paulo)** → Concluído

### Configurar as regras de segurança do Firestore:
1. Na aba **"Regras"** do Firestore, substitua o conteúdo por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /checklist/{docId} {
      allow create: if true;
      allow read, update: if true;
    }
  }
}
```

2. Clique em **"Publicar"**

### Registrar o app Web no Firebase:
1. No painel do Firebase, clique no ícone **`</>`** (Web)
2. Nome do app: `mp-servicos-web` → Registrar
3. Copie o objeto `firebaseConfig` que aparecer (você vai precisar no próximo passo)

---

## PASSO 3 — Configurar variáveis de ambiente

1. Copie o arquivo `.env.example` e renomeie para `.env`:

```bash
cp .env.example .env
```

2. Abra o `.env` e preencha com as credenciais do Firebase:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

VITE_ADMIN_PASSWORD=MinhaSenh@Forte123
```

---

## PASSO 4 — Testar localmente

```bash
npm run dev
```

O projeto abrirá em **http://localhost:5173**

- **`/`** → Formulário dos prestadores
- **`/admin`** → Painel administrativo
- **`/login`** → Tela de login do painel

---

## PASSO 5 — Publicar online (Vercel — gratuito)

### Opção A: Via interface (mais fácil)
1. Acesse **https://vercel.com** → crie conta com GitHub
2. Faça upload do projeto ou conecte ao GitHub
3. Na configuração do projeto, adicione as variáveis de ambiente:
   - Vá em **Settings → Environment Variables**
   - Adicione cada linha do seu `.env` (sem o `VITE_` → a Vercel adiciona automaticamente)
4. Clique em **Deploy**
5. Seu link será algo como: `https://mp-servicos.vercel.app`

### Opção B: Via terminal
```bash
npm install -g vercel
vercel --prod
```

### Configurar o arquivo vercel.json (já incluído):
O arquivo `vercel.json` já está configurado corretamente para funcionar com React Router.

---

## ROTAS DO SISTEMA

| URL | Quem usa | Para quê |
|-----|----------|----------|
| `https://seusite.vercel.app/` | Prestadores | Preencher o checklist |
| `https://seusite.vercel.app/admin` | Você | Ver todos os relatórios |
| `https://seusite.vercel.app/login` | Você | Entrar no painel admin |

---

## COMO USAR NO DIA A DIA

### Para abrir uma OS:
1. Copie o link `/` e mande no WhatsApp para o prestador
2. Ele abre no celular → preenche → assina → envia
3. Você vê no painel em tempo real

### No painel admin:
1. Acesse `/admin` → faça login
2. Veja os cards: total, hoje, pendentes, processados
3. Clique em qualquer relatório para ver os detalhes
4. Baixe o PDF para enviar à seguradora
5. Marque como **Processado** → depois **Enviado**

---

## ESTRUTURA DE ARQUIVOS

```
src/
  main.jsx              → Entrada do app
  App.jsx               → Rotas
  firebase.js           → Configuração do Firebase
  index.css             → Estilos globais
  pages/
    FormPage.jsx        → Formulário dos prestadores
    AdminPage.jsx       → Painel administrativo
    LoginPage.jsx       → Login do admin
  utils/
    pdfGenerator.js     → Geração de PDF profissional
```

---

## ❓ PROBLEMAS COMUNS

| Problema | Solução |
|---------|---------|
| "Firebase: Error (auth/...)" | Verifique as credenciais no `.env` |
| Formulário envia mas não aparece no painel | Verifique as regras do Firestore |
| PDF não gera | Certifique-se que `jspdf` está instalado (`npm install`) |
| Rota `/admin` redireciona para `/login` | Faça login primeiro com a senha do `.env` |
| Build falha na Vercel | Adicione as variáveis de ambiente nas Settings da Vercel |

---

## 📞 SUPORTE

Dúvidas técnicas? Guarde sempre:
- URL do projeto Vercel: ___________________________
- Project ID do Firebase: __________________________
- Senha do admin (`.env`): _________________________
