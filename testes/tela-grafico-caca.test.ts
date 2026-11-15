import { describe, expect, it } from 'vitest';
import { curto, passoDePi } from '../src/tela/grafico';

describe('Gráfico: casos achados na caça de erros', () => {
  it('troca todos os sinais de menos, inclusive o do expoente', () => {
    expect(curto(-0.0004)).toBe('−4.00e−4');
  });

  it('não empilha centenas de marcas de π num trecho longo', () => {
    expect(1360 / passoDePi(1360)).toBeLessThanOrEqual(12);
    expect(passoDePi(1360) % (2 * Math.PI)).toBeCloseTo(0, 6);
    expect(passoDePi(6)).toBe(Math.PI / 4);
  });
});
