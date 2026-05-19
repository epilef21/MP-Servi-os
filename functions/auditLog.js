// ============================================================
// auditLog.js — Registro de auditoria para Cloud Functions
// Grava em: empresas/{empresaId}/auditoria/{autoId}
//
// Uso:
//   const { registrarAuditoria } = require('./auditLog');
//   await registrarAuditoria(db, {
//     empresaId, acao, entidade, entidadeId,
//     usuarioId, usuarioEmail, req,
//     dadosAntes, dadosDepois,
//   });
// ============================================================
const { FieldValue } = require('firebase-admin/firestore');

/**
 * Registra uma ação na coleção de auditoria da empresa.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} opts
 * @param {string}  opts.empresaId
 * @param {string}  opts.acao          ex: 'criar_os', 'editar_os', 'excluir_os'
 * @param {string}  opts.entidade       ex: 'checklist', 'orcamento', 'tecnico'
 * @param {string}  opts.entidadeId
 * @param {string}  opts.usuarioId
 * @param {string}  opts.usuarioEmail
 * @param {object}  [opts.req]          request HTTP (para extrair IP e user-agent)
 * @param {object}  [opts.dadosAntes]   estado anterior (para edições)
 * @param {object}  [opts.dadosDepois]  estado novo
 */
async function registrarAuditoria(db, {
  empresaId,
  acao,
  entidade,
  entidadeId,
  usuarioId,
  usuarioEmail,
  req,
  dadosAntes  = null,
  dadosDepois = null,
}) {
  if (!empresaId || !acao || !entidade || !entidadeId) return;

  const ip        = req ? (req.headers['x-forwarded-for'] || req.ip || '') : '';
  const userAgent = req ? (req.headers['user-agent'] || '') : '';

  const entrada = {
    acao,
    entidade,
    entidadeId,
    usuarioId:    usuarioId    || '',
    usuarioEmail: usuarioEmail || '',
    ip:           ip.split(',')[0].trim(),
    userAgent:    userAgent.slice(0, 200),
    timestamp:    FieldValue.serverTimestamp(),
  };

  // Só inclui dados antes/depois se fornecidos (evita campos undefined)
  if (dadosAntes  !== null) entrada.dadosAntes  = sanitizarDados(dadosAntes);
  if (dadosDepois !== null) entrada.dadosDepois = sanitizarDados(dadosDepois);

  try {
    await db
      .collection('empresas').doc(empresaId)
      .collection('auditoria').add(entrada);
  } catch (err) {
    // Falha no audit log nunca deve derrubar a operação principal
    console.error('[auditLog] Falha ao gravar auditoria:', err.message);
  }
}

// Remove campos sensíveis e campos financeiros dos dados gravados
function sanitizarDados(dados) {
  if (!dados || typeof dados !== 'object') return dados;
  const OMITIR = ['valorPagoTecnico', 'maoDeObraSeguradora', 'lucroReal', 'kmDeslocamento'];
  const limpo = { ...dados };
  for (const campo of OMITIR) delete limpo[campo];
  return limpo;
}

module.exports = { registrarAuditoria };
