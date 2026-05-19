const { onRequest }  = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

admin.initializeApp();

const { verifySuperAdmin }  = require('./verifySuperAdmin');
const { checkRateLimit }    = require('./rateLimit');
const { validateOS }        = require('./validators');
const { registrarAuditoria } = require('./auditLog');

exports.verifySuperAdmin = verifySuperAdmin;

const db      = getFirestore();
const APP_URL = process.env.APP_URL || 'https://mp-servi-os.vercel.app';

// CORS restrito às origens conhecidas.
// EXTENSION_ID é o ID da extensão carregada no Edge (edge://extensions).
// Defina em functions/.env: EXTENSION_ID=abcdefghijklmnopqrstuvwxyzabcdef
const EXTENSION_ID = process.env.EXTENSION_ID || '';
const CORS_ORIGINS = [
  APP_URL,
  ...(EXTENSION_ID ? [`chrome-extension://${EXTENSION_ID}`] : []),
];

exports.criarOSFromExtension = onRequest({
  cors: CORS_ORIGINS,
  maxInstances: 10
}, async (req, res) => {

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Verifica token Firebase (onRequest não verifica automaticamente)
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token ausente.' });
    return;
  }

  let uid, userEmail;
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    uid       = decoded.uid;
    userEmail = decoded.email || '';
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado. Reconecte a extensão.' });
    return;
  }

  // Rate limiting: 30 OS por hora por usuário
  try {
    await checkRateLimit(db, 'criarOS', uid);
  } catch (err) {
    res.status(429).json({ error: err.message, retryAfter: err.details?.retryAfter });
    return;
  }

  // Validação de input com Zod (rejeita campos inválidos e financeiros)
  const body = req.body?.data ?? req.body ?? {};
  let dadosValidados;
  try {
    dadosValidados = validateOS(body);
  } catch (err) {
    res.status(400).json({ error: err.message });
    return;
  }

  const {
    nome_segurado, tel_segurado, endereco, numero,
    cidade, bairro, cep, tipo_sinistro, descricao,
    numero_os, seguradora, empresaSlug, origem,
    data_chegada, hora_chegada, hora_saida,
  } = dadosValidados;

  // Converte DD/MM/AAAA → YYYY-MM-DD para a Agenda
  function toISO(ddmmyyyy) {
    if (!ddmmyyyy) return '';
    const p = ddmmyyyy.split('/');
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
  }

  // Resolve empresaId do usuário
  let userEmpresaId;
  const empresaDirectSnap = await db.collection('empresas').doc(uid).get();
  if (empresaDirectSnap.exists) {
    userEmpresaId = uid;
  } else {
    const userDoc = await db.collection('usuarios').doc(uid).get();
    if (!userDoc.exists) {
      res.status(403).json({ error: 'Usuário não encontrado.' });
      return;
    }
    userEmpresaId = userDoc.data().empresaId || null;
  }

  const empresaSnap = await db.collection('empresas')
    .where('slug', '==', empresaSlug)
    .where('ativo', '==', true)
    .limit(1)
    .get();

  if (empresaSnap.empty) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const empresaId   = empresaSnap.docs[0].id;
  const empresaData = empresaSnap.docs[0].data();

  if (empresaId !== userEmpresaId) {
    res.status(403).json({ error: 'Acesso negado a esta empresa.' });
    return;
  }

  if (seguradora && empresaData.seguradoras?.length > 0) {
    if (!empresaData.seguradoras.includes(seguradora)) {
      res.status(400).json({ error: `Seguradora "${seguradora}" não configurada.` });
      return;
    }
  }

  const osRef  = db.collection('empresas').doc(empresaId).collection('checklist').doc();
  const osData = {
    nome_segurado: nome_segurado || '',
    tel_segurado:  tel_segurado  || '',
    endereco:      endereco      || '',
    numero:        numero        || '',
    cidade:        cidade        || '',
    bairro:        bairro        || '',
    cep:           cep           || '',
    servico:       tipo_sinistro || '',
    descricao:     descricao     || '',
    num_assist:    numero_os     || '',
    seguradora:    seguradora    || '',
    data_chegada:  data_chegada  || '',
    hora_chegada:  hora_chegada  || '',
    hora_saida:    hora_saida    || '',
    data_agendada: toISO(data_chegada),
    hora_agendada: hora_chegada  || '',
    origem:              origem || 'chrome_extension',
    criado_em:           FieldValue.serverTimestamp(),
    criado_por:          uid,
    status:              'pendente',
    // Campos financeiros sempre zerados pelo servidor — nunca aceitos do cliente
    maoDeObraSeguradora: 0,
    valorPagoTecnico:    0,
    kmDeslocamento:      0,
    lucroReal:           0,
    link_publico: `${APP_URL}/${empresaSlug}/${osRef.id}`,
  };

  await osRef.set(osData);

  // Audit log (falha silenciosa — não derruba a operação)
  await registrarAuditoria(db, {
    empresaId,
    acao:         'criar_os',
    entidade:     'checklist',
    entidadeId:   osRef.id,
    usuarioId:    uid,
    usuarioEmail: userEmail,
    req,
    dadosDepois:  { nome_segurado, seguradora, origem },
  });

  res.json({ result: { success: true, osId: osRef.id, link: osData.link_publico } });
});
