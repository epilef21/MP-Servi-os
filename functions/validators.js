// ============================================================
// validators.js — Schemas Zod para Cloud Functions
// Todos os dados vindos do cliente passam por aqui antes de
// tocar o Firestore. Campos financeiros NUNCA são aceitos
// do frontend — são sempre zerados pelo servidor.
// ============================================================
const { z }          = require('zod');
const { HttpsError } = require('firebase-functions/v2/https');

// Seguradoras cadastradas no sistema
const SEGURADORAS = ['Mapfre', 'Tempo', 'Maxpar', 'Allianz', 'Mondial', 'Outra'];

// ── Schema para criação/importação de OS ────────────────────
const OSSchema = z.object({
  nome_segurado: z.string().min(2).max(120),
  tel_segurado:  z.string().max(20).optional().default(''),
  endereco:      z.string().min(3).max(200),
  numero:        z.string().max(20).optional().default(''),
  bairro:        z.string().max(80).optional().default(''),
  cidade:        z.string().max(80).optional().default(''),
  cep:           z.string().max(9).optional().default(''),
  tipo_sinistro: z.string().max(80).optional().default(''),
  descricao:     z.string().max(2000).optional().default(''),
  seguradora:    z.enum(SEGURADORAS).optional(),
  numero_os:     z.string().max(50).optional().default(''),
  empresaSlug:   z.string().min(1).max(80),
  origem:        z.string().max(40).optional().default('chrome_extension'),
  data_chegada:  z.string().max(10).optional().default(''),
  hora_chegada:  z.string().max(5).optional().default(''),
  hora_saida:    z.string().max(5).optional().default(''),
}).strict();

// Campos financeiros jamais aceitos do cliente
const CAMPOS_FINANCEIROS = [
  'maoDeObraSeguradora',
  'valorPagoTecnico',
  'kmDeslocamento',
  'lucroReal',
  'mo_seguradora',
  'valor_prestador',
  'valor_deslocamento',
];

/**
 * Valida o body de criação de OS.
 * Lança HttpsError 'invalid-argument' com detalhes se falhar.
 *
 * @param {object} body  dados brutos do request
 * @returns {object}     dados validados e limpos
 */
function validateOS(body) {
  // Rejeita qualquer campo financeiro vindo do cliente
  for (const campo of CAMPOS_FINANCEIROS) {
    if (campo in body) {
      throw new HttpsError(
        'invalid-argument',
        `Campo não permitido: "${campo}". Dados financeiros não podem ser enviados pelo cliente.`
      );
    }
  }

  const result = OSSchema.safeParse(body);
  if (!result.success) {
    const first = result.error.errors[0];
    throw new HttpsError(
      'invalid-argument',
      `Dados inválidos: ${first.path.join('.')} — ${first.message}`
    );
  }

  return result.data;
}

module.exports = { validateOS, OSSchema, SEGURADORAS };
