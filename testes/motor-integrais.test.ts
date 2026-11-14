/**
 * Testes do motor de integrais (src/motor). Os casos dos slides vêm de casos-dos-slides.ts,
 * já conferidos pelo oráculo; aqui a primitiva que o motor devolve passa pela mesma
 * conferência dos casos: a derivada volta ao integrando, e ela existe onde o integrando existe.
 */
import { describe, expect, it } from 'vitest';
import { derivar } from '../src/motor/derivadas';
import { descreverIntegralDefinida, integralDefinida } from '../src/motor/definidas';
import { ErroDeEntrada, paraTexto } from '../src/motor/expressao';
import { descreverPasso, integrar } from '../src/motor/integrais';
import { REGRAS_INTEGRACAO, integrais, integraisDefinidas, integraisForaDoEscopo } from './casos-dos-slides';
import { equivalentes, validaIntegral } from './oraculo';

/** Número legível no nome do teste: 2, 3.1416. */
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4));

describe('Motor de integrais: casos dos slides', () => {
  for (const c of integrais) {
    it(`${c.id}: ∫ ${c.f} dx = ${c.esperado} + C`, () => {
      const r = integrar(c.f);
      expect(validaIntegral({ ...c, esperado: paraTexto(r.resultado) })).toBe(true);
      for (const regra of c.regras) expect(r.regrasUsadas).toContain(regra);
    });
  }

  it('os casos passam pelas seis regras da lista do projeto', () => {
    const usadas = new Set(integrais.flatMap((c) => integrar(c.f).regrasUsadas));
    expect(REGRAS_INTEGRACAO.filter((r) => !usadas.has(r))).toEqual([]);
  });
});

describe('"Verifique o resultado derivando!" (quadro 12): o motor de derivadas desfaz o de integrais', () => {
  for (const c of integrais) {
    it(`${c.id}: (∫ ${c.f} dx)' = ${c.f}`, () => {
      const primitiva = integrar(c.f).resultado;
      expect(equivalentes(paraTexto(derivar(primitiva).resultado), c.f, c.dominio)).toBe(true);
    });
  }
});

describe('O resultado sai simplificado', () => {
  const formas: [string, string][] = [
    ['5', '5*x'],
    ['x', 'x^2/2'],
    ['x^3', 'x^4/4'],
    ['1/x', 'ln(abs(x))'],
    ['1/x^2', '-1/x'],
    ['sqrt(x)', '2*x^(3/2)/3'],
    ['1/sqrt(x)', '2*sqrt(x)'],
    ['3*x^2 - 4*x + 2', 'x^3 - 2*x^2 + 2*x'],
    ['2^x', '2^x/ln(2)'],
    ['tg(x)', '-ln(abs(cos(x)))'],
    ['cos(3*x)', 'sen(3*x)/3'],
    ['e^(-2*x)', '-e^(-2*x)/2'],
    ['2*x*cos(x^2)', 'sen(x^2)'],
    ['2*x/(x^2 + 1)', 'ln(abs(x^2 + 1))'],
    ['cos(x)*sen(x)^3', 'sen(x)^4/4'],
  ];
  for (const [f, forma] of formas) {
    it(`∫ ${f} dx = ${forma} + C`, () => expect(paraTexto(integrar(f).resultado)).toBe(forma));
  }
});

