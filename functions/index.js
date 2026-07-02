const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const { google } = require('googleapis');

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

// ============================================================
// GOOGLE CALENDAR — integração com refresh token automático
// ============================================================

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Obtém um access_token válido renovando pelo refresh_token salvo no Firestore.
// Atualiza access_token e expiry_date na conta após renovar.
async function obterAccessTokenValido(empresaId, contaId) {
  const contaRef = admin.firestore()
    .collection('empresas').doc(empresaId)
    .collection('googleCalendarContas').doc(contaId);

  const contaSnap = await contaRef.get();
  if (!contaSnap.exists) throw new Error('Conta Google não encontrada');

  const conta = contaSnap.data();
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: conta.refresh_token });

  const { credentials } = await oauth2Client.refreshAccessToken();

  await contaRef.update({
    access_token: credentials.access_token,
    expiry_date:  credentials.expiry_date,
  });

  return credentials.access_token;
}

// Monta o corpo do evento a partir dos dados da OS.
// Se _horarioManualInicio estiver presente (novo fluxo da Agenda), usa esse horário
// com fim provisório em 23:59 — ajustado quando o técnico envia o checklist.
// Caso contrário, usa faixa_horario como fallback; sem nenhum, cria evento de dia inteiro.
function montarEventBody(os) {
  const base = {
    summary:     `OS ${os.num_assist || ''} - ${os.nome_segurado || ''}`.trim(),
    location:    `${os.endereco || ''}${os.numero ? ', ' + os.numero : ''} - ${os.cidade || ''}`,
    description: `Seguradora: ${os.seguradora || '-'}\n` +
                 `Serviço: ${os.servico || '-'}\n` +
                 `Cliente: ${os.nome_segurado || '-'}\n` +
                 `Telefone: ${os.tel_segurado || '-'}` +
                 (os.desc_problema ? `\n\nDescrição: ${os.desc_problema}` : '') +
                 (os._checklistLink ? `\n\n🔗 Preencher Checklist:\n${os._checklistLink}` : ''),
  };

  // Horário manual vindo da tela de Agenda (fim provisório = 23:59)
  if (os._horarioManualInicio && os.data_agendada) {
    return {
      ...base,
      start: { dateTime: `${os.data_agendada}T${os._horarioManualInicio}:00`, timeZone: 'America/Sao_Paulo' },
      end:   { dateTime: `${os.data_agendada}T23:59:00`,                      timeZone: 'America/Sao_Paulo' },
    };
  }

  // Fallback: faixa de horário configurada na OS
  const faixaMap = {
    manha:    { inicio: '08:00:00', fim: '12:00:00' },
    tarde:    { inicio: '13:00:00', fim: '17:00:00' },
    dia_todo: { inicio: '08:00:00', fim: '17:00:00' },
  };
  const horarios = faixaMap[os.faixa_horario];

  if (horarios && os.data_agendada) {
    return {
      ...base,
      start: { dateTime: `${os.data_agendada}T${horarios.inicio}`, timeZone: 'America/Sao_Paulo' },
      end:   { dateTime: `${os.data_agendada}T${horarios.fim}`,    timeZone: 'America/Sao_Paulo' },
    };
  }

  return {
    ...base,
    start: { date: os.data_agendada },
    end:   { date: os.data_agendada },
  };
}

// Troca o código de autorização OAuth pelo par access_token + refresh_token
// e salva o refresh_token na subcoleção googleCalendarContas da empresa.
exports.conectarGoogleCalendar = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { authCode, empresaId, contaLabel } = request.data;
  const oauth2Client = getOAuthClient();

  try {
    const { tokens } = await oauth2Client.getToken(authCode);

    if (!tokens.refresh_token) {
      throw new HttpsError(
        'failed-precondition',
        'Sem refresh_token. Reconecte garantindo que o Google solicite consentimento novamente.'
      );
    }

    const contaRef = admin.firestore()
      .collection('empresas').doc(empresaId)
      .collection('googleCalendarContas').doc();

    await contaRef.set({
      label:         contaLabel || 'Conta Google',
      refresh_token: tokens.refresh_token,
      access_token:  tokens.access_token  || '',
      expiry_date:   tokens.expiry_date   || 0,
      conectado_em:  admin.firestore.FieldValue.serverTimestamp(),
      ativa:         true,
    });

    return { sucesso: true, contaId: contaRef.id };
  } catch (err) {
    console.error('Erro ao conectar Google Calendar:', err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'Falha ao conectar com o Google');
  }
});

