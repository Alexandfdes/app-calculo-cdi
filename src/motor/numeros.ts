/** Números para mostrar ao aluno, do jeito que ele escreveria no caderno. */

/** Inteiros, frações simples (1/2, 3/2), múltiplos simples de π e o número e por extenso; o resto com 4 casas. */
export function numeroBonito(valor: number): string {
  const inteiro = Math.round(valor);
  if (Math.abs(valor - inteiro) < 1e-9) return String(inteiro === 0 ? 0 : inteiro);
  for (let q = 2; q <= 12; q++) {
    const p = Math.round(valor * q);
    if (Math.abs(valor * q - p) < 1e-9 * q) return `${p}/${q}`;
  }
  for (const q of [1, 2, 3, 4, 6]) {
    const p = Math.round((valor * q) / Math.PI);
    if (p !== 0 && Math.abs((valor * q) / Math.PI - p) < 1e-9) {
      const multiplo = p === 1 ? 'pi' : p === -1 ? '-pi' : `${p}*pi`;
      return q === 1 ? multiplo : `${multiplo}/${q}`;
    }
  }
  if (Math.abs(valor - Math.E) < 1e-12) return 'e';
  return String(Number(valor.toFixed(4)));
}
