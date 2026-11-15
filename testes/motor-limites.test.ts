/**
 * Testes do motor de limites (src/motor/limites.ts). Os casos dos slides vêm de
 * casos-dos-slides.ts, já conferidos pelo oráculo numérico; aqui o motor, que é simbólico,
 * tem de chegar aos mesmos limites laterais, ao mesmo limite e à mesma classificação.
 */
import { describe, expect, it } from 'vitest';
import { ErroDeEntrada, paraTexto } from '../src/motor/expressao';
import { calcularLimite } from '../src/motor/limites';
import type { TecnicaLimite, ValorLimite } from '../src/motor/limites';
import { limites } from './casos-dos-slides';

/** Número legível no nome do teste: 2, 0.5000, +∞. */
const num = (n: number) => (n === Infinity ? '+∞' : n === -Infinity ? '−∞' : Number.isInteger(n) ? String(n) : n.toFixed(4));

function confere(obtido: ValorLimite | 'não existe' | undefined, esperado: ValorLimite | 'não existe'): void {
  if (typeof esperado === 'number') {
    expect(typeof obtido).toBe('number');
    expect(obtido as number).toBeCloseTo(esperado, 9);
  } else expect(obtido).toBe(esperado);
}

const tecnicas = (f: string, a: number | string): TecnicaLimite[] => calcularLimite(f, a).passos.map((p) => p.tecnica);

describe('Motor de limites: casos dos slides (Aula 2)', () => {
  for (const c of limites) {
    it(`${c.id}: lim ${c.f} com x → ${num(c.a)} = ${typeof c.limite === 'number' ? num(c.limite) : c.limite}`, () => {
      const r = calcularLimite(c.f, c.a);
      confere(r.limite, c.limite);
      if (c.esquerda !== undefined) confere(r.esquerda, c.esquerda);
      if (c.direita !== undefined) confere(r.direita, c.direita);
      expect(r.descontinuidade).toBe(c.descontinuidade);
    });
  }
});

describe('Cada caso usa a técnica da aula (quadro 11)', () => {
  const casos: [string, number | string, TecnicaLimite][] = [
    ['x^2 + 1', 3, 'substituição direta'],
    ['(x^2 - 4)/(x - 2)', 2, 'fatoração'],
    ['(sqrt(x + 1) - 1)/x', 0, 'racionalização'],
    ['sen(x)/x', 0, 'limite fundamental'],
    ['(2^x - 1)/x', 0, 'limite fundamental'],
    ['abs(x)/x', 0, 'módulo'],
    ['1/x', 0, 'limite infinito'],
    ['sen(1/x)', 0, 'oscilação'],
    ['(3*x^2 + 1)/(2*x^2 - x)', 'inf', 'limite no infinito'],
    ['x < 5 ? 2 : -3', 5, 'por partes'],
    ['sen(x)/x', 'inf', 'confronto'],
  ];
  for (const [f, a, tecnica] of casos) {
    it(`lim ${f} com x → ${a}: ${tecnica}`, () => expect(tecnicas(f, a)).toContain(tecnica));
  }

  it('a fatoração mostra o fator que se cancela, como no slide', () => {
    const passo = calcularLimite('(x^2 - 4)/(x - 2)', 2).passos.find((p) => p.tecnica === 'fatoração')!;
    expect(passo.contas?.map(paraTexto)).toEqual(['(x^2 - 4)/(x - 2)', '(x - 2)*(x + 2)/(x - 2)', 'x + 2']);
  });

  it('a racionalização termina em 1/(√(x + 1) + 1)', () => {
    const passo = calcularLimite('(sqrt(x + 1) - 1)/x', 0).passos.find((p) => p.tecnica === 'racionalização')!;
    expect(paraTexto(passo.contas!.at(-1)!)).toBe('1/(sqrt(x + 1) + 1)');
  });

  it('(aˣ − 1)/x guarda o valor exato ln a', () => {
    expect(paraTexto(calcularLimite('(2^x - 1)/x', 0).exato!)).toBe('ln(2)');
  });
});

