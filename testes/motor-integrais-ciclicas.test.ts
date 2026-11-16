import { describe, expect, it } from 'vitest';
import { integrar } from '../src/motor/integrais';
import { derivar } from '../src/motor/derivadas';
import { avaliar, lerExpressao } from '../src/motor/expressao';

/** A primitiva confere: derivada do resultado = integrando em varios pontos. */
function confere(f: string): void {
  const r = integrar(f);
  const d = derivar(r.resultado).resultado;
  const g = lerExpressao(f);
  for (const t of [0.37, 1.7, 2.9, -0.6, -2.3]) {
    const esperado = avaliar(g, { x: t });
    if (!Number.isFinite(esperado)) continue;
    expect(avaliar(d, { x: t }), `${f} em x = ${t}`).toBeCloseTo(esperado, 7);
  }
}

describe('Integrais por partes cíclicas (e^x com seno e cosseno)', () => {
  it.each(['e^x*sen(x)', 'e^x*cos(x)', 'e^(2*x)*sen(3*x)', 'e^(-x)*cos(2*x)', 'sen(x)*e^x'])('∫ %s dx', (f) => {
    confere(f);
    expect(integrar(f).regrasUsadas).toContain('por partes');
  });
});

describe('Quadrados trigonométricos pela identidade do arco duplo', () => {
  it.each(['sen(x)^2', 'cos(x)^2', 'tg(x)^2', 'cotg(x)^2', 'sen(2*x)^2', 'cos(x/2)^2'])('∫ %s dx', (f) => {
    confere(f);
    expect(integrar(f).regrasUsadas).toContain('identidade trigonométrica');
  });

  it('sen²x sai como na aula: x/2 − sen(2x)/4 + C', () => {
    const r = integrar('sen(x)^2');
    const F = lerExpressao('x/2 - sen(2*x)/4');
    for (const t of [0.4, 1.3, -2.1]) expect(avaliar(r.resultado, { x: t })).toBeCloseTo(avaliar(F, { x: t }), 10);
  });

  it('potência maior continua com o aviso', () => {
    expect(() => integrar('sen(x)^3')).toThrow(/identidades trigonométricas/);
  });
});
