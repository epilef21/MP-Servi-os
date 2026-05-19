// ============================================================
// rateLimit.js — Rate limiting via Firestore
// Usa a coleção 'rateLimits' com documentos TTL-based.
//
// Limites:
//   login     → 5 tentativas em 5 min por IP/uid
//   criarOS   → 30 por hora por uid
//   upload    → 50 por hora por uid
//
// Uso:
//   const { checkRateLimit } = require('./rateLimit');
//   await checkRateLimit(db, 'criarOS', uid);  // lança HttpsError se excedido
// ============================================================
const { HttpsError } = require('firebase-functions/v2/https');
const { FieldValue }  = require('firebase-admin/firestore');

const LIMITS = {
  login:   { max: 5,  windowMs: 5  * 60 * 1000 },
  criarOS: { max: 30, windowMs: 60 * 60 * 1000 },
  upload:  { max: 50, windowMs: 60 * 60 * 1000 },
};

/**
 * Verifica e registra uma tentativa de rate limit.
 * Lança HttpsError 'resource-exhausted' se o limite for ultrapassado.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {'login'|'criarOS'|'upload'} action
 * @param {string} key  uid ou IP do chamador
 */
async function checkRateLimit(db, action, key) {
  const limit = LIMITS[action];
  if (!limit) return; // ação desconhecida: não bloqueia

  const docKey  = `${action}:${key}`;
  const ref     = db.collection('rateLimits').doc(docKey);
  const now     = Date.now();
  const windowStart = now - limit.windowMs;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      tx.set(ref, {
        action,
        key,
        count:       1,
        windowStart: now,
        updatedAt:   FieldValue.serverTimestamp(),
      });
      return;
    }

    const data = snap.data();

    // Janela expirou → reseta contagem
    if (data.windowStart < windowStart) {
      tx.set(ref, {
        action,
        key,
        count:       1,
        windowStart: now,
        updatedAt:   FieldValue.serverTimestamp(),
      });
      return;
    }

    if (data.count >= limit.max) {
      const retryAfterMs = (data.windowStart + limit.windowMs) - now;
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      throw new HttpsError(
        'resource-exhausted',
        `Muitas requisições para "${action}". Tente novamente em ${retryAfterSec}s.`,
        { retryAfter: retryAfterSec }
      );
    }

    tx.update(ref, {
      count:     data.count + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

module.exports = { checkRateLimit };
