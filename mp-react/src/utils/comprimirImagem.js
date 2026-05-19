// ============================================================
// comprimirImagem.js — Compressão client-side via Canvas API
// Reduz fotos de câmera (1-5 MB) para ≤ 1 MB antes do upload.
// Mantém proporção, max 1920px em qualquer dimensão.
// ============================================================

const MAX_DIM  = 1920;         // px máximo em qualquer lado
const MAX_BYTES = 1 * 1024 * 1024; // 1 MB alvo após compressão

/**
 * Comprime uma imagem usando Canvas e retorna um novo File.
 * Reduz qualidade JPEG progressivamente até atingir ≤ MAX_BYTES.
 *
 * @param {File} file  arquivo original validado
 * @returns {Promise<File>}  arquivo comprimido (sempre JPEG)
 */
export function comprimirImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Redimensiona mantendo proporção
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w >= h) { h = Math.round((h / w) * MAX_DIM); w = MAX_DIM; }
        else         { w = Math.round((w / h) * MAX_DIM); h = MAX_DIM; }
      }

      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      // Reduz qualidade até atingir o limite
      let quality = 0.85;
      const nome  = file.name.replace(/\.[^.]+$/, '') + '.jpg';

      const tentar = () => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Falha ao comprimir imagem.')); return; }

          if (blob.size <= MAX_BYTES || quality <= 0.25) {
            resolve(new File([blob], nome, { type: 'image/jpeg', lastModified: Date.now() }));
          } else {
            quality = Math.round((quality - 0.1) * 100) / 100;
            tentar();
          }
        }, 'image/jpeg', quality);
      };

      tentar();
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível carregar a imagem.')); };
    img.src = url;
  });
}