describe('Mais limites de cada quadro', () => {
  const casos: [string, number | string, ValorLimite | 'não existe'][] = [
    // quadro 5: fatoração e racionalização em outras formas
    ['(x^2 - 1)/(x^2 + x - 2)', 1, 2 / 3],
    ['(x^3 - 8)/(x - 2)', 2, 12],
    ['(sqrt(x) - 2)/(x - 4)', 4, 0.25],
    ['(x - 9)/(sqrt(x) - 3)', 9, 6],
    // quadro 7, com constantes e invertido
    ['sen(3*x)/x', 0, 3],
    ['x/sen(x)', 0, 1],
    ['(e^(2*x) - 1)/x', 0, 2],
    // quadro 6: infinito, inclusive x → −∞
    ['(2*x + 1)/(x - 3)', '-inf', 2],
    ['x^3 - 5*x', '-inf', '-∞'],
    ['e^x', '-inf', 0],
    ['e^(-x)', 'inf', 0],
    ['sqrt(x)', 'inf', '+∞'],
    ['ln(x)', 'inf', '+∞'],
    ['1/x^2', 'inf', 0],
    // quadro 10: confronto
    ['x*sen(1/x)', 0, 0],
    // pontos escritos de outras formas
    ['sen(x)', 'pi', 0],
    ['cos(x)', 'pi/3', 0.5],
  ];
  for (const [f, a, esperado] of casos) {
    it(`lim ${f} com x → ${a} = ${typeof esperado === 'number' ? num(esperado) : esperado}`, () => confere(calcularLimite(f, a).limite, esperado));
  }

  it('tg(x) em π/2: +∞ pela esquerda, −∞ pela direita, assíntota vertical', () => {
    const r = calcularLimite('tg(x)', 'pi/2');
    expect([r.esquerda, r.direita, r.limite, r.descontinuidade]).toEqual(['+∞', '-∞', 'não existe', 'infinita']);
  });

  it('ln(x) em 0: só existe pela direita, onde vai a −∞', () => {
    const r = calcularLimite('ln(x)', 0);
    expect([r.esquerda, r.direita, r.limite]).toEqual(['sem valor', '-∞', 'não existe']);
  });

  it('função contínua: o limite é f(a) e não há descontinuidade', () => {
    const r = calcularLimite('x^2 + 1', 3);
    expect([r.limite, r.valorEmA, r.descontinuidade]).toEqual([10, 10, undefined]);
  });

  it('por partes longe do corte usa só uma fórmula', () => {
    expect(calcularLimite('x < 5 ? 2*x : 10 - 3*(x - 5)', 2).limite).toBe(4);
    expect(calcularLimite('x < 5 ? 2*x : 10 - 3*(x - 5)', 7).limite).toBe(4);
  });

  it('x >= c e c > x são lidos do jeito certo', () => {
    const r = calcularLimite('x >= 0 ? 1 : -1', 0);
    expect([r.esquerda, r.direita, r.valorEmA]).toEqual([-1, 1, 1]);
    expect(calcularLimite('0 > x ? -1 : 1', 0).valorEmA).toBe(1);
  });
});

describe('A interpretação explica o resultado (quadro 11, passo 5)', () => {
  it('removível: fala do buraco no gráfico', () => expect(calcularLimite('(x^2 - 4)/(x - 2)', 2).interpretacao).toMatch(/buraco/));
  it('salto: fala do salto', () => expect(calcularLimite('x < 5 ? 2 : -3', 5).interpretacao).toMatch(/salto/));
  it('infinita: fala da assíntota vertical', () => expect(calcularLimite('1/x', 0).interpretacao).toMatch(/assíntota vertical/));
  it('no infinito: fala da assíntota horizontal', () => expect(calcularLimite('1/x', 'inf').interpretacao).toMatch(/assíntota horizontal/));
});

describe('Entradas que o motor não resolve têm mensagem clara', () => {
  const casos: [string, string, RegExp][] = [
    ['x*sen(x)', 'inf', /forma indeterminada ∞ · oscilação/],
    ['x^2', 'abc', /Símbolo desconhecido/],
    ['x < y ? 1 : 2', '0', /comparar x com um número/],
    ['x < 5 ? 1', '5', /função por partes/],
    ['ln(x)', '-inf', /não existe para x muito negativo/],
    ['x^2', '', /Digite o ponto/],
  ];
  for (const [f, a, mensagem] of casos) {
    it(`lim ${f} com x → "${a}" → ${mensagem.source}`, () => {
      expect(() => calcularLimite(f, a)).toThrow(ErroDeEntrada);
      expect(() => calcularLimite(f, a)).toThrow(mensagem);
    });
  }
});

