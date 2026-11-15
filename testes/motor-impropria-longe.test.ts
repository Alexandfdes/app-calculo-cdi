import { describe, expect, it } from 'vitest';
import { integralDefinida } from '../src/motor/definidas';

describe('Integral imprópria: casos achados na caça de erros', () => {
  it('nota um polo longe da ponta finita', () => {
    expect(integralDefinida('1/(x-500)^2', 0, 'inf').valor).toBe('diverge');
    expect(integralDefinida('1/(x+3000)^2', '-inf', 0).valor).toBe('diverge');
  });

  it('não confunde estouro numérico com falta de valor real', () => {
    expect(integralDefinida('x*e^(x^2)', '-inf', 0).valor).toBe('diverge');
  });

  it('continua certa onde já estava', () => {
    expect(integralDefinida('e^(-x)', 0, 'inf').valor).toBeCloseTo(1, 9);
    expect(integralDefinida('1/x^2', 1, 'inf').valor).toBeCloseTo(1, 9);
    expect(() => integralDefinida('sqrt(x)', -1, 'inf')).toThrow();
  });
});
