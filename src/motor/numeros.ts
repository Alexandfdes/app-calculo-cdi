/** Números para mostrar ao aluno, do jeito que ele escreveria no caderno. */

const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));
const quadradoPerfeito = (n: number): boolean => Number.isInteger(Math.sqrt(n));

/**
 * Inteiros, frações simples (1/2, 3/2), múltiplos simples de π, raízes (sqrt(3)/2, 2*sqrt(3))
 * e o número e por extenso; o resto com 4 casas. Sai na escrita do leitor (pi, sqrt, *):
 * para mostrar numa frase, use numeroParaLer.
 */
export function numeroBonito(valor: number): string {
  const inteiro = Math.round(valor);
  if (Math.abs(valor - inteiro) < 1e-9) return String(inteiro === 0 ? 0 : inteiro);
  for (let q = 2; q <= 12; q++) {
    const p = Math.round(valor * q);
    if (Math.abs(valor * q - p) < 1e-9 * q) return `${p}/${q}`;
  }
  // π antes das raízes: ângulos (π/6, 3π/4) nunca devem virar raiz por acaso
  for (const q of [1, 2, 3, 4, 6, 8, 9, 12]) {
    const p = Math.round((valor * q) / Math.PI);
    if (p !== 0 && Math.abs((valor * q) / Math.PI - p) < 1e-9) {
      const multiplo = p === 1 ? 'pi' : p === -1 ? '-pi' : `${p}*pi`;
      return q === 1 ? multiplo : `${multiplo}/${q}`;
    }
  }
  // m·√r/q: o quadrado do número é m²·r/q²
  const quadrado = valor * valor;
  for (const q of [1, 2, 3, 4, 6, 9]) {
    const p = quadrado * q * q;
    const inteiroP = Math.round(p);
    if (inteiroP > 1 && Math.abs(p - inteiroP) < 1e-8 * Math.max(1, p) && !quadradoPerfeito(inteiroP)) {
      let [m, r] = [1, inteiroP];
      for (let fator = 2; fator * fator <= r; fator++) {
        while (r % (fator * fator) === 0) {
          r /= fator * fator;
          m *= fator;
        }
      }
      const g = mdc(m, q);
      const [mm, qq] = [m / g, q / g];
      return `${valor < 0 ? '-' : ''}${mm === 1 ? '' : `${mm}*`}sqrt(${r})${qq === 1 ? '' : `/${qq}`}`;
    }
  }
  if (Math.abs(valor - Math.E) < 1e-12) return 'e';
  return String(Number(valor.toFixed(4)));
}

/** A escrita do leitor do jeito que se lê: π no lugar de pi, √ no lugar de sqrt, sem o *, com o sinal de menos. */
export const paraLer = (texto: string): string =>
  texto
    .replace(/sqrt\((\d+)\)/g, '√$1')
    .replace(/\*/g, '')
    .replace(/pi/g, 'π')
    .replace(/-/g, '−');

/** O número pronto para uma frase: 1/2, √3/2, 2π/3, −1. */
export const numeroParaLer = (valor: number): string => paraLer(numeroBonito(valor));
