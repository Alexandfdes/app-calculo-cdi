import { describe, expect, it } from 'vitest';
import { calcularLimite } from '../src/motor/limites';

describe("Limites que pedem L'Hôpital ou e^(ln)", () => {
  it('x·ln x vai a 0 pela direita (à esquerda, ln x não existe)', () => {
    const r = calcularLimite('x*ln(x)', '0');
    expect(r.direita).toBeCloseTo(0, 12);
    expect(r.esquerda).toBe('sem valor');
    expect(r.passos.some((p) => p.tecnica === 'L’Hôpital')).toBe(true);
  });

  it('xˣ vai a 1 pela direita', () => {
    expect(calcularLimite('x^x', '0').direita).toBeCloseTo(1, 12);
  });

  it('∛(x − 1)/(x − 1) vai a +∞ dos dois lados', () => {
    expect(calcularLimite('(x-1)^(1/3)/(x-1)', '1').limite).toBe('+∞');
  });

  it('0/0 que os limites fundamentais não desfazem', () => {
    expect(calcularLimite('ln(x)/(x-1)', '1').limite).toBeCloseTo(1, 12);
    expect(calcularLimite('(x-sen(x))/x^3', '0').limite).toBeCloseTo(1 / 6, 12);
    expect(calcularLimite('(e^x-1-x)/x^2', '0').limite).toBeCloseTo(0.5, 12);
  });

  it('arctg no infinito', () => {
    expect(calcularLimite('arctg(x)', 'inf').limite).toBeCloseTo(Math.PI / 2, 12);
    expect(calcularLimite('arctg(x)', '-inf').limite).toBeCloseTo(-Math.PI / 2, 12);
  });

  it('as técnicas da aula continuam vindo antes', () => {
    expect(calcularLimite('sen(x)/x', '0').passos.some((p) => p.tecnica === 'L’Hôpital')).toBe(false);
    expect(calcularLimite('(x^2-4)/(x-2)', '2').passos.some((p) => p.tecnica === 'L’Hôpital')).toBe(false);
  });
});
