const APP_URL = 'https://mp-servi-os.vercel.app';

const $ = (id) => document.getElementById(id);

let dadosExtraidos = null;

document.addEventListener('DOMContentLoaded', async () => {
  const auth = await sendMessage({ action: 'verificarAuth' });

  if (!auth.autenticado) {
    mostrarTela('login');
  } else {
    mostrarTela('principal');
    $('empresa-slug').textContent = auth.empresaSlug;
    verificarPortalAtivo();
  }

  $('btn-conectar').addEventListener('click', abrirLogin);
  $('btn-logout').addEventListener('click', fazerLogout);
  $('btn-extrair').addEventListener('click', extrairDados);
  $('btn-criar-os').addEventListener('click', criarOS);
});

async function verificarPortalAtivo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const portais = {
      'portal.tempoassist.com.br': 'Tempo Assist',
      'novo-portal-prestador.prd.tempoassist.cloud': 'Portal Juvo (Tempo Assist)',
      'prestador.maxpar.com': 'Maxpar',
      'sistemas.maxpar.com.br': 'Maxpar',
      'portal.allianz.com.br': 'Allianz',
      'vianet.webmondial.com.br': 'Mondial Assistance'
    };

    const hostname = new URL(tab.url).hostname;
    const portal = portais[hostname];

    const infoEl = $('portal-info');
    if (portal) {
      infoEl.textContent = `🌐 Portal detectado: ${portal}`;
      infoEl.classList.remove('hidden');
      setStatus('Clique em "Extrair dados" para capturar a OS aberta.');
    } else {
      infoEl.classList.add('hidden');
      setStatus('Abra uma OS em um dos portais suportados para extrair.');
    }
  } catch {
    // Pode falhar em páginas internas do Chrome — sem problemas
  }
}

async function extrairDados() {
  const btn = $('btn-extrair');
  btn.disabled = true;
  setStatus('Lendo dados do portal...', 'loading');
  $('dados-extraidos').classList.add('hidden');
  $('btn-criar-os').classList.add('hidden');
  dadosExtraidos = null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) throw new Error('Nenhuma aba ativa encontrada.');

    // Injeta a função de extração diretamente na página (não depende de content script pré-carregado)
    const execResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extrairOSNaPagina
    });

    const result = execResults?.[0];
    if (!result?.result?.success) {
      const msg = result?.result?.error
        || result?.error?.message
        || 'Falha ao extrair dados. Verifique se a OS está aberta.';
      throw new Error(msg);
    }

    dadosExtraidos = result.result.data;
    if (dadosExtraidos.descricao && dadosExtraidos.descricao.length < 4) {
      dadosExtraidos.descricao = '';
    }
    renderizarDados(dadosExtraidos);
    $('btn-criar-os').classList.remove('hidden');
    setStatus('Dados extraídos com sucesso!', 'success');

  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function criarOS() {
  if (!dadosExtraidos) return;

  // Lê todos os campos editáveis antes de enviar
  for (const { id, key } of CAMPOS_OS) {
    const el = $(id);
    if (el) dadosExtraidos[key] = el.value.trim();
  }

  const btn = $('btn-criar-os');
  btn.disabled = true;
  setStatus('Criando OS no AssistHub...', 'loading');

  try {
    const result = await sendMessage({ action: 'criarOS', data: dadosExtraidos });

    if (!result?.success) {
      throw new Error(result?.error || 'Erro desconhecido.');
    }

    $('status').innerHTML = `
      <span class="success">✅ OS criada com sucesso!</span><br>
      <a class="os-link" href="${result.osUrl}" target="_blank">Abrir no AssistHub →</a><br>
      <button id="btn-copy-link" class="btn-copy" data-url="${result.formUrl}">📋 Copiar link do técnico</button>
    `;
    document.getElementById('btn-copy-link').addEventListener('click', function () {
      navigator.clipboard.writeText(this.dataset.url).then(() => {
        this.textContent = '✅ Link copiado!';
      });
    });

    chrome.tabs.create({ url: result.osUrl });

    dadosExtraidos = null;
    $('dados-extraidos').classList.add('hidden');
    $('btn-criar-os').classList.add('hidden');

  } catch (err) {
    setStatus(err.message, 'error');
    btn.disabled = false;
  }
}

