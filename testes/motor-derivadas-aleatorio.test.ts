/**
 * Conferência em massa: o motor deriva centenas de expressões geradas ao acaso e cada
 * resultado é comparado com a derivada do math.js (o oráculo). A semente é fixa, então
 * as mesmas expressões são geradas em toda execução.
 *
 * As expressões só usam formas definidas em todo o intervalo [−2, 2] (denominadores e
 * argumentos de ln e raiz do tipo 1 + u²), para a comparação não depender de domínio.
 */
import { describe, expect, it } from 'vitest';
import { derivar } from '../src/motor/derivadas';
import { paraTexto } from '../src/motor/expressao';
import { derivadaOraculo, equivalentes } from './oraculo';

/** Gerador pseudoaleatório com semente (mulberry32). */
function gerador(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expressaoAleatoria(sorteio: () => number, profundidade: number): string {
  const escolher = <T>(opcoes: T[]): T => opcoes[Math.floor(sorteio() * opcoes.length)]!;
  if (profundidade === 0) return escolher(['x', 'x', String(1 + Math.floor(sorteio() * 5))]);
  const u = () => expressaoAleatoria(sorteio, profundidade - 1);
  const raso = () => expressaoAleatoria(sorteio, Math.min(1, profundidade - 1));
  return escolher([
    () => `(${u()}) + (${u()})`,
    () => `(${u()}) - (${u()})`,
    () => `(${u()})*(${u()})`,
    () => `(${u()})/(1 + (${u()})^2)`,
    () => `(${u()})^${escolher([2, 3])}`,
    () => `sen(${u()})`,
    () => `cos(${u()})`,
    () => `e^(${raso()})`,
    () => `ln(1 + (${u()})^2)`,
    () => `sqrt(1 + (${u()})^2)`,
  ])();
}

describe('Conferência em massa com o math.js', () => {
  const sorteio = gerador(2026);
  const expressoes = Array.from({ length: 300 }, () => expressaoAleatoria(sorteio, 1 + Math.floor(sorteio() * 3)));

  it('300 expressões aleatórias: a derivada do motor é equivalente à do oráculo', () => {
    const divergentes = expressoes.filter(
      (f) => !equivalentes(paraTexto(derivar(f).resultado), derivadaOraculo(f), [-2, 2]),
    );
    expect(divergentes).toEqual([]);
  });
});
