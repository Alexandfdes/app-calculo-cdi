/**
 * Testes do motor de derivadas (src/motor). Os casos dos slides vêm de casos-dos-slides.ts,
 * já conferidos pelo oráculo; aqui o resultado do motor é comparado com eles.
 */
import { describe, expect, it } from 'vitest';
import { derivar, descreverPasso } from '../src/motor/derivadas';
import { ErroDeEntrada, avaliar, lerExpressao, paraTexto } from '../src/motor/expressao';
import { derivadas } from './casos-dos-slides';
import { equivalentes } from './oraculo';

describe('Motor de derivadas: casos dos slides', () => {
  for (const c of derivadas) {
    it(`${c.id}: (${c.f})' = ${c.esperado}`, () => {
      const r = derivar(c.f);
      expect(equivalentes(paraTexto(r.resultado), c.esperado, c.dominio)).toBe(true);
      for (const regra of c.regras) expect(r.regrasUsadas).toContain(regra);
    });
  }
});

describe('O resultado sai simplificado (Aula 3, quadro 8: "não simplificar a expressão final")', () => {
  const formas: [string, string][] = [
    ['7', '0'],
    ['x^3', '3*x^2'],
    ['x^3 - 4*x + 2', '3*x^2 - 4'],
    ['1/x', '-1/x^2'],
    ['sqrt(x)', '1/(2*sqrt(x))'],
    ['x^2*sen(x)', '2*x*sen(x) + x^2*cos(x)'],
    ['sen(x)/x', '(x*cos(x) - sen(x))/x^2'],
    ['sen(3*x)', '3*cos(3*x)'],
    ['cos(5*x^2)', '-10*x*sen(5*x^2)'],
    ['tg(x^2 + 1)', '2*x*sec(x^2 + 1)^2'],
    ['ln(cos(x))', '-tg(x)'],
    ['sqrt(tg(x))', 'sec(x)^2/(2*sqrt(tg(x)))'],
  ];
  for (const [f, forma] of formas) {
    it(`(${f})' = ${forma}`, () => expect(paraTexto(derivar(f).resultado)).toBe(forma));
  }
});

describe('Potência de potência', () => {
  it('(x²)^0.5 = |x|: a derivada é x/|x|, −1 para x < 0, e não 1', () => {
    const r = derivar('(x^2)^0.5');
    expect(avaliar(r.resultado, { x: -2 })).toBeCloseTo(-1, 12);
    expect(avaliar(r.resultado, { x: 3 })).toBeCloseTo(1, 12);
  });

  it('com expoente inteiro a conta junta: (x^(1/2))^2 = x e (x²)³ = x⁶', () => {
    expect(paraTexto(derivar('(x^2)^3').resultado)).toBe('6*x^5');
    expect(avaliar(derivar('(x^(1/2))^2').resultado, { x: 2 })).toBeCloseTo(1, 12);
  });
});

describe('Passo a passo', () => {
  it("o produto aparece como no slide: (fg)' = f'g + fg'", () => {
    const [primeiro] = derivar('x^2*sen(x)').passos;
    expect(primeiro?.regra).toBe('produto');
    expect(paraTexto(primeiro!.expansao)).toBe("(x^2)'*sen(x) + x^2*(sen(x))'");
  });

  it('a cadeia é aplicada de fora para dentro', () => {
    expect(derivar('cos(5*x^2)').passos.map((p) => p.regra)).toEqual(['cadeia', 'múltiplo constante', 'potência']);
  });

  it('cada passo vira uma frase', () => {
    expect(descreverPasso(derivar('sen(3*x)').passos[0]!)).toBe("Regra da cadeia: (sen(3*x))' = cos(3*x)*(3*x)'");
  });

  it('deriva em t, a variável do cenário do veículo', () => {
    expect(paraTexto(derivar('t^2', 't').resultado)).toBe('2*t');
  });
});

describe('Entradas inválidas têm mensagem clara', () => {
  const invalidas: [string, RegExp][] = [
    ['', /Digite/],
    ['log(x)', /ln\(x\)/],
    ['x^x', /fora do conteúdo/],
    ['y + x', /Símbolo desconhecido "y"/],
    ['sen x', /parênteses/],
    ['2,5*x', /ponto para decimais/],
    ['foo(x)', /Função desconhecida/],
    ['constructor(x)', /Função desconhecida/],
    ['x < 5 ? 2 : -3', /não suportada/],
  ];
  for (const [entrada, mensagem] of invalidas) {
    it(`"${entrada}" → ${mensagem.source}`, () => {
      expect(() => derivar(entrada)).toThrow(ErroDeEntrada);
      expect(() => derivar(entrada)).toThrow(mensagem);
    });
  }
});

describe('Leitura da expressão', () => {
  it('aceita a notação da aula e a internacional', () => {
    expect(paraTexto(lerExpressao('sin(x) + tan(x) + cot(x)'))).toBe('sen(x) + tg(x) + cotg(x)');
  });

  it('aceita multiplicação implícita e π', () => {
    expect(paraTexto(lerExpressao('2x + π'))).toBe('2*x + pi');
  });
});
