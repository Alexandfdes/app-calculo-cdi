/**
 * Oráculo independente: confere os casos de teste com o math.js, sem usar o motor do app.
 * Prova que cada valor esperado está certo, e que os valores errados dos slides não passam.
 *
 * Atenção: o oráculo de limites é numérico e foi calibrado só para estes casos.
 * Não é um motor de limites geral e não deve virar o motor do app.
 */
import { compile, derivative, evaluate } from 'mathjs';
import type { EvalFunction } from 'mathjs';
import type {
  CasoAngulo,
  CasoDerivada,
  CasoIntegral,
  CasoIntegralDefinida,
  CasoLimite,
  CasoQuadratica,
  CasoValidade,
  Descontinuidade,
  Intervalo,
  ValorLimite,
} from './casos-dos-slides';

/** O evaluate do math.js, exportado para os testes de armadilhas. */
export { evaluate };

/** Notação da aula → math.js. Atenção: no math.js (e no Math do JS), log(x) é o logaritmo NATURAL. */
export function paraMathjs(expr: string): string {
  return expr
    .replace(/\bsen\b/g, 'sin')
    .replace(/\btg\b/g, 'tan')
    .replace(/\bcotg\b/g, 'cot')
    .replace(/\bln\b/g, 'log');
}

const compiladas = new Map<string, EvalFunction>();