function abrirLogin() {
  const extId = chrome.runtime.id;
  chrome.tabs.create({
    url: `${APP_URL}/login?extension=auth&ext_id=${extId}`
  });
  window.close();
}

async function fazerLogout() {
  await sendMessage({ action: 'logout' });
  dadosExtraidos = null;
  mostrarTela('login');
}

// ── Helpers ────────────────────────────────────────────────

function mostrarTela(nome) {
  $('tela-login').classList.add('hidden');
  $('tela-principal').classList.add('hidden');
  $(`tela-${nome}`).classList.remove('hidden');
}

function setStatus(msg, tipo = '') {
  const el = $('status');
  el.textContent = msg;
  el.className = `status ${tipo}`;
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (resp) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(resp);
      }
    });
  });
}

const CAMPOS_OS = [
  { id: 'f-nome',   label: 'Segurado',   key: 'nome_segurado',  full: true },
  { id: 'f-tel',    label: 'Telefone',   key: 'tel_segurado' },
  { id: 'f-seg',    label: 'Seguradora', key: 'seguradora' },
  { id: 'f-end',    label: 'Endereço',   key: 'endereco',       full: true },
  { id: 'f-num',    label: 'Número',     key: 'numero' },
  { id: 'f-bairro', label: 'Bairro',     key: 'bairro' },
  { id: 'f-cidade', label: 'Cidade',     key: 'cidade' },
  { id: 'f-cep',    label: 'CEP',        key: 'cep' },
  { id: 'f-tipo',   label: 'Serviço',    key: 'tipo_sinistro' },
  { id: 'f-os',     label: 'Nº OS',      key: 'numero_os' },
  { id: 'f-data',   label: 'Data',       key: 'data_chegada',   placeholder: 'DD/MM/AAAA' },
  { id: 'f-hora-i', label: 'Hora início', key: 'hora_chegada',  placeholder: 'HH:MM' },
  { id: 'f-hora-f', label: 'Hora fim',    key: 'hora_saida',    placeholder: 'HH:MM' },
  { id: 'f-desc',   label: 'Descrição',  key: 'descricao',      full: true, textarea: true }
];

function renderizarDados(dados) {
  const container = $('dados-extraidos');

  container.innerHTML = CAMPOS_OS.map(({ id, label, key, full, textarea, placeholder }) => {
    const val = dados[key] || '';
    const cls = `campo-grupo${full ? ' full' : ''}`;
    const ph  = placeholder || '';
    const escVal = val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inp = textarea
      ? `<textarea id="${id}" class="campo-input campo-textarea">${escVal}</textarea>`
      : `<input id="${id}" class="campo-input" type="text" value="${val.replace(/"/g, '&quot;')}" placeholder="${ph}" />`;
    return `<div class="${cls}"><label class="campo-label">${label}</label>${inp}</div>`;
  }).join('');

  container.classList.remove('hidden');
}

