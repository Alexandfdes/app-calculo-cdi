/**
 * Testes dos casos tirados dos slides de CDI.     Rodar:  npm install  e depois  npm test
 *
 * Hoje estes testes conferem os CASOS com o oráculo do math.js: provam que cada valor esperado
 * está certo e que os valores errados dos slides seriam reprovados. Quando o motor do app
 * existir, rode os mesmos casos contra ele (modelo no fim do arquivo).
 */
import { describe, expect, it } from 'vitest';
import {
  REGRAS_DERIVACAO,
  REGRAS_INTEGRACAO,
  angulos,
  derivadas,
  integrais,
  integraisDefinidas,
  integraisForaDoEscopo,
  limites,
  quadraticas,
  validade,
} from './casos-dos-slides';
import {
  avaliar,
  evaluate,
  validaAngulo,
  validaDerivada,
  validaIntegral,
  validaIntegralDefinida,
  validaLimite,
  validaQuadratica,
  validaValidade,
} from './oraculo';

/** Número legível no nome do teste: 2, 3.1416, +∞. */
const num = (n: number) =>
  n === Infinity ? '+∞' : n === -Infinity ? '−∞' : Number.isInteger(n) ? String(n) : n.toFixed(4);

describe('Aula 1 — Funções', () => {
  for (const c of quadraticas) {
    it(`${c.id}: ${c.a}x² + (${c.b})x + (${c.c}) → vértice (${c.vertice.join(', ')}), imagem ${c.imagem}`, () =>
      expect(validaQuadratica(c)).toBe(true));
  }
  for (const c of validade) {
    it(`${c.id}: ${c.declarado} com ${c.f} → ${c.resposta}`, () => expect(validaValidade(c)).toBe(true));
  }
  for (const c of angulos) {
    it(`${c.id}: ${c.graus}° = ${c.rad}, ponto (${c.cos}, ${c.sen}), tg = ${c.tg}`, () =>
      expect(validaAngulo(c)).toBe(true));
  }
});

describe('Aula 2 — Limites', () => {
  for (const c of limites) {
    it(`${c.id}: ${c.f} com x → ${num(c.a)} → ${typeof c.limite === 'number' ? num(c.limite) : c.limite}`, () =>
      expect(validaLimite(c)).toBe(true));
  }
});

describe('Aula 3 — Derivadas', () => {
  for (const c of derivadas) {
    it(`${c.id}: (${c.f})' = ${c.esperado}`, () => expect(validaDerivada(c)).toBe(true));
  }
});

describe('Aula 4 — Integrais', () => {
  for (const c of [...integrais, ...integraisForaDoEscopo]) {
    it(`${c.id}: ∫ ${c.f} dx = ${c.esperado} + C`, () => expect(validaIntegral(c)).toBe(true));
  }
  for (const c of integraisDefinidas) {
    if (c.esperado === 'diverge') continue; // ID07 tem teste próprio, logo abaixo
    it(`${c.id}: ∫ de ${num(c.a)} a ${num(c.b)} de ${c.f} = ${c.esperado}`, () =>
      expect(validaIntegralDefinida(c)).toBe(true));
  }

  it('ID07: ∫ de −1 a 1 de 1/x² diverge, embora a conta ingênua F(1) − F(−1) dê −2', () => {
    const F = (x: number) => -1 / x;
    // F é primitiva de 1/x²…
    expect(validaIntegral({ id: 'ID07', fonte: '', f: '1/x^2', esperado: '-1/x', regras: [] })).toBe(true);
    // …mas 1/x² não é contínua em [−1, 1], então o TFC não se aplica. A conta ingênua erra até o sinal:
    expect(F(1) - F(-1)).toBe(-2);
    // Integral imprópria: ∫ de ε a 1 = F(1) − F(ε) = 1/ε − 1, que cresce sem limite quando ε → 0⁺
    const ateUm = [1e-2, 1e-4, 1e-6].map((eps) => F(1) - F(eps));
    expect(ateUm.every((v, i) => i === 0 || v > 50 * ateUm[i - 1]!)).toBe(true);
  });
});

describe('Erros dos slides: o valor que está no slide é reprovado', () => {
  // Só dá para testar assim os erros que trazem o valor do slide, além da descrição.
  const temValor = (e?: object) => e !== undefined && Object.keys(e).length > 1;

  for (const c of derivadas.filter((c) => temValor(c.erroNoSlide))) {
    it(`${c.id}: ${c.erroNoSlide!.descricao}`, () => expect(validaDerivada({ ...c, ...c.erroNoSlide })).toBe(false));
  }
  for (const c of integrais.filter((c) => temValor(c.erroNoSlide))) {
    it(`${c.id}: ${c.erroNoSlide!.descricao}`, () => expect(validaIntegral({ ...c, ...c.erroNoSlide })).toBe(false));
  }
  for (const c of angulos.filter((c) => temValor(c.erroNoSlide))) {
    it(`${c.id}: ${c.erroNoSlide!.descricao}`, () => expect(validaAngulo({ ...c, ...c.erroNoSlide })).toBe(false));
  }
});