/** Valor de expr em x, ou null quando não é um número real finito (fora do domínio). */
export function avaliar(expr: string, x = 0): number | null {
  let fn = compiladas.get(expr);
  if (!fn) {
    fn = compile(paraMathjs(expr));
    compiladas.set(expr, fn);
  }
  try {
    const v: unknown = fn.evaluate({ x });
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** Valor de uma constante escrita como expressão, por exemplo 'sqrt(3)/2' ou 'pi/6'. */
function valor(expr: string): number {
  const v = avaliar(expr);
  if (v === null) throw new Error(`"${expr}" não é um número real`);
  return v;
}

function perto(a: number, b: number, tol = 1e-12): boolean {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Pontos bem espalhados e "irregulares" em (a, b), para não cair só em valores notáveis. */
export function amostras([a, b]: Intervalo, n = 30): number[] {
  const fi = 0.6180339887498949; // sequência de baixa discrepância (razão áurea)
  return Array.from({ length: n }, (_, i) => a + (b - a) * (((i + 1) * fi) % 1));
}

/**
 * f e g são equivalentes se coincidem em pelo menos `minimo` pontos do domínio.
 * Pontos fora do domínio de uma delas são ignorados; o mínimo existe para que um domínio
 * mal escolhido não faça o teste passar sem comparar nada.
 */
export function equivalentes(f: string, g: string, dominio: Intervalo = [-3, 3], minimo = 10): boolean {
  let comparados = 0;
  for (const x of amostras(dominio)) {
    const a = avaliar(f, x);
    const b = avaliar(g, x);
    if (a === null || b === null) continue;
    if (!perto(a, b, 1e-8)) return false;
    comparados++;
  }
  return comparados >= minimo;
}

/** Derivada simbólica do math.js. Usada só como oráculo, nunca como o motor do app. */
export function derivadaOraculo(expr: string): string {
  return derivative(paraMathjs(expr), 'x').toString();
}

/** Regra de Simpson composta, para conferir integrais definidas. */
export function simpson(f: string, a: number, b: number, n = 2000): number {
  const h = (b - a) / n;
  let soma = 0;
  for (let i = 0; i <= n; i++) {
    const y = avaliar(f, a + i * h);
    if (y === null) throw new Error(`integrando sem valor real em x = ${a + i * h}`);
    soma += y * (i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2);
  }
  return (soma * h) / 3;
}

// ─── Validadores: cada um devolve true se o caso estiver matematicamente certo ───

export function validaQuadratica(q: CasoQuadratica): boolean {
  const { a, b, c } = q;
  const f = (x: number) => a * x * x + b * x + c;
  const delta = b * b - 4 * a * c;
  if (!perto(delta, q.delta)) return false;
  if (q.raizes.length !== (delta > 0 ? 2 : delta === 0 ? 1 : 0)) return false;
  if (!q.raizes.every((r) => Math.abs(f(r)) < 1e-9)) return false;
  const xv = -b / (2 * a);
  const yv = f(xv);
  if (!perto(xv, q.vertice[0]) || !perto(yv, q.vertice[1])) return false;
  // O vértice é de fato o mínimo (a > 0) ou o máximo (a < 0)…
  const extremo = amostras([xv - 10, xv + 10]).every((x) => (a > 0 ? f(x) >= yv : f(x) <= yv));
  // …e a imagem é o intervalo que começa ou termina nele.
  const imagem = a > 0 ? `[${yv}, +∞)` : `(-∞, ${yv}]`;
  return extremo && imagem === q.imagem;
}

export function validaValidade(c: CasoValidade): boolean {
  if (c.porque === 'sem valor real') return amostras([0.1, 3]).some((x) => avaliar(c.f, x) === null);
  // Afim ou constante: f(x) = f(0) + m·x em todos os pontos, com m ≠ 0 (afim) ou m = 0 (constante)
  const f0 = avaliar(c.f, 0);
  const f1 = avaliar(c.f, 1);
  if (f0 === null || f1 === null) return false;
  const m = f1 - f0;
  const reta = amostras([-3, 3]).every((x) => {
    const y = avaliar(c.f, x);
    return y !== null && perto(y, f0 + m * x, 1e-9);
  });
  return reta && (c.porque === 'vira afim' ? m !== 0 : m === 0);
}

export function validaAngulo(c: CasoAngulo): boolean {
  const t = valor(c.rad);
  if (!perto(t, (c.graus * Math.PI) / 180)) return false;
  if (!perto(Math.cos(t), valor(c.cos)) || !perto(Math.sin(t), valor(c.sen))) return false;
  // tg indefinida ⇔ cos = 0. Testar Number.isFinite(Math.tan(t)) não serve: tan(π/2) dá ~1,6·10¹⁶.
  if (c.tg === 'indefinida') return Math.abs(Math.cos(t)) < 1e-12;
  return perto(Math.tan(t), valor(c.tg));
}

export const validaDerivada = (c: CasoDerivada): boolean => equivalentes(derivadaOraculo(c.f), c.esperado, c.dominio);

/**
 * Dica da Aula 4, "verifique o resultado derivando": F é primitiva de f se F' ≡ f.
 * Só derivar não basta: ln(x) tem derivada 1/x, mas não existe para x < 0, onde 1/x existe.
 * Por isso F também precisa existir em todo ponto onde f existe.
 */
export function validaIntegral(c: CasoIntegral): boolean {
  const mesmoDominio = amostras(c.dominio ?? [-3, 3]).every((x) => avaliar(c.f, x) === null || avaliar(c.esperado, x) !== null);
  return mesmoDominio && equivalentes(derivadaOraculo(c.esperado), c.f, c.dominio);
}

export const validaIntegralDefinida = (c: CasoIntegralDefinida): boolean =>
  typeof c.esperado === 'number' && perto(simpson(c.f, c.a, c.b), c.esperado, 1e-9);

// ─── Limites (numérico) ───

const ESCALAS = [1e-2, 1e-3, 1e-4, 1e-5]; // h menor que isso cai em erro de ponto flutuante

function cresceSemLimite(ys: number[]): boolean {
  const ultimo = ys[ys.length - 1]!;
  return Math.abs(ultimo) > 1e4 && ys.every((y, i) => i === 0 || Math.abs(y) > 5 * Math.abs(ys[i - 1]!));
}

/** Comportamento numérico de f quando x → a por um lado. */
export function lateral(f: string, a: number, lado: 'esquerda' | 'direita'): ValorLimite | null {
  const s = lado === 'direita' ? 1 : -1;
  const ys = ESCALAS.map((h) => avaliar(f, a + s * h));
  if (ys.some((y) => y === null)) return null;
  const v = ys as number[];
  if (cresceSemLimite(v)) return v[v.length - 1]! > 0 ? '+∞' : '-∞';
  // Oscila se, em todas as escalas, os valores ainda cobrem uma faixa larga
  const faixa = (h: number) => {
    const pts = amostras([h / 10, h], 50).map((t) => avaliar(f, a + s * t) ?? Number.NaN);
    return Math.max(...pts) - Math.min(...pts);
  };
  if ([1e-3, 1e-4, 1e-5].every((h) => faixa(h) > 1)) return 'oscila';
  return v[v.length - 1]!;
}

/** Comportamento numérico de f quando x → +∞ (sentido 1) ou x → −∞ (sentido −1). */
export function noInfinito(f: string, sentido: 1 | -1): ValorLimite | null {
  const ys = [1e2, 1e3, 1e4, 1e5, 1e6].map((x) => avaliar(f, sentido * x));
  if (ys.some((y) => y === null)) return null;
  const v = ys as number[];
  if (cresceSemLimite(v)) return v[v.length - 1]! > 0 ? '+∞' : '-∞';
  return v[v.length - 1]!;
}

function mesmo(a: ValorLimite | 'não existe', b: ValorLimite | 'não existe'): boolean {
  return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1e-3 : a === b;
}

/** Classificação da Aula 2, quadro 9; undefined quando f é contínua em a. */
function descontinuidade(f: string, a: number, esq: ValorLimite, dir: ValorLimite): Descontinuidade | undefined {
  if (esq === 'oscila' || dir === 'oscila') return 'essencial';
  if (typeof esq !== 'number' || typeof dir !== 'number') return 'infinita';
  if (!mesmo(esq, dir)) return 'salto';
  const fa = avaliar(f, a);
  return fa === null || !mesmo(fa, esq) ? 'removível' : undefined;
}

export function validaLimite(c: CasoLimite): boolean {
  if (!Number.isFinite(c.a)) {
    const v = noInfinito(c.f, c.a > 0 ? 1 : -1);
    return v !== null && mesmo(v, c.limite);
  }
  const esq = lateral(c.f, c.a, 'esquerda');
  const dir = lateral(c.f, c.a, 'direita');
  if (esq === null || dir === null) return false;
  if (c.esquerda !== undefined && !mesmo(esq, c.esquerda)) return false;
  if (c.direita !== undefined && !mesmo(dir, c.direita)) return false;
  const limite = esq !== 'oscila' && mesmo(esq, dir) ? esq : 'não existe';
  return mesmo(limite, c.limite) && descontinuidade(c.f, c.a, esq, dir) === c.descontinuidade;
}
