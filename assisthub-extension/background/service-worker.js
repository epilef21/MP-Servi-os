const API_BASE = 'https://us-central1-checklist-53795.cloudfunctions.net';
const APP_URL = 'https://mp-servi-os.vercel.app';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ authToken: null, empresaSlug: null });
});

// Mensagens internas (popup → service worker)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  if (request.action === 'criarOS') {
    handleCriarOS(request.data, sendResponse);
    return true;
  }

  if (request.action === 'verificarAuth') {
    handleVerificarAuth(sendResponse);
    return true;
  }

  if (request.action === 'logout') {
    chrome.storage.local.set({ authToken: null, empresaSlug: null });
    sendResponse({ success: true });
    return true;
  }
});

// Mensagem externa enviada pelo AssistHub após login (?extension=auth)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (sender.origin !== APP_URL) return;

  if (request.action === 'setAuth' && request.token && request.empresaSlug) {
    chrome.storage.local.set({
      authToken: request.token,
      empresaSlug: request.empresaSlug
    }, () => sendResponse({ success: true }));
    return true;
  }
});

async function handleCriarOS(dados, sendResponse) {
  try {
    const { authToken, empresaSlug } = await chrome.storage.local.get([
      'authToken', 'empresaSlug'
    ]);

    if (!authToken || !empresaSlug) {
      sendResponse({
        success: false,
        error: 'Não autenticado. Conecte ao AssistHub primeiro.'
      });
      return;
    }

    if (isTokenExpired(authToken)) {
      await chrome.storage.local.set({ authToken: null });
      sendResponse({
        success: false,
        error: 'Sessão expirada. Clique em "Desconectar" e conecte novamente ao AssistHub.',
        requiresReauth: true
      });
      return;
    }

    const response = await fetch(`${API_BASE}/criarOSFromExtension`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ ...dados, empresaSlug, origem: 'chrome_extension' })
    });

    // Firebase gateway retorna HTML (não JSON) para 401/403 — verificar antes de parsear
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (response.status === 401 || response.status === 403) {
        // Token expirado ou inválido — limpa e pede reconexão
        await chrome.storage.local.set({ authToken: null });
        sendResponse({
          success: false,
          error: 'Sessão expirada. Clique em "Desconectar" e conecte novamente ao AssistHub.',
          requiresReauth: true
        });
      } else {
        sendResponse({
          success: false,
          error: `Erro ${response.status} ao conectar com o servidor.`
        });
      }
      return;
    }

    const json = await response.json();

    if (json.error) {
      throw new Error(typeof json.error === 'string' ? json.error : (json.error.message || 'Erro ao criar OS'));
    }

    const result = json.result;
    sendResponse({
      success: true,
      data: result,
      osUrl: `${APP_URL}/${empresaSlug}/admin?os=${result.osId}`
    });

  } catch (error) {
    console.error('[AssistHub] Erro ao criar OS:', error);
    sendResponse({
      success: false,
      error: error.message || 'Erro de conexão com o AssistHub'
    });
  }
}

async function handleVerificarAuth(sendResponse) {
  const { authToken, empresaSlug } = await chrome.storage.local.get([
    'authToken', 'empresaSlug'
  ]);
  let valido = false;
  if (authToken && empresaSlug) {
    if (isTokenExpired(authToken)) {
      await chrome.storage.local.set({ authToken: null });
    } else {
      valido = true;
    }
  }
  sendResponse({ autenticado: valido, empresaSlug: empresaSlug || null });
}

function isTokenExpired(token) {
  try {
    // JWTs do Firebase usam base64url (- e _ em vez de + e /)
    // atob só aceita base64 padrão — é necessário converter antes
    const base64url = token.split('.')[1];
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}