describe('Passo a passo', () => {
  it('a soma e a diferença separam todos os termos de uma vez (quadro 2)', () => {
    const [primeiro] = integrar('3*x^2 - 4*x + 2').passos;
    expect(primeiro?.regra).toBe('soma/subtração');
    expect(paraTexto(primeiro!.expansao)).toBe('∫ 3*x^2 dx - ∫ 4*x dx + ∫ 2 dx');
  });

  it('a substituição sai como no exemplo do quadro 5, com a volta para x', () => {
    const r = integrar('2*x*cos(x^2)');
    expect(r.passos.map((p) => p.regra)).toEqual(['substituição', 'trigonométrica']);
    expect(descreverPasso(r.passos[0]!)).toBe(
      'Substituição: u = x^2, du = 2*x dx. ∫ 2*x*cos(x^2) dx = ∫ cos(u) du = sen(u) + C = sen(x^2) + C',
    );
  });

  it('substituição linear: u = 3*x e du = 3 dx, e o 1/3 aparece', () => {
    expect(descreverPasso(integrar('cos(3*x)').passos[0]!)).toBe(
      'Substituição: u = 3*x, du = 3 dx. ∫ cos(3*x) dx = ∫ cos(u)/3 du = sen(u)/3 + C = sen(3*x)/3 + C',
    );
  });

  it('cada passo que fecha uma integral traz o + C (quadro 12: "não esqueça a constante")', () => {
    expect(descreverPasso(integrar('x^3').passos[0]!)).toBe('Regra da potência: ∫ x^3 dx = x^4/4 + C');
  });

  it('o passo intermediário deixa a integral pendente, sem o + C', () => {
    expect(descreverPasso(integrar('3*x^2').passos[0]!)).toBe('Múltiplo constante: ∫ 3*x^2 dx = 3*(∫ x^2 dx)');
  });

  it('integra em t, a variável do cenário do veículo', () => {
    expect(paraTexto(integrar('2*t', 't').resultado)).toBe('t^2');
  });
});

describe('Técnicas fora do projeto: o motor avisa em vez de errar', () => {
  for (const c of integraisForaDoEscopo) {
    it(`${c.id}: ∫ ${c.f} dx (${c.fonte})`, () => expect(() => integrar(c.f)).toThrow(ErroDeEntrada));
  }

  const avisos: [string, RegExp][] = [
    ['x*e^x', /por partes/],
    ['(2*x + 3)/(x^2 - 1)', /frações parciais/],
    ['ln(x)', /por partes/],
    ['sen(x)^2', /identidades trigonométricas/],
    ['abs(x)', /integral definida/],
    ['x^x', /fora do conteúdo/],
  ];
  for (const [f, aviso] of avisos) {
    it(`∫ ${f} dx → ${aviso.source}`, () => {
      expect(() => integrar(f)).toThrow(ErroDeEntrada);
      expect(() => integrar(f)).toThrow(aviso);
    });
  }
});

