/**
 * Polinômios com coeficientes reais, guardados do grau 0 para cima: [c0, c1, c2…] = c0 + c1·x + c2·x² + …
 * Servem à fatoração dos limites (Aula 2: dividir por x − a, como no dispositivo de
 * Briot-Ruffini) e às regras de grau no infinito (quadro 6).
 */
import { avaliar, contem, mul, neg, num, pot, soma, variavel } from './expressao';
import type { Expr } from './expressao';
import { simplificar } from './simplificar';

export type Polinomio = number[];

const QUASE = 1e-9;

/** Arredonda coeficientes que são inteiros por erro de ponto flutuante e tira os zeros do topo. */
function limpar(p: Polinomio): Polinomio {
  const q = p.map((c) => (Math.abs(c - Math.round(c)) < QUASE ? Math.round(c) + 0 : c));
  while (q.length > 1 && Math.abs(q[q.length - 1]!) < QUASE) q.pop();
  return q.length === 0 ? [0] : q;
}

const somar = (p: Polinomio, q: Polinomio): Polinomio =>
  limpar(Array.from({ length: Math.max(p.length, q.length) }, (_, i) => (p[i] ?? 0) + (q[i] ?? 0)));

const escalar = (p: Polinomio, k: number): Polinomio => limpar(p.map((c) => c * k));

function multiplicar(p: Polinomio, q: Polinomio): Polinomio {
  const r: number[] = new Array(p.length + q.length - 1).fill(0);
  p.forEach((a, i) => q.forEach((b, j) => (r[i + j] = r[i + j]! + a * b)));
  return limpar(r);
}

/** O polinômio que a expressão representa, ou null se ela não for polinômio em x. */
export function comoPolinomio(e: Expr, x: string): Polinomio | null {
  if (!contem(e, x)) {
    const k = avaliar(e);
    return Number.isFinite(k) ? [k] : null;
  }
  switch (e.tipo) {
    case 'var':
      return e.nome === x ? [0, 1] : null;
    case 'soma':
    case 'sub': {
      const a = comoPolinomio(e.a, x);
      const b = comoPolinomio(e.b, x);
      return a && b ? somar(a, e.tipo === 'soma' ? b : escalar(b, -1)) : null;
    }
    case 'neg': {
      const a = comoPolinomio(e.a, x);
      return a ? escalar(a, -1) : null;
    }
    case 'mul': {
      const a = comoPolinomio(e.a, x);
      const b = comoPolinomio(e.b, x);
      return a && b ? multiplicar(a, b) : null;
    }
    case 'div': {
      const a = comoPolinomio(e.a, x);
      if (!a || contem(e.b, x)) return null;
      const k = avaliar(e.b);
      return Number.isFinite(k) && k !== 0 ? escalar(a, 1 / k) : null;
    }
    case 'pot': {
      if (contem(e.exp, x)) return null;
      const n = avaliar(e.exp);
      const base = comoPolinomio(e.base, x);
      if (!base || !Number.isInteger(n) || n < 0 || n > 40) return null;
      let r: Polinomio = [1];
      for (let i = 0; i < n; i++) r = multiplicar(r, base);
      return r;
    }
    default:
      return null;
  }
}

export const grau = (p: Polinomio): number => limpar(p).length - 1;

/** Coeficiente do termo de maior grau. */
export const lider = (p: Polinomio): number => {
  const q = limpar(p);
  return q[q.length - 1]!;
};

/** Valor do polinômio em t (Horner). */
export const valorEm = (p: Polinomio, t: number): number => p.reduceRight((acc, c) => acc * t + c, 0);

/** O polinômio vale zero em t? A tolerância acompanha o tamanho dos coeficientes e de t. */
export function zeraEm(p: Polinomio, t: number): boolean {
  const escala = p.reduce((m, c, i) => Math.max(m, Math.abs(c) * Math.abs(t) ** i), 1);
  return Math.abs(valorEm(p, t)) < 1e-9 * escala;
}

/** Quociente de p por (x − r), pelo dispositivo de Briot-Ruffini; supõe que r é raiz de p. */
export function dividirPorRaiz(p: Polinomio, r: number): Polinomio {
  const n = p.length - 1;
  const q: number[] = new Array(Math.max(n, 1)).fill(0);
  let acumulado = 0;
  for (let i = n; i >= 1; i--) {
    acumulado = p[i]! + acumulado * r;
    q[i - 1] = acumulado;
  }
  return limpar(q);
}

/** O polinômio como expressão, do maior grau para o menor: x^2 - 3*x + 2. */
export function paraExpr(p: Polinomio, x: string): Expr {
  const q = limpar(p);
  const termos: Expr[] = [];
  for (let i = q.length - 1; i >= 0; i--) {
    const c = q[i]!;
    if (c === 0) continue;
    const potencia = i === 0 ? null : i === 1 ? variavel(x) : pot(variavel(x), num(i));
    if (!potencia) termos.push(num(c));
    else termos.push(c === 1 ? potencia : c === -1 ? neg(potencia) : mul(num(c), potencia));
  }
  if (termos.length === 0) return num(0);
  return simplificar(termos.reduce((acc, t) => soma(acc, t)));
}
