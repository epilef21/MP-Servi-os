# SECURITY.md — AssistHub
# Documentação de Segurança
# Última atualização: 2026-05-13

---

## Visão geral

Este documento registra todas as medidas de segurança implementadas no AssistHub,
o raciocínio por trás de cada uma e as pendências recomendadas para o próximo ciclo.

---

## O que já estava implementado antes das correções de Maio/2026

| Controle | Onde | Detalhe |
|---|---|---|
| Firebase Auth | `AuthContext.jsx` | Login com email/senha — token JWT gerenciado pelo Firebase |
| Isolamento multi-tenant | `firestore.rules` | Dados de cada empresa isolados por `empresaId` |
| Token público em OS | `FormPage.jsx` | `publicToken` UUID — links de técnico/avaliação não são sequenciais |
| Restrição de orçamentos | `firestore.rules` | Update restrito por `status` e conjunto de campos permitidos |
| Storage protegido | `storage.rules` | Upload só aceita `image/*`, tamanho máximo 5 MB |
| `allow read: if true` consciente | `firestore.rules` | Empresa raiz pública só para lookup por slug (necessário) |

---

## Correções implementadas em Maio/2026

### C1 — Remoção de VITE_ADMIN_PASSWORD + autenticação superadmin via Cloud Function

**Problema:** A senha do painel superadmin estava em `VITE_ADMIN_PASSWORD` no `.env`.
Qualquer variável `VITE_*` é empacotada no bundle JavaScript e visível no navegador.
Mesmo não sendo usada no código JSX, a presença no bundle a expunha.

**O que foi feito:**

- `VITE_ADMIN_PASSWORD` removido de `.env` e `.env.example`
- `AuthContext.jsx` migrado de comparação por e-mail para verificação de **custom claims**:
  ```js
  // Antes (inseguro — e-mail é um dado público, não um segredo)
  if (user.email === SUPERADMIN_EMAIL) setIsSuperAdmin(true)

  // Depois (seguro — claim emitido pelo servidor após bcrypt)
  const token = await user.getIdTokenResult()
  const ok = token.claims.role === 'superadmin'
          && token.claims.superadmin_until > Date.now() / 1000
  setIsSuperAdmin(ok)
  ```
- `functions/verifySuperAdmin.js` criado: Cloud Function `onCall` que compara a
  senha enviada pelo admin com um **hash bcrypt** armazenado em variável de ambiente
  do servidor (`SUPERADMIN_PASSWORD_HASH`). Nunca retorna o hash ao cliente.
- Custom claim emitido: `{ role: 'superadmin', superadmin_until: now + 3600 }` (expira em 1h).
- `SuperAdminPage.jsx` atualizado: se o usuário tem o e-mail superadmin mas sem
  claim válido, exibe modal de senha antes de mostrar o painel.
- `AuthContext.jsx` expõe `refreshSuperAdminClaim()` para forçar refresh do token
  após verificação bem-sucedida.

**Setup necessário (uma vez):**
```bash
# 1. Gerar o hash bcrypt (rodar localmente)
cd functions
node -e "const b=require('bcryptjs'); console.log(b.hashSync('SUA_SENHA_FORTE',12))"

# 2. Criar functions/.env (nunca commitar)
SUPERADMIN_PASSWORD_HASH=$2b$12$...
SUPERADMIN_EMAIL=tvf23407@gmail.com

# 3. Deploy da função
firebase deploy --only functions
```

**Arquivos alterados:**
- `mp-react/.env` — removido `VITE_ADMIN_PASSWORD`
- `mp-react/.env.example` — removido `VITE_ADMIN_PASSWORD`
- `functions/verifySuperAdmin.js` — criado
- `functions/index.js` — exporta `verifySuperAdmin`
- `mp-react/src/contexts/AuthContext.jsx` — custom claims + `refreshSuperAdminClaim()`
- `mp-react/src/pages/SuperAdminPage.jsx` — modal de verificação de senha