describe('Conferência em massa da fatoração', () => {
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

  it('100 quocientes (x − r)(x − s)/((x − r)(x − t)) em x → r dão (r − s)/(r − t)', () => {
    const sorteio = gerador(2026);
    const inteiro = () => Math.floor(sorteio() * 13) - 6;
    const erros: string[] = [];
    for (let i = 0; i < 100; i++) {
      const r = inteiro();
      let s = inteiro();
      let t = inteiro();
      if (s === r) s = r + 1;
      if (t === r || t === s) t = r + 2 === s ? r - 1 : r + 2;
      const f = `((x - (${r}))*(x - (${s})))/((x - (${r}))*(x - (${t})))`;
      const obtido = calcularLimite(f, r).limite;
      const esperado = (r - s) / (r - t);
      if (typeof obtido !== 'number' || Math.abs(obtido - esperado) > 1e-9) erros.push(`${f}: ${String(obtido)} ≠ ${esperado}`);
    }
    expect(erros).toEqual([]);
  });
});

describe('Limites que antes ficavam sem técnica', () => {
  // [f, ponto, limite esperado (número, '+∞', '-∞' ou 'não existe'), técnica que precisa aparecer]
  const casos: [string, string, number | string, string][] = [
    ['tg(x)/x', '0', 1, 'limite fundamental'],
    ['sen(5*x)/sen(3*x)', '0', 5 / 3, 'limite fundamental'],
    ['sen(x^2)/x', '0', 0, 'limite fundamental'],
    ['x/tg(2*x)', '0', 0.5, 'limite fundamental'],
    ['(1 - cos(x))/(x*sen(x))', '0', 0.5, 'limite fundamental'],
    ['sen(x)/(x - pi)', 'pi', -1, 'limite fundamental'],
    ['tg(3*x)/(e^(2*x) - 1)', '0', 1.5, 'limite fundamental'],
    ['(1 + 1/x)^x', 'inf', Math.E, 'limite fundamental'],
    ['(1 + 2/x)^(3*x)', 'inf', Math.exp(6), 'limite fundamental'],
    ['(1 - 1/x)^x', 'inf', Math.exp(-1), 'limite fundamental'],
    ['e^x/x', 'inf', '+∞', 'ordem de crescimento'],
    ['ln(x)/x', 'inf', 0, 'ordem de crescimento'],
    ['x*e^(-x)', 'inf', 0, 'ordem de crescimento'],
    ['x^3/e^x', 'inf', 0, 'ordem de crescimento'],
    ['x/ln(x)', 'inf', '+∞', 'ordem de crescimento'],
    ['sqrt(x^2 + 1)/x', 'inf', 1, 'ordem de crescimento'],
    ['sqrt(x^2 + 1)/x', '-inf', -1, 'ordem de crescimento'],
    ['x - sqrt(x^2 + 1)', 'inf', 0, 'racionalização'],
    ['sqrt(x^2 + x) - x', 'inf', 0.5, 'racionalização'],
  ];
  for (const [f, ponto, esperado, tecnica] of casos) {
    it(`lim x→${ponto} ${f} = ${typeof esperado === 'number' ? esperado.toFixed(4) : esperado}`, () => {
      const r = calcularLimite(f, ponto);
      if (typeof esperado === 'number') {
        expect(typeof r.limite).toBe('number');
        expect(r.limite as number).toBeCloseTo(esperado, 10);
      } else expect(r.limite).toBe(esperado);
      expect(r.passos.map((p) => p.tecnica)).toContain(tecnica);
    });
  }

  it('o resultado de (1 + 1/x)^x sai exato: e', () => {
    expect(paraTexto(calcularLimite('(1 + 1/x)^x', 'inf').exato!)).toBe('e');
  });

  it('sem fator equivalente, continua recusando em vez de chutar', () => {
    expect(() => calcularLimite('x*sen(x)', 'inf')).toThrow(ErroDeEntrada);
    expect(() => calcularLimite('sqrt(x^2 + x) + x', '-inf')).toThrow(ErroDeEntrada);
  });
});
