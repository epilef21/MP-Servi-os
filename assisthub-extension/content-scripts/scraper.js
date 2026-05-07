// Roda no contexto da página dos portais de seguradora.
// Não pode fazer requisições cross-origin — só lê o DOM e envia para o service worker.

// ── Seletores CSS para portais com HTML estático ─────────────
const PORTAL_SELECTORS = {
  'portal.tempoassist.com.br': {
    nome_segurado: '[data-field="nome"]',
    tel_segurado:  '[data-field="telefone"]',
    endereco:      '[data-field="endereco"]',
    numero:        '[data-field="numero"]',
    cidade:        '[data-field="cidade"]',
    bairro:        '[data-field="bairro"]',
    cep:           '[data-field="cep"]',
    tipo_sinistro: '[data-field="tipo_sinistro"]',
    descricao:     '[data-field="descricao"]',
    numero_os:     '[data-field="numero_os"]',
    seguradora:    'Tempo'
  },
  'sistemas.maxpar.com.br': {
    nome_segurado: '#txtNomeSegurado',
    tel_segurado:  '#txtTelSegurado',
    endereco:      '#txtEndereco',
    numero:        '#txtNumero',
    cidade:        '#txtCidade',
    bairro:        '#txtBairro',
    cep:           '#txtCep',
    tipo_sinistro: '#ddlTipoSinistro',
    descricao:     '#txtDescricao',
    numero_os:     '#lblNumeroOS',
    seguradora:    'Maxpar'
  },
  'portal.allianz.com.br': {
    nome_segurado: '.field-nome input',
    tel_segurado:  '.field-telefone input',
    endereco:      '.field-endereco input',
    numero:        '.field-numero input',
    cidade:        '.field-cidade input',
    bairro:        '.field-bairro input',
    cep:           '.field-cep input',
    tipo_sinistro: '.field-tipo select',
    descricao:     '.field-descricao textarea',
    numero_os:     '.os-number',
    seguradora:    'Allianz'
  }
};

// ── Extração por label para portais Angular (ex: prestador.maxpar.com.br) ──
const PORTAL_LABEL_MAP = {
  'prestador.maxpar.com.br': {
    seguradora:    'Maxpar',
    nome_segurado: 'Nome do Beneficiário',
    tel_segurado:  'Telefone 01',
    endereco:      'Endereço de Origem',
    tipo_sinistro: 'Tipo de Serviço',
    descricao:     'Observações',
    numero_os:     'Protocolo'
  }
};

// Busca o valor do INPUT/TEXTAREA que segue um <label> com o texto exato
function getValorPorLabel(labelText) {
  for (const label of document.querySelectorAll('label')) {
    if (label.textContent?.trim() === labelText) {
      const el = label.nextElementSibling;
      if (el) return el.value || el.textContent?.trim() || '';
    }
  }
  return '';
}

// Tenta capturar o número da OS visível no card de detalhes (texto estático)
function getNumeroOSCard() {
  // Procura padrão alfanumérico de OS (ex: A26041786782/2)
  const textos = [...document.querySelectorAll('h1, h2, h3, p, span, div')]
    .map(el => el.childNodes)
    .reduce((acc, nodes) => {
      for (const n of nodes) {
        if (n.nodeType === Node.TEXT_NODE) acc.push(n.textContent.trim());
      }
      return acc;
    }, []);

  const osPattern = /[A-Z]\d{8,}(\/\d+)?/;
  return textos.find(t => osPattern.test(t)) || '';
}

function detectarPortal() {
  const h = window.location.hostname;
  if (PORTAL_SELECTORS[h]) return { tipo: 'css', config: PORTAL_SELECTORS[h] };
  if (PORTAL_LABEL_MAP[h])  return { tipo: 'label', config: PORTAL_LABEL_MAP[h] };
  return null;
}

function extrairPorCSS(selectors) {
  const dados = {};
  for (const [campo, seletor] of Object.entries(selectors)) {
    if (campo === 'seguradora') { dados[campo] = seletor; continue; }
    const el = document.querySelector(seletor);
    dados[campo] = el ? (el.value || el.textContent?.trim() || '') : '';
  }
  if (dados.tel_segurado) dados.tel_segurado = dados.tel_segurado.replace(/\D/g, '');
  if (dados.cep)          dados.cep          = dados.cep.replace(/\D/g, '');
  return dados;
}

function extrairPorLabel(labelMap) {
  const dados = { seguradora: labelMap.seguradora };
  const campos = ['nome_segurado','tel_segurado','endereco','tipo_sinistro','descricao','numero_os'];
  for (const campo of campos) {
    const labelText = labelMap[campo];
    dados[campo] = labelText ? getValorPorLabel(labelText) : '';
  }
  // Fallback: número da OS pelo card de detalhes se o campo Protocolo estiver vazio
  if (!dados.numero_os) dados.numero_os = getNumeroOSCard();

  if (dados.tel_segurado) dados.tel_segurado = dados.tel_segurado.replace(/\D/g, '');
  dados.numero  = '';
  dados.cidade  = '';
  dados.bairro  = '';
  dados.cep     = '';
  return dados;
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action !== 'extrairOS') return;

  const portal = detectarPortal();

  if (!portal) {
    sendResponse({
      success: false,
      error: 'Portal não suportado. Portais compatíveis: Tempo, Maxpar, Allianz.'
    });
    return true;
  }

  const dados = portal.tipo === 'label'
    ? extrairPorLabel(portal.config)
    : extrairPorCSS(portal.config);

  if (!dados.nome_segurado && !dados.endereco) {
    sendResponse({
      success: false,
      error: 'Não foi possível extrair dados. Verifique se a OS está aberta na página.'
    });
    return true;
  }

  sendResponse({ success: true, data: dados });
  return true;
});
