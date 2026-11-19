import { describe, expect, it } from 'vitest';
import { integralDefinida } from '../src/motor/definidas';
import { integrar } from '../src/motor/integrais';
import { derivar } from '../src/motor/derivadas';
import { calcularLimite } from '../src/motor/limites';
import { avaliar, lerExpressao } from '../src/motor/expressao';

describe('Segunda caça: polos que escapavam da integral definida', () => {
  it.each([
    ['1/x^2', '-0.01', '100'],
    ['1/x^2', '-1', '9000'],
    ['1/(x-1)^2', '0.99', '100'],
    ['1/(x-0.0001)^2', '0', '1'],
    ['1/(x-pi)^2', '0', '50000'],
    ['1/((x-1)^2*(x+1))', '0.99', '100'],
    ['1/(x^2*(x+1))', '-0.01', '100'],
    ['1/x^2', '-1', '1000000'],
    ['1/x^3', '-1', '1000000'],
    ['1/(x-3)^4', '1', '30000'],
    ['1/(x-50000.123)^2', '0', '100000'],
    ['1/(x-50000.123)', '0', '100000'],
    ['1/(x-1000001)^2', '0', 'inf'],
    ['1/(x-2000000)^3', '0', 'inf'],
  ])('∫ %s de %s a %s diverge', (f, a, b) => {
    expect(integralDefinida(f, a, b).valor).toBe('diverge');
  });

  it.each([
    ['1/x^2', '1', '1000000', 0.999999],
    ['1/sqrt(x)', '0', '1', 2],
    ['ln(x)', '0', '1', -1],
    ['1/x^(1/3)', '-1', '8', 4.5],
    ['1/(x^2-1)', '2', 'inf', Math.log(3) / 2],
    ['1/(x*(x+1))', '1', 'inf', Math.log(2)],
    ['1/(x^3+x)', '1', 'inf', Math.log(2) / 2],
    ['e^(-x)*sen(x)', '0', 'inf', 0.5],
    ['e^x*sen(x)', '-inf', '0', -0.5],
  ])('∫ %s de %s a %s = %d', (f, a, b, esperado) => {
    expect(integralDefinida(f, a, b).valor).toBeCloseTo(esperado, 9);
  });
});

describe("Segunda caça: limites", () => {
  it("L'Hôpital não conclui quando o quociente das derivadas oscila", () => {
    expect(calcularLimite('(x + sen(x))/x', 'inf').limite).toBeCloseTo(1, 12);
    expect(calcularLimite('x/(x+sen(x))', 'inf').limite).toBeCloseTo(1, 12);
    expect(calcularLimite('x^2*sen(1/x)/x', '0').limite).toBeCloseTo(0, 12);
  });

  it('base negativa à esquerda não ganha valor inventado', () => {
    const r = calcularLimite('x^(1/ln(x))', '0');
    expect(r.esquerda).toBe('sem valor');
    expect(r.direita).toBeCloseTo(Math.E, 12);
  });

  it.each([
    ['x*cotg(x)', '0', 1],
    ['x*cotg(2*x)', '0', 0.5],
    ['x*arctg(1/x)', 'inf', 1],
    ['x*(pi/2-arctg(x))', 'inf', 1],
    ['(x/(x+1))^x', 'inf', Math.exp(-1)],
    ['((x+1)/(x-1))^x', 'inf', Math.exp(2)],
    ['ln(x)-ln(x+1)', 'inf', 0],
    ['(x-pi/2)*tg(x)', 'pi/2', -1],
  ])('lim %s em %s = %d, sem travar', (f, a, esperado) => {
    expect(calcularLimite(f, a).limite).toBeCloseTo(esperado, 9);
  });

  it.each(['x*csc(x)', 'sen(x)^tg(x)', 'tg(x)/tg(3*x)', 'tg(x)^cos(x)', 'sqrt(1-cos(x))/x'])('lim %s responde ou recusa em pouco tempo', (f) => {
    const inicio = Date.now();
    try {
      calcularLimite(f, f.includes('tg') ? 'pi/2' : '0');
    } catch {
      // recusar é aceitável; travar, não
    }
    expect(Date.now() - inicio).toBeLessThan(3000);
  });
});

describe('Segunda caça: integrais antes recusadas', () => {
  it.each([
    '1/((2*x^2+2*x+1)*(x+5)*(x-3))',
    '1/(x^2+2*x+1)',
    '1/(x^3-3*x^2+3*x-1)',
    '(x-1)/(x^2-1)',
    '(5*x+1/2)*cos(2*x+1)',
    '(x/2+3)*arctg(x)',
    '(2*x+1/2)^2*e^(-x)',
  ])('∫ %s dx confere pela derivada', (f) => {
    const d = derivar(integrar(f).resultado).resultado;
    const g = lerExpressao(f);
    for (const t of [0.37, 1.7, 2.4, -0.6, -2.3]) {
      const esperado = avaliar(g, { x: t });
      if (Number.isFinite(esperado)) expect(avaliar(d, { x: t })).toBeCloseTo(esperado, 7);
    }
  });
});

describe('Terceira caça', () => {
  it('conjugado também com soma: √(x² + x) + x em −∞ = −1/2', () => {
    expect(calcularLimite('raiz(x^2+x)+x', '-inf').limite).toBeCloseTo(-0.5, 12);
  });

  it('sen(3x)/(5x) em 0 sai 0,6 sem ruído', () => {
    expect(calcularLimite('sen(3*x)/(5*x)', '0').limite).toBe(0.6);
  });
});
