// Mapeamento de seletores CSS por portal de seguradora.
// Atualizar quando os portais mudarem o DOM.
export const PORTAL_SELECTORS = {
  'portal.tempoassist.com.br': {
    nome_segurado: '[data-field="nome"]',
    tel_segurado: '[data-field="telefone"]',
    endereco: '[data-field="endereco"]',
    numero: '[data-field="numero"]',
    cidade: '[data-field="cidade"]',
    bairro: '[data-field="bairro"]',
    cep: '[data-field="cep"]',
    tipo_sinistro: '[data-field="tipo_sinistro"]',
    descricao: '[data-field="descricao"]',
    numero_os: '[data-field="numero_os"]',
    seguradora: 'Tempo'
  },
  'sistemas.maxpar.com.br': {
    nome_segurado: '#txtNomeSegurado',
    tel_segurado: '#txtTelSegurado',
    endereco: '#txtEndereco',
    numero: '#txtNumero',
    cidade: '#txtCidade',
    bairro: '#txtBairro',
    cep: '#txtCep',
    tipo_sinistro: '#ddlTipoSinistro',
    descricao: '#txtDescricao',
    numero_os: '#lblNumeroOS',
    seguradora: 'Maxpar'
  },
  'portal.allianz.com.br': {
    nome_segurado: '.field-nome input',
    tel_segurado: '.field-telefone input',
    endereco: '.field-endereco input',
    numero: '.field-numero input',
    cidade: '.field-cidade input',
    bairro: '.field-bairro input',
    cep: '.field-cep input',
    tipo_sinistro: '.field-tipo select',
    descricao: '.field-descricao textarea',
    numero_os: '.os-number',
    seguradora: 'Allianz'
  }
};