// ── Função injetada diretamente na aba (roda no contexto da página) ─────────
// IMPORTANTE: esta função não pode usar variáveis externas nem imports.
// Tudo que ela precisa deve estar definido dentro dela.
function extrairOSNaPagina() {
  const SELECTORS = {
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

  const LABEL_MAP = {
    'prestador.maxpar.com': {
      seguradora:    'Maxpar',
      nome_segurado: 'Nome do Beneficiário',
      tel_segurado:  'Telefone 01',
      endereco:      'Endereço de Origem',
      tipo_sinistro: 'Tipo de Serviço',
      descricao:     'Observações',
      numero_os:     'Protocolo'
    }
  };

  function getByLabel(text) {
    for (const label of document.querySelectorAll('label')) {
      if (label.textContent?.trim() === text) {
        const el = label.nextElementSibling;
        return el ? (el.value || el.textContent?.trim() || '') : '';
      }
    }
    return '';
  }

  // Tenta encontrar o número de OS em texto estático (ex: "A26041786782/2")
  function getOSCardText(pattern) {
    for (const el of document.querySelectorAll('p, span, td, dd, div, h1, h2, h3')) {
      if (el.children.length === 0) {
        const t = el.textContent?.trim();
        if (t && pattern.test(t)) return t;
      }
    }
    return '';
  }

  const hostname = window.location.hostname;

  // ── Mondial Assistance (vianet.webmondial.com.br) ──────────────────────────
  if (hostname === 'vianet.webmondial.com.br') {

    const norm = function(s) {
      return (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim().replace(/:$/, '').toLowerCase();
    };
    const cleanVal = function(s) {
      return (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
    };

    // Seletor para inputs VISÍVEIS (exclui hidden/button/checkbox/radio)
    const VISIBLE_INPUT = 'input[type="text"], input[type="number"], input[type="email"], input:not([type]), textarea';

    // Extrai valor de um elemento: select -> option.text, input visível -> value, else textContent
    const getElemVal = function(el) {
      const sel = el.querySelector('select');
      if (sel && sel.options && sel.options.length > 0) {
        const opt = sel.options[sel.selectedIndex];
        return (opt ? cleanVal(opt.text) : '') || cleanVal(sel.value || '');
      }
      const inp = el.querySelector(VISIBLE_INPUT);
      if (inp) return cleanVal(inp.value || inp.defaultValue || inp.getAttribute('value') || '');
      return cleanVal(el.textContent || '');
    };

    // Célula parece ser label se termina com ':' E não tem input visível
    const isLabelLike = function(el) {
      const hasVisible = !!el.querySelector(VISIBLE_INPUT + ', select');
      if (hasVisible) return false;  // tem campo real — não é apenas label
      return cleanVal(el.textContent || '').endsWith(':');
    };

    // Busca valor pelo label — percorre todas as ocorrências na página
    const getCell = function(label) {
      const nl = norm(label);
      const inlineRE = new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[:\\s]+', 'i');

      for (const cell of document.querySelectorAll('td, th')) {
        const rawCellText = cleanVal(cell.textContent);
        const nc = norm(cell.textContent);

        // Inline: label + valor na mesma célula (ex: "Assistência: 52032799 Solicitação: 1")
        if (nc !== nl && inlineRE.test(rawCellText)) {
          // Tenta via textContent (para valores em texto)
          let inlineVal = cleanVal(rawCellText.replace(inlineRE, '')).replace(/\s+\S+\s*:.*$/, '').trim();
          if (inlineVal && !inlineVal.endsWith(':')) return inlineVal;
          // Tenta via input dentro da célula (para valores em inputs)
          const firstInp = cell.querySelector(VISIBLE_INPUT);
          if (firstInp) {
            const v = cleanVal(firstInp.value || firstInp.defaultValue || firstInp.getAttribute('value') || '');
            if (v) return v;
          }
        }

        if (nc !== nl) continue;

        // Percorre siblings: usa VISIBLE_INPUT/select para distinguir valor de label oculto
        let sib = cell.nextElementSibling;
        while (sib) {
          const hasVisible = !!sib.querySelector(VISIBLE_INPUT + ', select');
          if (hasVisible) {
            const v = getElemVal(sib);
            if (v) return v;   // valor real encontrado
            // campo visível mas vazio (outra seção) — continua
          } else if (isLabelLike(sib)) {
            break;             // próximo label sem campo — para
          } else {
            const v = getElemVal(sib);
            if (v) return v;
          }
          sib = sib.nextElementSibling;
        }
      }
      return '';
    };

    // Número de OS Mondial: via label "Assistência" ou padrão numérico isolado
    const getMondialOSNumber = function() {
      const fromCell = getCell('Assistência') || getCell('Assistencia');
      if (fromCell) return fromCell;
      for (const el of document.querySelectorAll('td, span, b, strong')) {
        if (el.children.length === 0) {
          const t = cleanVal(el.textContent);
          if (/^\d{6,}$/.test(t) || /^[A-Z]\d{6,}(\/\d+)?$/.test(t)) return t;
        }
      }
      return '';
    };

    // Retorna TODOS os valores de células não-label após um label (ex: "Serviço" → ["CONSERTO RESIDENCIAL", "AR-CONDICIONADO"])
    const getCellMulti = function(label) {
      const nl = norm(label);
      const values = [];
      for (const cell of document.querySelectorAll('td, th')) {
        if (norm(cell.textContent) !== nl) continue;
        let sib = cell.nextElementSibling;
        while (sib && values.length < 4) {
          if (isLabelLike(sib)) break;
          const v = getElemVal(sib);
          // Para se parece com "Palavra: valor" embutido (outro label inline)
          if (v && v.length > 1 && !/^\w+:\s/.test(v)) values.push(v);
          else if (v && /^\w+:\s/.test(v)) break;
          sib = sib.nextElementSibling;
        }
        if (values.length) break;
      }
      return values.join(' / ');
    };

    const produtoRaw    = getCell('Produto');
    const servicoRaw    = getCellMulti('Serviço') || getCellMulti('Servico') || getCell('Serviço') || getCell('Servico');
    const localRaw      = getCell('Local');
    const importanteRaw = getCell('Importante');
    const assistencia   = getMondialOSNumber();
    const cidadeRaw     = getCell('Cidade');
    const bairroRaw     = getCell('Bairro');
    const nomeRaw       = getCell('Segurado');

    const segParts   = (produtoRaw || '').split(' - ');
    const seguradora = segParts.length >= 2 ? segParts[1].trim() : 'Allianz';

    const lastComma = localRaw.lastIndexOf(', ');
    const endereco  = lastComma > 0 ? localRaw.slice(0, lastComma).trim() : localRaw;
    const numero    = lastComma > 0 ? localRaw.slice(lastComma + 2).trim() : '';

    // Telefone: busca "TEL: XXXXXXXXXX" primeiro, depois regex flexível (sem exigir código do país)
    let tel = '';
    const telDirectMatch = importanteRaw.match(/TEL[:\s]+(\d{10,11})/i);
    if (telDirectMatch) {
      tel = telDirectMatch[1];
    } else {
      const telMatch = importanteRaw.match(/(\+?55\s*)?[\(]?\d{2}[\)]?\s*9?\d{4}[-\s]?\d{4}/);
      tel = telMatch ? telMatch[0].replace(/\D/g, '') : '';
    }
    if (tel.length === 13 && tel.startsWith('55')) tel = tel.slice(2);
    if (tel.length === 12 && tel.startsWith('55')) tel = tel.slice(2);

    // Data e horário: busca "agendada entre DD/MM/YYYY HH:MM e DD/MM/YYYY HH:MM" no banner
    let dataAgendamento = '', hora_chegada = '', hora_saida = '';
    for (const el of document.querySelectorAll('strong, b, td, div, p, span')) {
      const t = cleanVal(el.textContent || '');
      const mH = t.match(/entre\s+\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2})\s+e\s+\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2})/i);
      if (mH) { hora_chegada = mH[1]; hora_saida = mH[2]; }
      if (!dataAgendamento) {
        const mD = t.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (mD) dataAgendamento = mD[1];
      }
      if (dataAgendamento && hora_chegada) break;
    }

    const d = {
      seguradora,
      nome_segurado: nomeRaw,
      tel_segurado:  tel,
      endereco,
      numero,
      bairro:        bairroRaw,
      cidade:        cidadeRaw,
      cep:           (getCell('CEP') || '').replace(/\D/g, ''),
      tipo_sinistro: servicoRaw,
      descricao:     getCell('Problema') || getCell('Referências') || getCell('Referencia'),
      numero_os:     assistencia,
      data_chegada:  dataAgendamento,
      hora_chegada,
      hora_saida
    };

    if (!d.nome_segurado && !d.endereco)
      return { success: false, error: 'Dados não encontrados. Verifique se a solicitação está aberta.' };
    return { success: true, data: d };
  }
  // ── Portal Juvo / Tempo Assist (novo-portal-prestador.prd.tempoassist.cloud) ──
  if (hostname === 'novo-portal-prestador.prd.tempoassist.cloud') {
    try {

    // Busca valor pelo label semântico (span.label → span.text-content adjacente)
    const getLabelVal = function(label) {
      for (const el of document.querySelectorAll('span.label')) {
        const text = el.textContent.trim().replace(/:$/, '').trim();
        if (text === label) {
          // Tenta sibling direto
          let sib = el.nextElementSibling;
          while (sib) {
            if (sib.classList && sib.classList.contains('text-content')) return sib.textContent.trim();
            if (sib.classList && sib.classList.contains('label')) break;
            sib = sib.nextElementSibling;
          }
          // Tenta container pai → próximo container
          const parentSib = el.parentElement && el.parentElement.nextElementSibling;
          if (parentSib) {
            const tc = parentSib.querySelector('.text-content');
            if (tc) return tc.textContent.trim();
          }
        }
      }
      return '';
    };

    // Tipo de serviço: prefere o painel de detalhes (label semântico), fallback para card da lista
    let tipo_sinistro = getLabelVal('Nome da cobertura') || getLabelVal('Serviço') || getLabelVal('Tipo de Serviço') || '';
    if (!tipo_sinistro) {
      // Fallback: primeiro card do número de OS atual
      const osNum = getLabelVal('Assistência');
      for (const sp of document.querySelectorAll('span')) {
        if (!sp.children.length) {
          const t = sp.textContent.trim();
          // Só aceita se o texto contém o número de OS atual
          if (osNum && t.startsWith(osNum.split('/')[0])) {
            const m = t.match(/[\d./]+ - ([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÈ\s]+) - \d{5,}/);
            if (m) { tipo_sinistro = m[1].trim(); break; }
          }
        }
      }
    }

    // Endereço: dois formatos possíveis:
    // 5 partes: "17505460 - MARILIA - SP - RUA GUIZARDI220 - JARDIM PEROLA" (nº embutido na rua)
    // 6 partes: "17501300 - MARILIA - SP - RUA DONA JULIA NOMURA - 181 - BAIRRO FRAGATA" (nº separado)
    let cep = '', cidade = '', endereco = '', numero = '', bairro = '';
    for (const sp of document.querySelectorAll('span.text-content')) {
      const t = sp.textContent.trim();
      if (/^\d{8}\s*-/.test(t)) {
        const parts = t.split(/\s*-\s*/);
        cep    = (parts[0] || '').replace(/\D/g, '');
        cidade = (parts[1] || '').trim();
        // parts[2] = estado, parts[3] = rua (com ou sem número embutido)
        const endRaw = (parts[3] || '').trim();
        const em = endRaw.match(/^(.*?)(\d+)(.*)$/);
        if (em) {
          // Número embutido na string da rua (ex: "RUA GUIZARDI220")
          endereco = em[1].trim();
          numero   = em[2] !== '0' ? em[2] : '';
          bairro   = (parts[4] || '').trim();
        } else {
          // Número em campo separado (ex: parts[4]="181", parts[5]="BAIRRO FRAGATA")
          endereco = endRaw;
          const candidato = (parts[4] || '').trim();
          if (/^\d+$/.test(candidato) && candidato !== '0') {
            numero = candidato;
            bairro = (parts[5] || '').trim();
          } else {
            numero = '';
            bairro = candidato;
          }
        }
        break;
      }
    }

    // Data e horário: "Previsão início" → "11/05/2026, 16:00:00" / "Previsão fim" → "11/05/2026, 19:59:00"
    const inicioRaw = getLabelVal('Previsão início') || getLabelVal('Data início') || getLabelVal('Agendado') || '';
    const fimRaw    = getLabelVal('Previsão fim')    || getLabelVal('Data fim')    || '';
    const dataMatch    = inicioRaw.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data_chegada = dataMatch ? dataMatch[1] : '';
    const horaInicioM  = inicioRaw.match(/(\d{2}:\d{2})/);
    const horaFimM     = fimRaw.match(/(\d{2}:\d{2})/);
    const hora_chegada = horaInicioM ? horaInicioM[1] : '';
    const hora_saida   = horaFimM   ? horaFimM[1]    : '';

    // Telefone: tenta múltiplos labels
    const tel_raw = getLabelVal('Telefone') || getLabelVal('Contato') || getLabelVal('Tel.') || getLabelVal('Telefone Segurado') || '';

    const d = {
      seguradora:    getLabelVal('Cliente'),
      nome_segurado: getLabelVal('Segurado'),
      tel_segurado:  tel_raw.replace(/\D/g, ''),
      endereco,
      numero,
      bairro,
      cidade,
      cep,
      tipo_sinistro,
      descricao:     '',
      numero_os:     getLabelVal('Assistência'),
      data_chegada,
      hora_chegada,
      hora_saida
    };

    if (!d.nome_segurado && !d.numero_os)
      return { success: false, error: 'Abra uma OS para capturar os dados.' };
    return { success: true, data: d };

    } catch (e) {
      return { success: false, error: 'Erro na extração (Juvo): ' + e.message };
    }
  }

  if (SELECTORS[hostname]) {
    const sel = SELECTORS[hostname];
    const d = {};
    for (const [campo, seletor] of Object.entries(sel)) {
      if (campo === 'seguradora') { d[campo] = seletor; continue; }
      const el = document.querySelector(seletor);
      d[campo] = el ? (el.value || el.textContent?.trim() || '') : '';
    }
    if (d.tel_segurado) d.tel_segurado = d.tel_segurado.replace(/\D/g, '');
    if (d.cep)          d.cep          = d.cep.replace(/\D/g, '');
    if (!d.nome_segurado && !d.endereco)
      return { success: false, error: 'Dados não encontrados. Verifique se a OS está aberta.' };
    return { success: true, data: d };
  }

  if (LABEL_MAP[hostname]) {
    const map = LABEL_MAP[hostname];
    const enderecoRaw = getByLabel(map.endereco);

    // Número: tenta label separado primeiro, depois extrai do split do endereço
    const numLbls = ['Número', 'Nº', 'N°', 'Numero', 'Número/Complemento'];
    let numero = '';
    for (const lbl of numLbls) {
      const v = getByLabel(lbl);
      if (v) { numero = v; break; }
    }

    // Split do endereço: "Rua X - Núm - Bairro - Cidade"
    const partes = enderecoRaw.split(/\s*-\s*/);
    if (!numero && /^\d/.test((partes[1] || '').trim())) {
      numero = partes[1].trim();
    }

    // Extrai data E horário do card "Agendamento" em uma única passagem
    let data_chegada = '', hora_chegada = '', hora_saida = '';
    for (const el of document.querySelectorAll('span,div,p,td,b,strong,h3,h4')) {
      if (el.textContent?.trim() === 'Agendamento' && el.children.length === 0) {
        const box = el.parentElement?.parentElement || el.parentElement;
        if (box) {
          const txt = box.textContent;
          const dm = txt.match(/(\d{2}\/\d{2}\/\d{4})/);
          if (dm) data_chegada = dm[1];
          const hm = txt.match(/(\d{1,2})h(\d{2})\s*[-–]\s*(\d{1,2})h(\d{2})/);
          if (hm) {
            hora_chegada = `${hm[1].padStart(2, '0')}:${hm[2]}`;
            hora_saida   = `${hm[3].padStart(2, '0')}:${hm[4]}`;
          }
          break;
        }
      }
    }
    // Fallback data: qualquer elemento folha com data
    if (!data_chegada) {
      for (const el of document.querySelectorAll('span,p,b,strong,td')) {
        if (el.children.length === 0) {
          const m = el.textContent?.trim().match(/(\d{2}\/\d{2}\/\d{4})/);
          if (m) { data_chegada = m[1]; break; }
        }
      }
    }

    const d = {
      seguradora:    map.seguradora,
      nome_segurado: getByLabel(map.nome_segurado),
      tel_segurado:  getByLabel(map.tel_segurado),
      endereco:      partes[0] || enderecoRaw,
      numero,
      bairro:        partes[2] || '',
      cidade:        partes[3] || '',
      cep:           '',
      tipo_sinistro: getByLabel(map.tipo_sinistro),
      descricao:     getByLabel(map.descricao),
      numero_os:     getByLabel(map.numero_os) || getOSCardText(/[A-Z]\d{6,}(\/\d+)?/),
      data_chegada,
      hora_chegada,
      hora_saida
    };
    if (d.tel_segurado) d.tel_segurado = d.tel_segurado.replace(/\D/g, '');
    if (!d.nome_segurado && !d.endereco)
      return { success: false, error: 'Dados não encontrados. Verifique se a OS está aberta.' };
    return { success: true, data: d };
  }

  return { success: false, error: `Portal não suportado (${hostname}). Compatível com: Tempo, Maxpar, Allianz.` };
}

function formatarTelefone(n) {
  if (!n) return '';
  const c = n.replace(/\D/g, '');
  if (c.length === 11) return `(${c.slice(0,2)}) ${c.slice(2,7)}-${c.slice(7)}`;
  if (c.length === 10) return `(${c.slice(0,2)}) ${c.slice(2,6)}-${c.slice(6)}`;
  return n;
}

function formatarCep(c) {
  if (!c) return '';
  const d = c.replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0,5)}-${d.slice(5)}` : c;
}
