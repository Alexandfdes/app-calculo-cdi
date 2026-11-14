/**
 * Conferência em massa: o motor integra centenas de expressões geradas ao acaso, todas dentro
 * das regras do projeto, e cada primitiva passa pela conferência dos casos dos slides: a
 * derivada (do math.js) volta ao integrando, e a primitiva existe onde o integrando existe.
 * A semente é fixa, então as mesmas expressões são geradas em toda execução.
 */
import { describe, expect, it } from 'vitest';
import { paraTexto } from '../src/motor/expressao';
import { integrar } from '../src/motor/integrais';
import { validaIntegral } from './oraculo';

/** Gerador pseudoaleatório com semente (mulberry32), o mesmo da conferência das derivadas. */
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

/** g(x) e g'(x) para os integrandos do tipo f(g(x))·g'(x), como no exemplo do quadro 5. */
const INTERNAS = [
  { g: 'x^2', dg: '2*x' },
  { g: 'x^3', dg: '3*x^2' },
  { g: 'x^2 + 1', dg: '2*x' },
  { g: 'sen(x)', dg: 'cos(x)' },
];

function termoAleatorio(sorteio: () => number): string {
  const escolher = <T>(opcoes: T[]): T => opcoes[Math.floor(sorteio() * opcoes.length)]!;
  const linear = `${escolher(['1', '2', '3', '-2'])}*x + ${escolher(['0', '1', '-3'])}`;
  const { g, dg } = escolher(INTERNAS);
  const forma = escolher([
    () => `x^${escolher([0, 1, 2, 3, 4])}`,
    () => `sen(${linear})`,
    () => `cos(${linear})`,
    () => `e^(${linear})`,
    () => `2^(${linear})`,
    () => `(${linear})^${escolher([2, 3])}`,
    () => `${dg}*cos(${g})`,
    () => `${dg}*e^(${g})`,
    () => `${dg}*(${g})^3`,
    () => `${dg}/(${g})`,
  ])();
  return `${escolher(['1', '2', '-3', '5'])}*(${forma})`;
}

describe('Conferência em massa com o math.js', () => {
  const sorteio = gerador(2026);
  const integrandos = Array.from({ length: 300 }, () =>
    Array.from({ length: 1 + Math.floor(sorteio() * 3) }, () => termoAleatorio(sorteio)).join(' + '),
  );

  // ~3 s sozinho; com a suíte inteira rodando em paralelo, os 5 s padrão às vezes não bastam
  it('300 integrandos aleatórios: a primitiva do motor passa na conferência do oráculo', { timeout: 20_000 }, () => {
    const divergentes = integrandos.filter((f) => {
      const esperado = paraTexto(integrar(f).resultado);
      return !validaIntegral({ id: '', fonte: '', f, esperado, regras: [], dominio: [-2, 2] });
    });
    expect(divergentes).toEqual([]);
  });
});