describe('Erros comuns da Aula 3 (quadro 8) são reprovados', () => {
  const derivadasErradas = [
    { erro: 'esquecer de derivar a função interna', f: 'sen(3*x)', resposta: 'cos(3*x)' },
    { erro: 'errar o sinal na derivada trigonométrica', f: 'cos(5*x^2)', resposta: '10*x*sen(5*x^2)' },
    { erro: 'derivar o produto como produto das derivadas', f: 'x^2*sen(x)', resposta: '2*x*cos(x)' },
  ];
  for (const e of derivadasErradas) {
    it(`${e.erro}: (${e.f})' ≠ ${e.resposta}`, () =>
      expect(validaDerivada({ id: '', fonte: '', f: e.f, esperado: e.resposta, regras: [] })).toBe(false));
  }

  it('∫ 1/x dx = ln(x), sem o módulo: derivar não pega o erro, o domínio pega', () =>
    expect(validaIntegral({ id: '', fonte: '', f: '1/x', esperado: 'ln(x)', regras: [] })).toBe(false));

  it('esquecer de dividir pelo fator da substituição: ∫ cos(3x) dx ≠ sen(3x)', () =>
    expect(validaIntegral({ id: '', fonte: '', f: 'cos(3*x)', esperado: 'sen(3*x)', regras: [] })).toBe(false));
});

describe('Armadilhas da plataforma: por que o motor precisa de tratamento especial', () => {
  it('tg(π/2) em ponto flutuante dá ~1,6·10¹⁶, não Infinity: "indefinida" tem que vir de cos ≈ 0', () => {
    expect(Number.isFinite(Math.tan(Math.PI / 2))).toBe(true);
    expect(Math.abs(Math.cos(Math.PI / 2))).toBeLessThan(1e-15);
  });

  it('log é o logaritmo natural no JS e no math.js; na aula a base vem sempre explícita', () => {
    expect(Math.log(100)).toBeCloseTo(4.605, 3);
    expect(evaluate('log(100)')).toBeCloseTo(4.605, 3);
    expect(evaluate('log(100, 10)')).toBeCloseTo(2, 12);
  });

  it('Math.sin trabalha em radianos: sen(30°) exige conversão', () => {
    expect(Math.sin(30)).toBeCloseTo(-0.988, 3);
    expect(Math.sin((30 * Math.PI) / 180)).toBeCloseTo(0.5, 12);
  });

  it('limite numérico com h pequeno demais quebra: (1 − cos x)/x² dá 0 em x = 10⁻⁸, e o certo é 1/2', () => {
    expect(avaliar('(1 - cos(x))/x^2', 1e-8)).toBe(0);
    expect(avaliar('(1 - cos(x))/x^2', 1e-4)).toBeCloseTo(0.5, 6);
  });

  it('a regra da potência com n = −1 divide por zero; por isso ∫ 1/x dx = ln|x| + C', () => {
    const n = -1;
    expect(2 ** (n + 1) / (n + 1)).toBe(Infinity);
  });
});

describe('Cobertura das regras exigidas no projeto (mínimo de cinco de cada)', () => {
  it('os casos de derivada usam as seis regras da lista', () => {
    const usadas = new Set(derivadas.flatMap((c) => c.regras));
    expect(REGRAS_DERIVACAO.filter((r) => !usadas.has(r))).toEqual([]);
  });

  it('os casos de integral usam as seis regras da lista', () => {
    const usadas = new Set(integrais.flatMap((c) => c.regras));
    expect(REGRAS_INTEGRACAO.filter((r) => !usadas.has(r))).toEqual([]);
  });
});

/*
 * Modelo para rodar os mesmos casos contra o motor do app (ajuste nomes e caminhos):
 *
 *   import { derivar } from '../src/calculo/derivadas';
 *   import { integrar } from '../src/calculo/integrais';
 *   import { equivalentes, derivadaOraculo } from './oraculo';
 *
 *   describe('Motor do app', () => {
 *     for (const c of derivadas)
 *       it(c.id, () => expect(equivalentes(derivar(c.f), c.esperado, c.dominio)).toBe(true));
 *     for (const c of integrais)
 *       it(c.id, () => expect(equivalentes(derivadaOraculo(integrar(c.f)), c.f, c.dominio)).toBe(true));
 *   });
 *
 * Compare por equivalência numérica, nunca por texto: "2*x" e "x*2" são o mesmo resultado,
 * e duas primitivas certas podem diferir por uma constante.
 */
