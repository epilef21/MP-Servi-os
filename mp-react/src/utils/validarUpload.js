// ============================================================
// validarUpload.js — Sanitização de arquivos antes do upload
// Valida tipo MIME e magic numbers. O tamanho não é bloqueado
// aqui pois comprimirImagem.js reduz para ≤ 1 MB antes do upload.
// ============================================================

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANHO_MAX_ORIGINAL = 15 * 1024 * 1024; // 15 MB — rejeita arquivos absurdos antes da compressão

// Magic numbers dos formatos aceitos
const MAGIC = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png':  [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // "RIFF"
};

function lerPrimeirosBytes(file, n = 12) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(new Uint8Array(e.target.result));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file.slice(0, n));
  });
}

function verificarMagic(bytes, tipo) {
  return (MAGIC[tipo] || []).some((seq) => seq.every((b, i) => bytes[i] === b));
}

/**
 * Valida tipo e integridade do arquivo.
 * Lança Error descritivo se falhar.
 * A compressão de tamanho é feita DEPOIS por comprimirImagem().
 */
export async function validarUpload(file) {
  if (!file) throw new Error('Nenhum arquivo selecionado.');

  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    throw new Error(`Tipo não permitido: "${file.type}". Use JPEG, PNG ou WebP.`);
  }

  if (file.size > TAMANHO_MAX_ORIGINAL) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`Arquivo muito grande: ${mb} MB. O limite é 15 MB.`);
  }

  const bytes = await lerPrimeirosBytes(file);
  if (!verificarMagic(bytes, file.type)) {
    throw new Error('Arquivo inválido: o conteúdo não corresponde ao tipo declarado.');
  }
}
