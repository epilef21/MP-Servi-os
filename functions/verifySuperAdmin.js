// ============================================================
// verifySuperAdmin — Cloud Function (Gen 2, onCall)
// Verifica senha do superadmin com bcrypt e emite custom claim
// com expiração de 1 hora. NUNCA expõe hash ou senha ao cliente.
//
// Setup:
//   1. Gere o hash: node -e "const b=require('bcryptjs'); console.log(b.hashSync('SUA_SENHA',12))"
//   2. Crie functions/.env com: SUPERADMIN_PASSWORD_HASH=<hash>
//      E: SUPERADMIN_EMAIL=tvf23407@gmail.com
// ============================================================
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin  = require('firebase-admin');
const bcrypt = require('bcryptjs');

const SUPERADMIN_EMAIL        = process.env.SUPERADMIN_EMAIL        || 'tvf23407@gmail.com';
const SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '';

exports.verifySuperAdmin = onCall({ maxInstances: 5 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'É necessário estar autenticado.');
  }

  const { password } = request.data || {};

  if (!password || typeof password !== 'string') {
    throw new HttpsError('invalid-argument', 'Senha não fornecida.');
  }

  // Verifica que quem chama é o e-mail superadmin
  if (request.auth.token.email !== SUPERADMIN_EMAIL) {
    throw new HttpsError('permission-denied', 'Acesso negado.');
  }

  if (!SUPERADMIN_PASSWORD_HASH) {
    throw new HttpsError('internal', 'Servidor não configurado. Defina SUPERADMIN_PASSWORD_HASH.');
  }

  const senhaValida = await bcrypt.compare(password, SUPERADMIN_PASSWORD_HASH);
  if (!senhaValida) {
    throw new HttpsError('permission-denied', 'Senha incorreta.');
  }

  // Define custom claim com expiração em 1 hora
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  await admin.auth().setCustomUserClaims(request.auth.uid, {
    role: 'superadmin',
    superadmin_until: expiresAt,
  });

  return { success: true, expiresAt };
});