// Lista as contas Google conectadas e ativas da empresa (sem expor tokens).
exports.listarContasGoogleCalendar = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { empresaId } = request.data;
  const snap = await admin.firestore()
    .collection('empresas').doc(empresaId)
    .collection('googleCalendarContas')
    .where('ativa', '==', true)
    .get();

  const contas = snap.docs.map(d => ({
    id:           d.id,
    label:        d.data().label,
    conectado_em: d.data().conectado_em,
  }));

  return { contas };
});

// Cria um evento no calendário das contas conectadas da empresa.
// contasIds (opcional): array de IDs específicos; se omitido, usa todas as contas ativas.
// Retorna um mapa { contaId: eventId } para salvar na OS.
exports.criarEventoCalendar = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { empresaId, osData, contasIds } = request.data;

  if (!osData.data_agendada) {
    return { sucesso: false, motivo: 'OS sem data agendada' };
  }

  const contasSnap = await admin.firestore()
    .collection('empresas').doc(empresaId)
    .collection('googleCalendarContas')
    .where('ativa', '==', true)
    .get();

  if (contasSnap.empty) {
    return { sucesso: false, motivo: 'Nenhuma conta conectada' };
  }

  // Filtra por contasIds se fornecido; caso contrário usa todas as ativas
  let contasDocs = contasSnap.docs;
  if (Array.isArray(contasIds) && contasIds.length > 0) {
    contasDocs = contasDocs.filter(d => contasIds.includes(d.id));
  }

  if (contasDocs.length === 0) {
    return { sucesso: false, motivo: 'Nenhuma conta selecionada' };
  }

  const eventBody      = montarEventBody(osData);
  const eventosCriados = {};

  for (const contaDoc of contasDocs) {
    try {
      const accessToken  = await obterAccessTokenValido(empresaId, contaDoc.id);
      const oauth2Client = getOAuthClient();
      oauth2Client.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const evento = await calendar.events.insert({
        calendarId:  'primary',
        requestBody: eventBody,
      });

      eventosCriados[contaDoc.id] = evento.data.id;
    } catch (err) {
      console.error(`Erro ao criar evento na conta ${contaDoc.id}:`, err);
      eventosCriados[contaDoc.id] = null;
    }
  }

  return { sucesso: true, eventosCriados };
});

// Atualiza eventos existentes em todas as contas que têm um eventId registrado.
exports.atualizarEventoCalendar = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { empresaId, osData, eventosExistentes } = request.data;
  const eventBody  = montarEventBody(osData);
  const resultados = {};

  for (const [contaId, eventId] of Object.entries(eventosExistentes || {})) {
    if (!eventId) continue;
    try {
      const accessToken  = await obterAccessTokenValido(empresaId, contaId);
      const oauth2Client = getOAuthClient();
      oauth2Client.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      await calendar.events.update({
        calendarId:  'primary',
        eventId,
        requestBody: eventBody,
      });

      resultados[contaId] = true;
    } catch (err) {
      console.error(`Erro ao atualizar evento conta ${contaId}:`, err);
      resultados[contaId] = false;
    }
  }

  return { sucesso: true, resultados };
});

// Exclui eventos do calendário antes de remover a OS do Firestore.
// Erro 404 (evento já excluído no Calendar) é tratado como sucesso.
exports.excluirEventoCalendar = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { empresaId, eventosExistentes } = request.data;
  const resultados = {};

  for (const [contaId, eventId] of Object.entries(eventosExistentes || {})) {
    if (!eventId) continue;
    try {
      const accessToken  = await obterAccessTokenValido(empresaId, contaId);
      const oauth2Client = getOAuthClient();
      oauth2Client.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      await calendar.events.delete({ calendarId: 'primary', eventId });
      resultados[contaId] = true;
    } catch (err) {
      if (err.code === 404 || err.response?.status === 404) {
        resultados[contaId] = true;
      } else {
        console.error(`Erro ao excluir evento conta ${contaId}:`, err);
        resultados[contaId] = false;
      }
    }
  }

  return { sucesso: true, resultados };
});