---

### C2 — Firestore Rules v4: helpers em inglês, isTecnicoOfEmpresa, bloqueio financeiro ampliado

**Problema:** Regras usavam nomes em português (`eSuperAdmin`, `eDonoEmpresa`),
verificavam superadmin por e-mail hardcoded em vez de custom claim, e não tinham
helper para técnicos autenticados. Bloqueio de campos financeiros era parcial (3 campos).

**O que foi feito:**

- Renomeados helpers para inglês: `isAuthenticated()`, `isSuperAdmin()`,
  `isUserOfEmpresa()`, `isTecnicoOfEmpresa()`
- `isSuperAdmin()` agora verifica o **custom claim com expiração**:
  ```
  request.auth.token.role == 'superadmin' &&
  request.auth.token.superadmin_until > request.time.toMillis() / 1000
  ```
- `isTecnicoOfEmpresa()` adicionado para técnicos com Firebase Auth próprio
- Bloqueio financeiro na criação de OS ampliado de 3 para 7 campos:
  `mo_seguradora`, `valor_prestador`, `valor_deslocamento`,
  `maoDeObraSeguradora`, `valorPagoTecnico`, `kmDeslocamento`, `lucroReal`
- Coleção `rateLimits` bloqueada para clientes (`allow read, write: if false`)

**Arquivo alterado:** `firestore.rules`

---

### C3 — Security Headers e CSP no Vercel

**Problema:** `vercel.json` tinha apenas o rewrite de SPA, sem headers de segurança.
Sem CSP, o site fica vulnerável a XSS via injeção de scripts externos.

**O que foi feito:** `vercel.json` atualizado com os seguintes headers em todas as rotas:

| Header | Valor | Proteção |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'` + domínios Firebase | Bloqueia scripts/conexões não autorizados |
| `X-Frame-Options` | `DENY` | Previne clickjacking via iframe |
| `X-Content-Type-Options` | `nosniff` | Previne MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controla dados enviados no Referer |
| `Permissions-Policy` | `camera=(self), microphone=(self), geolocation=(self)` | Limita acesso a APIs sensíveis |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Força HTTPS |

**CSP detalhada:**
```
default-src 'self'
script-src 'self'
style-src 'self' 'unsafe-inline'
font-src 'self' fonts.gstatic.com
img-src 'self' data: blob: *.firebasestorage.app *.firebasestorage.googleapis.com https://*.tile.openstreetmap.org
connect-src 'self'
  https://*.googleapis.com
  https://*.firebaseapp.com
  https://*.firebaseio.com
  https://*.firebasestorage.app
  https://us-central1-checklist-53795.cloudfunctions.net
  wss://*.firebaseio.com
  https://viacep.com.br
  https://fcmregistrations.googleapis.com
  https://nominatim.openstreetmap.org
  https://router.project-osrm.org
frame-src 'none'
object-src 'none'
base-uri 'self'
form-action 'self'
```

**Arquivo alterado:** `mp-react/vercel.json`

---

### C4 — Rate Limiting via Firestore

**Problema:** `criarOSFromExtension` não tinha limite de requisições, permitindo
abuso (spam de OS, custo Firebase, dados corrompidos).

**O que foi feito:** `functions/rateLimit.js` criado com limites por janela de tempo:

| Ação | Limite | Janela |
|---|---|---|
| `login` | 5 tentativas | 5 minutos |
| `criarOS` | 30 requisições | 1 hora |
| `upload` | 50 requisições | 1 hora |

- Usa transação Firestore para evitar race conditions
- Janela deslizante: ao expirar, contagem é zerada automaticamente
- Retorna `HTTP 429` com `retryAfter` em segundos quando excedido
- Coleção `rateLimits` bloqueada para clientes nas Firestore Rules

Aplicado em `criarOSFromExtension` antes de qualquer lógica de negócio.

**Arquivos alterados/criados:**
- `functions/rateLimit.js` — criado
- `functions/index.js` — `checkRateLimit` aplicado