describe('Integrais definidas (Aula 4, quadro 10)', () => {
  for (const c of integraisDefinidas) {
    it(`${c.id}: ∫ de ${num(c.a)} a ${num(c.b)} de ${c.f} = ${c.esperado}`, () => {
      const { valor } = integralDefinida(c.f, c.a, c.b);
      if (c.esperado === 'diverge') expect(valor).toBe('diverge');
      else expect(valor).toBeCloseTo(c.esperado, 9);
    });
  }

  it('ID07: o motor acha a descontinuidade em x = 0 e não aplica o TFC às cegas', () => {
    const r = integralDefinida('1/x^2', -1, 1);
    expect(r.descontinuidades).toHaveLength(1);
    expect(Math.abs(r.descontinuidades[0]!)).toBeLessThan(1e-6);
    expect(descreverIntegralDefinida(r)).toEqual([
      'Primitiva de 1/x^2: F(x) = -1/x',
      '1/x^2 não existe em x = 0, dentro de [-1, 1]: o TFC pede f contínua em [a, b].',
      'F também não tem valor em x = 0: a integral imprópria diverge.',
    ]);
  });

  it('imprópria que converge: ∫ de 0 a 1 de 1/sqrt(x) = 2', () => {
    const r = integralDefinida('1/sqrt(x)', 0, 1);
    expect(r.descontinuidades).toEqual([0]);
    expect(r.valor).toBeCloseTo(2, 12);
  });

  it('ID06: com |sen(x)| o intervalo é cortado em pi, onde sen troca de sinal', () => {
    const r = integralDefinida('abs(sen(x))', 0, 2 * Math.PI);
    expect(r.cortes).toHaveLength(1);
    expect(r.cortes[0]).toBeCloseTo(Math.PI, 12);
    expect(descreverIntegralDefinida(r)).toEqual([
      'Primitiva de sen(x): F(x) = -cos(x)',
      'sen(x) troca de sinal em x = pi: o intervalo é cortado aí.',
      'Área = |F(pi) - F(0)| + |F(2*pi) - F(pi)| = 4',
    ]);
  });

  it('descreve o TFC com os valores de F', () => {
    expect(descreverIntegralDefinida(integralDefinida('sen(x)', 0, Math.PI))).toEqual([
      'Primitiva de sen(x): F(x) = -cos(x)',
      'TFC: F(pi) - F(0) = 1 - (-1) = 2',
    ]);
  });

  it('aceita os limites como texto: pi, e', () => {
    expect(integralDefinida('sen(x)', '0', 'pi').valor).toBeCloseTo(2, 12);
    expect(integralDefinida('1/x', '1', 'e').valor).toBeCloseTo(1, 12);
  });

  it('recusa quando o integrando não tem valor real em parte do intervalo', () => {
    expect(() => integralDefinida('sqrt(x)', -1, 1)).toThrow(ErroDeEntrada);
    expect(() => integralDefinida('sqrt(x)', -1, 1)).toThrow(/não tem valor real/);
  });

  describe('singularidade numa ponta do intervalo: a integral diverge em vez de virar um número', () => {
    // Em ponto flutuante cos(π/2) dá 6·10⁻¹⁷, e não 0: sem olhar as pontas, ∫ de 0 a π/2 de sec²x saía 16331239353195370.
    const casos: [string, string, string, number][] = [
      ['tg(x)', '0', 'pi/2', Math.PI / 2],
      ['sec(x)^2', '0', 'pi/2', Math.PI / 2],
      ['sec(x)', '0', 'pi/2', Math.PI / 2],
      ['sen(x)/cos(x)', '0', 'pi/2', Math.PI / 2],
      ['tg(x)', '-pi/2', '0', -Math.PI / 2],
      ['cotg(x)', 'pi/4', 'pi', Math.PI],
      ['csc(x)^2', 'pi/2', 'pi', Math.PI],
    ];
    for (const [f, a, b, ponta] of casos) {
      it(`∫ de ${a} a ${b} de ${f} diverge`, () => {
        const r = integralDefinida(f, a, b);
        expect(r.valor).toBe('diverge');
        expect(r.descontinuidades).toHaveLength(1);
        expect(r.descontinuidades[0]).toBeCloseTo(ponta, 9);
      });
    }

    it('a frase do TFC aponta a ponta: tg(x) não existe em x = pi/2', () => {
      expect(descreverIntegralDefinida(integralDefinida('tg(x)', '0', 'pi/2'))).toEqual([
        'Primitiva de tg(x): F(x) = -ln(abs(cos(x)))',
        'tg(x) não existe em x = pi/2, dentro de [0, pi/2]: o TFC pede f contínua em [a, b].',
        'F também não tem valor em x = pi/2: a integral imprópria diverge.',
      ]);
    });

    it('sem singularidade na ponta, o TFC vale direto: ∫ de 0 a pi/4 de sec(x)^2 = 1', () => {
      const r = integralDefinida('sec(x)^2', '0', 'pi/4');
      expect(r.descontinuidades).toEqual([]);
      expect(r.valor).toBeCloseTo(1, 12);
    });

    it('imprópria que converge na ponta de cima: ∫ de 0 a 1 de 1/sqrt(1 - x) = 2', () => {
      const r = integralDefinida('1/sqrt(1 - x)', '0', '1');
      expect(r.descontinuidades).toEqual([1]);
      expect(r.valor).toBeCloseTo(2, 12);
    });
  });
});