// Marca a conta como inativa (soft delete) — não exclui o documento.
exports.desconectarGoogleCalendar = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { empresaId, contaId } = request.data;

  await admin.firestore()
    .collection('empresas').doc(empresaId)
    .collection('googleCalendarContas').doc(contaId)
    .update({ ativa: false });

  return { sucesso: true };
});

// Envia notificação push para todos os tokens ativos da empresa quando um
// checklist é finalizado. Não exige autenticação — é chamada pelo técnico sem login.
exports.notificarChecklistEnviado = onCall(async (request) => {
  const webpush = require('web-push');

  // Chaves ficam no functions/.env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) —
  // a privada nunca pode ir para o repositório.
  const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { sucesso: false, motivo: 'Chaves VAPID não configuradas no ambiente' };
  }

  webpush.setVapidDetails(
    'mailto:tvf23407@gmail.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  const { empresaId, nomeSegurado, cidade, numAssist } = request.data;

  if (!empresaId) {
    return { sucesso: false, motivo: 'empresaId não informado' };
  }

  const subsSnap = await admin.firestore()
    .collection('empresas').doc(empresaId)
    .collection('notificacaoTokens')
    .where('ativo', '==', true)
    .get();

  if (subsSnap.empty) {
    return { sucesso: true, motivo: 'Nenhuma inscrição cadastrada' };
  }

  const bodyParts = [nomeSegurado || 'Cliente'];
  if (cidade) bodyParts.push(cidade);
  const bodyText = bodyParts.join(' — ') + (numAssist ? ` (OS ${numAssist})` : '');

  const payload = JSON.stringify({
    title: '✅ Checklist Recebido',
    body:  bodyText,
  });

  const results = await Promise.allSettled(
    subsSnap.docs.map(async (docSnap) => {
      let sub;
      try {
        sub = JSON.parse(docSnap.data().subscription);
      } catch {
        await docSnap.ref.update({ ativo: false });
        return;
      }
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        // Subscrição expirada ou inválida
        if (err.statusCode === 410 || err.statusCode === 404) {
          await docSnap.ref.update({ ativo: false });
        }
        throw err;
      }
    })
  );

  const enviados = results.filter(r => r.status === 'fulfilled').length;
  return {
    sucesso:  true,
    enviados,
    falhas:   results.length - enviados,
  };
});

// Ajusta o horário de FIM do evento para o momento exato em que o técnico enviou o checklist.
// NÃO exige autenticação — é chamada pelo técnico (sem login) via FormPage.
exports.finalizarEventoCalendar = onCall(async (request) => {
  const { empresaId, eventosExistentes, dataAgendada } = request.data;

  if (!eventosExistentes || Object.keys(eventosExistentes).length === 0) {
    return { sucesso: true, motivo: 'Nenhum evento para finalizar' };
  }

  // Hora atual no formato HH:MM:SS no fuso de Brasília
  const agora = new Date();
  const horaFimStr = agora.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const horaFimISO = `${dataAgendada}T${horaFimStr}`;

  const resultados = {};

  for (const [contaId, eventId] of Object.entries(eventosExistentes)) {
    if (!eventId) continue;
    try {
      const accessToken  = await obterAccessTokenValido(empresaId, contaId);
      const oauth2Client = getOAuthClient();
      oauth2Client.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      await calendar.events.patch({
        calendarId:  'primary',
        eventId,
        requestBody: {
          end: { dateTime: horaFimISO, timeZone: 'America/Sao_Paulo' },
        },
      });

      resultados[contaId] = true;
    } catch (err) {
      console.error(`Erro ao finalizar evento conta ${contaId}:`, err);
      resultados[contaId] = false;
    }
  }

  return { sucesso: true, resultados };
});