---

### C5 — Validação de Input com Zod

**Problema:** `criarOSFromExtension` extraía campos do body sem validação de tipo
ou presença, e não havia barreira contra campos financeiros vindos do cliente.

**O que foi feito:** `functions/validators.js` criado com `OSSchema` usando Zod:

- Schema `.strict()`: rejeita qualquer campo não declarado explicitamente
- Campos financeiros verificados antes do parse: se `maoDeObraSeguradora`,
  `valorPagoTecnico`, `kmDeslocamento`, `lucroReal` (ou variantes) chegarem no
  body, a requisição é rejeitada com `400 invalid-argument`
- `seguradora` validada como `z.enum([...])` contra lista fixa de seguradoras
- Strings têm `max()` definido para prevenir payloads inflados
- Instala `zod` nas Cloud Functions

**Arquivos criados/alterados:**
- `functions/validators.js` — criado
- `functions/index.js` — `validateOS` aplicado
- `functions/package.json` — `zod` adicionado

---

### C6 — Sanitização de Uploads no Frontend

**Problema:** Arquivos eram enviados ao Firebase Storage sem verificação de
magic numbers. Um atacante poderia renomear `malware.html` para `foto.jpg` e fazer upload.

**O que foi feito:** `mp-react/src/utils/validarUpload.js` criado com três camadas:

1. **Tipo MIME declarado:** aceita apenas `image/jpeg`, `image/png`, `image/webp`
2. **Tamanho:** rejeita arquivos maiores que 400 KB antes da compressão
3. **Magic numbers:** lê os primeiros bytes do arquivo e compara com assinaturas
   conhecidas (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`, WebP: `52 49 46 46`)

A função `validarUpload(file)` deve ser chamada antes de `browser-image-compression`
em qualquer ponto de upload da aplicação.

**Arquivo criado:** `mp-react/src/utils/validarUpload.js`

---

### C7 — Audit Log

**Problema:** Não havia rastreabilidade de ações — impossível saber quem criou,
editou ou excluiu uma OS em caso de disputa.

**O que foi feito:** `functions/auditLog.js` criado com a função `registrarAuditoria()`:

- Grava em: `empresas/{empresaId}/auditoria/{autoId}`
- Campos registrados: `acao`, `entidade`, `entidadeId`, `usuarioId`, `usuarioEmail`,
  `ip`, `userAgent`, `timestamp`, `dadosAntes` (opcional), `dadosDepois` (opcional)
- Campos financeiros são omitidos dos dados gravados (`sanitizarDados()`)
- Falha silenciosa: erro no log nunca derruba a operação principal
- Aplicado em `criarOSFromExtension`

**Arquivos criados/alterados:**
- `functions/auditLog.js` — criado
- `functions/index.js` — `registrarAuditoria` aplicado

---

## Resumo dos arquivos criados/modificados

| Arquivo | Ação | Correção |
|---|---|---|
| `mp-react/.env` | Modificado | C1 |
| `mp-react/.env.example` | Modificado | C1 |
| `mp-react/vercel.json` | Modificado | C3 |
| `firestore.rules` | Modificado | C2 |
| `mp-react/src/contexts/AuthContext.jsx` | Modificado | C1 |
| `mp-react/src/pages/SuperAdminPage.jsx` | Modificado | C1 |
| `mp-react/src/utils/validarUpload.js` | Criado | C6 |
| `functions/index.js` | Modificado | C4, C5, C7 |
| `functions/verifySuperAdmin.js` | Criado | C1 |
| `functions/rateLimit.js` | Criado | C4 |
| `functions/validators.js` | Criado | C5 |
| `functions/auditLog.js` | Criado | C7 |
| `functions/.env.example` | Criado | C1 |
| `functions/package.json` | Modificado | C1 (bcryptjs), C5 (zod) |

---

## Pendências e recomendações

Veja a seção abaixo: "O que mais posso fazer em segurança".
