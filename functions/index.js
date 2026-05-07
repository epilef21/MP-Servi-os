const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

admin.initializeApp();

const db      = getFirestore();
const APP_URL = process.env.APP_URL || 'https://mp-servi-os.vercel.app';

exports.criarOSFromExtension = onRequest({
  cors: true,
  maxInstances: 10
}, async (req, res) => {

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Verifica token Firebase manualmente (onCall usa Cloud IAM que rejeita tokens Firebase direto)
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token ausente.' });
    return;
  }

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado. Reconecte a extensão.' });
    return;
  }

  const body = req.body?.data ?? req.body ?? {};
  const {
    nome_segurado, tel_segurado, endereco, numero,
    cidade, bairro, cep, tipo_sinistro, descricao,
    numero_os, seguradora, empresaSlug, origem, data_chegada
  } = body;

  if (!nome_segurado || !endereco || !empresaSlug) {
    res.status(400).json({ error: 'Campos obrigatórios faltando.' });
    return;
  }

  // Resolve empresaId do usuário (mesma lógica do AuthContext)
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
    origem:           origem        || 'chrome_extension',
    criado_em:        FieldValue.serverTimestamp(),
    criado_por:       uid,
    status:           'pendente',
    maoDeObraSeguradora: 0,
    valorPagoTecnico:    0,
    kmDeslocamento:      0,
    lucroReal:           0,
    link_publico: `${APP_URL}/${empresaSlug}/${osRef.id}`
  };

  await osRef.set(osData);

  res.json({ result: { success: true, osId: osRef.id, link: osData.link_publico } });
});
