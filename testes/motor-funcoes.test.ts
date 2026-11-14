/**
 * Testes do motor de funções (src/motor/funcoes.ts). Os casos dos slides da Aula 1 vêm de
 * casos-dos-slides.ts, já conferidos pelo oráculo; aqui o motor tem de chegar aos mesmos
 * números. Depois vem uma conferência numérica independente: funções sorteadas de cada tipo,
 * e tudo o que o motor afirma (domínio, imagem, raízes, pontos notáveis, período, assíntotas)
 * é testado ponto a ponto contra o valor da própria função.
 */
import { describe, expect, it } from 'vitest';
import { ErroDeEntrada, avaliar, lerExpressao, paraLeitura, paraTexto } from '../src/motor/expressao';
import { analisarFuncao, calcularEm, pertence, tabelaDeValores, valoresNotaveis } from '../src/motor/funcoes';
import type { AnaliseFuncao, TipoFuncao } from '../src/motor/funcoes';
import { numeroBonito, numeroParaLer } from '../src/motor/numeros';
import { angulos, quadraticas, validade } from './casos-dos-slides';

/** Os slides e os casos escrevem o menos com hífen; a tela, com o sinal de menos (−). */
const ascii = (texto: string): string => texto.replace(/−/g, '-');

describe('Funções: as quadráticas dos slides (Aula 1)', () => {
  for (const c of quadraticas) {
    it(`${c.id}: a = ${c.a}, b = ${c.b}, c = ${c.c} → Δ = ${c.delta}, V = (${c.vertice.join(', ')}), Im = ${c.imagem}`, () => {
      const r = analisarFuncao(`${c.a}*x^2 + (${c.b})*x + (${c.c})`);
      expect(r.tipo).toBe('quadrática');
      expect(r.quadratica).toEqual({ a: c.a, b: c.b, c: c.c, delta: c.delta, raizes: c.raizes, vertice: c.vertice });
      expect(r.raizes.valores).toEqual(c.raizes);
      expect(ascii(r.imagem.texto)).toBe(c.imagem);
      expect(r.pontos.find((p) => p.nome === 'vértice')).toMatchObject({ x: c.vertice[0], y: c.vertice[1] });
    });
  }

  it('F02: o desenho do slide marca raízes, mas com Δ < 0 o motor não acha nenhuma', () => {
    const r = analisarFuncao('x^2 - 2*x + 2');
    expect(r.raizes.valores).toEqual([]);
    expect(r.raizes.texto).toMatch(/não tem raiz real/);
    expect(r.passos.find((p) => p.aspecto === 'raízes')!.texto).toMatch(/Δ < 0/);
  });

  it('o passo a passo mostra a conta de Δ e do vértice com os números do slide', () => {
    const passos = analisarFuncao('x^2 - 4*x - 5').passos;
    expect(passos.find((p) => p.aspecto === 'raízes')!.texto).toContain('Δ = b² − 4ac = (−4)² − 4·1·(−5) = 36');
    expect(passos.find((p) => p.aspecto === 'vértice')!.texto).toContain('V = (2, −9)');
  });

  it('raízes irracionais saem exatas, com o valor aproximado ao lado', () => {
    expect(analisarFuncao('x^2 - 2*x - 1').raizes.texto).toBe('x₁ = 1 − √2 ≈ −0.4142 e x₂ = 1 + √2 ≈ 2.4142');
    expect(analisarFuncao('x^2 - 2').raizes.texto).toBe('x₁ = −√2 e x₂ = √2');
    expect(analisarFuncao('x^2 - 4*x + 4').raizes.texto).toBe('x = 2 (raiz dupla)');
  });
});

describe('Funções: entradas que mudam de tipo ou não valem (Aula 1)', () => {
  for (const c of validade) {
    it(`${c.id}: ${c.f}, declarada ${c.declarado} → ${c.resposta}`, () => {
      if (c.resposta === 'rejeitar') {
        expect(() => analisarFuncao(c.f)).toThrow(ErroDeEntrada);
        expect(() => analisarFuncao(c.f)).toThrow(/positiva e diferente de 1/);
        return;
      }
      const r = analisarFuncao(c.f);
      expect(r.tipo).toBe(c.resposta === 'tratar como afim' ? 'afim' : 'constante');
      expect(r.avisos.join(' ')).toMatch(/exige a ≠ 0/);
    });
  }

  it('termos que se cancelam também ganham o aviso', () => {
    const r = analisarFuncao('(x + 1)^2 - x^2');
    expect(r.tipo).toBe('afim');
    expect(r.avisos).toHaveLength(1);
    expect(paraTexto(r.forma)).toBe('2*x + 1');
  });

  it('quem já digita no tipo certo não recebe aviso', () => {
    for (const f of ['x^2 - 4*x - 5', '2*x + 1', '7', '2^x', 'sen(x)']) expect(analisarFuncao(f).avisos).toEqual([]);
  });

  const fora: [string, RegExp][] = [
    ['x^3 - x', /grau 3/],
    ['1/x', /Não reconheci o tipo/],
    ['sqrt(x)', /Não reconheci o tipo/],
    ['abs(x^2 - 4)', /módulo é de uma expressão do 1º grau/],
    ['2^(x^2)', /expoente da exponencial é do 1º grau/],
    ['ln(x^2)', /logaritmando é do 1º grau/],
    ['sen(x^2)', /argumento da trigonométrica é do 1º grau/],
    ['cotg(x)', /sen, cos e tg/],
    ['0*2^x + 3', /multiplicado por 0/],
    ['0^x', /positiva e diferente de 1/],
    ['log(x, 0)', /positiva e diferente de 1/],
  ];
  for (const [f, mensagem] of fora) {
    it(`${f} é recusada com o motivo`, () => {
      expect(() => analisarFuncao(f)).toThrow(ErroDeEntrada);
      expect(() => analisarFuncao(f)).toThrow(mensagem);
    });
  }
});

describe('Funções: valores notáveis das trigonométricas (Aula 1)', () => {
  for (const c of angulos) {
    it(`${c.id}: ${c.graus}° = ${c.rad} rad, cos ${c.cos}, sen ${c.sen}, tg ${c.tg}`, () => {
      expect(valoresNotaveis(c.graus)).toEqual({ rad: c.rad, sen: c.sen, cos: c.cos, tg: c.tg });
    });
  }

  for (const c of angulos.filter((caso) => caso.erroNoSlide)) {
    it(`${c.id}: o valor errado do slide seria reprovado (${c.erroNoSlide!.descricao})`, () => {
      const { descricao: _, ...errado } = c.erroNoSlide!;
      const certo = valoresNotaveis(c.graus);
      for (const [campo, valor] of Object.entries(errado)) {
        if (campo === 'graus') expect(valoresNotaveis(valor as number).rad).not.toBe(c.rad);
        else expect(certo[campo as 'rad' | 'sen' | 'cos' | 'tg']).not.toBe(valor);
      }
    });
  }
});

describe('Funções: o motor reconhece os oito tipos da Aula 1', () => {
  const casos: [string, TipoFuncao][] = [
    ['5', 'constante'],
    ['pi', 'constante'],
    ['x', 'linear'],
    ['-3*x', 'linear'],
    ['2*x + 1', 'afim'],
    ['(x + 1)*(x - 3)', 'quadrática'],
    ['2*(x - 1)^2 + 3', 'quadrática'],
    ['abs(x)', 'modular'],
    ['2*abs(x - 1) + 3', 'modular'],
    ['-abs(3 - 2*x)', 'modular'],
    ['2^x', 'exponencial'],
    ['e^x', 'exponencial'],
    ['exp(-2*x)', 'exponencial'],
    ['(1/2)^x', 'exponencial'],
    ['3*2^(x + 1) - 4', 'exponencial'],
    ['5 - 2^x', 'exponencial'],
    ['ln(x)', 'logarítmica'],
    ['log(x, 10)', 'logarítmica'],
    ['2*log(3 - x, 2) - 1', 'logarítmica'],
    ['ln(x)/ln(10)', 'logarítmica'],
    ['sen(x)', 'trigonométrica'],
    ['cos(x)', 'trigonométrica'],
    ['tg(x)', 'trigonométrica'],
    ['2*cos(3*x) + 1', 'trigonométrica'],
    ['sen(x - pi/2)', 'trigonométrica'],
  ];
  for (const [f, tipo] of casos) it(`${f} é ${tipo}`, () => expect(analisarFuncao(f).tipo).toBe(tipo));

  it('a forma geral mostra só os parâmetros que aparecem', () => {
    expect(analisarFuncao('80*0.85^x').formaGeral).toBe('f(x) = k·aˣ');
    expect(analisarFuncao('3*2^(x + 1) - 4').formaGeral).toBe('f(x) = k·a^(x + n) + d');
    expect(analisarFuncao('2*cos(3*x) + 1').formaGeral).toBe('f(x) = A·cos(Bx) + D');
    expect(analisarFuncao('abs(20*x - 100)').formaGeral).toBe('f(x) = |mx + n|');
    expect(analisarFuncao('log(2*x - 4, 3) + 1').parametros).toEqual([
      { nome: 'a', valor: 3 },
      { nome: 'm', valor: 2 },
      { nome: 'n', valor: -4 },
      { nome: 'd', valor: 1 },
    ]);
  });
});

describe('Funções: domínio, imagem e o resto que a Aula 1 pede', () => {
  const conjuntos: [string, string, string][] = [
    ['5', 'ℝ', '{5}'],
    ['2*x + 1', 'ℝ', 'ℝ'],
    ['x^2 - 4*x - 5', 'ℝ', '[−9, +∞)'],
    ['abs(x - 2) + 1', 'ℝ', '[1, +∞)'],
    ['-2*abs(x) + 3', 'ℝ', '(−∞, 3]'],
    ['2^x', 'ℝ', '(0, +∞)'],
    ['5 - 2^x', 'ℝ', '(−∞, 5)'],
    ['ln(x)', '(0, +∞)', 'ℝ'],
    ['log(4 - 2*x, 10)', '(−∞, 2)', 'ℝ'],
    ['sen(x)', 'ℝ', '[−1, 1]'],
    ['2*cos(3*x) + 1', 'ℝ', '[−1, 3]'],
    ['0.3 - 0.3*cos(x)', 'ℝ', '[0, 0.6]'],
    ['tg(x)', '{x ∈ ℝ | x ≠ π/2 + kπ}', 'ℝ'],
    ['tg(2*x - pi/4)', '{x ∈ ℝ | x ≠ 3π/8 + kπ/2}', 'ℝ'],
  ];
  for (const [f, dominio, imagem] of conjuntos) {
    it(`${f}: D = ${dominio}, Im = ${imagem}`, () => {
      const r = analisarFuncao(f);
      expect(r.dominio.texto).toBe(dominio);
      expect(r.imagem.texto).toBe(imagem);
    });
  }

  const raizes: [string, string][] = [
    ['2*x + 1', 'x = −1/2'],
    ['abs(x - 1) - 2', 'x = −1 e x = 3'],
    ['2^x - 8', 'x = 3'],
    ['log(x, 10) - 2', 'x = 100'],
    ['sen(x)', 'x = kπ, com k inteiro'],
    ['cos(x)', 'x = π/2 + kπ, com k inteiro'],
    ['0.3 - 0.3*cos(x)', 'x = 2kπ, com k inteiro'],
    ['2*sen(x) - 1', 'x = π/6 + 2kπ ou x = 5π/6 + 2kπ, com k inteiro'],
    ['sen(x) + 2', 'não tem'],
    ['2^x', 'não tem'],
  ];
  for (const [f, texto] of raizes) it(`raízes de ${f}: ${texto}`, () => expect(analisarFuncao(f).raizes.texto).toBe(texto));

  it('período, assíntotas e paridade', () => {
    expect(analisarFuncao('sen(x)').periodo).toBeCloseTo(2 * Math.PI, 12);
    expect(analisarFuncao('tg(x)').periodo).toBeCloseTo(Math.PI, 12);
    expect(analisarFuncao('cos(3*x)').periodo).toBeCloseTo((2 * Math.PI) / 3, 12);
    expect(analisarFuncao('3*2^(x + 1) - 4').assintotas.horizontal).toBe(-4);
    expect(analisarFuncao('ln(x)').assintotas.verticais).toEqual([0]);
    expect(analisarFuncao('log(2*x - 4, 3) + 1').assintotas.verticais).toEqual([2]);
    expect(analisarFuncao('tg(x)').assintotas.verticais.map((v) => v / Math.PI)).toEqual([-1.5, -0.5, 0.5, 1.5]);
    expect(analisarFuncao('cos(x)').caracteristicas).toContainEqual({ nome: 'Paridade', valor: 'par: f(−x) = f(x)' });
    expect(analisarFuncao('sen(x)').caracteristicas).toContainEqual({ nome: 'Paridade', valor: 'ímpar: f(−x) = −f(x)' });
  });

  it('crescimento pelo sinal de a e pela base', () => {
    const crescimento = (f: string) => analisarFuncao(f).caracteristicas.find((c) => c.nome === 'Crescimento')!.valor;
    expect(crescimento('2*x + 1')).toMatch(/^crescente/);
    expect(crescimento('-2*x + 1')).toMatch(/^decrescente/);
    expect(crescimento('2^x')).toBe('crescente');
    expect(crescimento('0.5^x')).toBe('decrescente');
    expect(crescimento('-(2^x)')).toBe('decrescente');
    expect(crescimento('log(x, 0.5)')).toBe('decrescente');
    expect(crescimento('-ln(x)')).toBe('decrescente');
    expect(crescimento('ln(-x)')).toBe('decrescente');
  });
});

describe('Funções: entradas e saídas', () => {
  it('f(3) em x² − 4x − 5: a conta com o número no lugar de x e a saída', () => {
    const v = calcularEm(analisarFuncao('x^2 - 4*x - 5'), '3');
    expect(paraTexto(v.conta)).toBe('3^2 - 4*3 - 5');
    expect(v.y).toBe(-8);
  });

  it('a entrada pode ter π e frações', () => {
    expect(calcularEm(analisarFuncao('sen(x)'), 'pi/6').y).toBeCloseTo(0.5, 12);
    expect(calcularEm(analisarFuncao('2^x'), '-1/2').y).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it('fora do domínio não há saída, nem onde o ponto flutuante daria um número enorme', () => {
    expect(calcularEm(analisarFuncao('ln(x)'), '-1').y).toBeNull();
    expect(calcularEm(analisarFuncao('ln(x)'), '0').y).toBeNull();
    expect(calcularEm(analisarFuncao('tg(x)'), 'pi/2').y).toBeNull();
  });

  it('entrada que não é número é recusada', () => {
    expect(() => calcularEm(analisarFuncao('2*x'), 'x + 1')).toThrow(ErroDeEntrada);
    expect(() => calcularEm(analisarFuncao('2*x'), 'ln(-1)')).toThrow(ErroDeEntrada);
  });

  it('a tabela da exponencial dobra a cada linha', () => {
    expect(tabelaDeValores(analisarFuncao('2^x')).map((l) => l.y)).toEqual([0.25, 0.5, 1, 2, 4, 8]);
  });

  it('a tabela das trigonométricas usa os ângulos notáveis, e a tg não existe em π/2 e 3π/2', () => {
    const sen = tabelaDeValores(analisarFuncao('sen(x)'));
    expect(sen.map((l) => numeroBonito(l.x))).toEqual(['0', 'pi/6', 'pi/4', 'pi/3', 'pi/2', 'pi', '3*pi/2', '2*pi']);
    expect(sen.map((l) => numeroBonito(l.y!))).toEqual(['0', '1/2', 'sqrt(2)/2', 'sqrt(3)/2', '1', '0', '-1', '0']);
    expect(tabelaDeValores(analisarFuncao('tg(x)')).map((l) => (l.y === null ? null : numeroBonito(l.y)))).toEqual([
      '0',
      'sqrt(3)/3',
      '1',
      'sqrt(3)',
      null,
      '0',
      null,
      '0',
    ]);
  });

  it('a tabela do logaritmo usa potências da base', () => {
    const tabela = tabelaDeValores(analisarFuncao('log(x, 10)'));
    expect(tabela.map((l) => l.x)).toEqual([0.1, 1, 10, 100]);
    expect(tabela.map((l) => l.y)).toEqual([-1, 0, 1, 2]);
  });
});

describe('Números e textos para ler', () => {
  it('raízes e múltiplos de π na escrita do leitor', () => {
    expect(numeroBonito(Math.sqrt(3) / 2)).toBe('sqrt(3)/2');
    expect(numeroBonito(2 * Math.sqrt(3))).toBe('2*sqrt(3)');
    expect(numeroBonito(-Math.sqrt(2) / 2)).toBe('-sqrt(2)/2');
    expect(numeroBonito((3 * Math.PI) / 8)).toBe('3*pi/8');
    expect(numeroBonito((2 * Math.PI) / 9)).toBe('2*pi/9');
    expect(numeroBonito(0.15)).toBe('0.15');
    expect(numeroParaLer(-Math.sqrt(3) / 3)).toBe('−√3/3');
    expect(numeroParaLer((3 * Math.PI) / 4)).toBe('3π/4');
  });

  it('e o que se escreve volta ao mesmo número', () => {
    for (const v of [Math.sqrt(3) / 2, -2 * Math.sqrt(5) / 3, (5 * Math.PI) / 12, 7 / 9, Math.E]) {
      expect(avaliar(lerExpressao(numeroBonito(v)))).toBeCloseTo(v, 12);
    }
  });

  const leituras: [string, string][] = [
    ['x^2 - 4*x - 5', 'x² − 4x − 5'],
    ['3*2^x', '3·2ˣ'],
    ['e^(-2*x)', 'e⁻²ˣ'],
    ['2^(x + 1)', '2^(x + 1)'],
    ['(1/2)^x', '(1/2)ˣ'],
    ['log(x, 10)', 'log₁₀ x'],
    ['log(2*x - 4, 3)', 'log₃(2x − 4)'],
    ['abs(x - 2)', '|x − 2|'],
    ['2*abs(x)', '2|x|'],
    ['2*sen(x)', '2 sen x'],
    ['sen(x)^2', 'sen² x'],
    ['sqrt(x + 1)', '√(x + 1)'],
    ['-x^2 + 4*x', '−x² + 4x'],
  ];
  for (const [texto, lido] of leituras) it(`${texto} se lê ${lido}`, () => expect(paraLeitura(lerExpressao(texto))).toBe(lido));
});

// ─── Conferência numérica ──────────────────────────────────────────────────────

/** Gerador pseudoaleatório com semente (mulberry32), o mesmo das outras conferências. */
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

/**
 * Confere a análise com a função: dentro do domínio f existe e cai na imagem; fora, não existe;
 * as raízes zeram f; os pontos notáveis estão na curva; as pontas fechadas da imagem são
 * atingidas; o período repete os valores; perto de uma assíntota vertical, f dispara.
 */
function conferir(a: AnaliseFuncao): void {
  const f = (t: number): number => avaliar(a.entrada, { x: t });
  const [x0, x1] = a.janela;
  const largura = x1 - x0;
  const amostras = Array.from({ length: 401 }, (_, i) => x0 - largura * 0.5 + (largura * 2 * i) / 400 + 1e-7 * Math.SQRT2);
  for (const t of amostras) {
    const y = f(t);
    if (pertence(a.dominio, t)) {
      expect(Number.isFinite(y), `f(${t}) deveria existir`).toBe(true);
      expect(pertence(a.imagem, y, 1e-9), `f(${t}) = ${y} fora de ${a.imagem.texto}`).toBe(true);
    } else {
      expect(Number.isNaN(y), `f(${t}) não deveria existir`).toBe(true);
    }
  }
  for (const r of a.raizes.valores) expect(Math.abs(f(r)), `f(${r}) deveria ser 0`).toBeLessThan(1e-9);
  for (const p of a.pontos) expect(f(p.x), `${p.nome} (${p.x}, ${p.y})`).toBeCloseTo(p.y, 9);
  for (const i of a.imagem.intervalos) {
    for (const [fechada, ponta] of [
      [i.fechadoDe, i.de],
      [i.fechadoAte, i.ate],
    ] as const) {
      if (!fechada) continue;
      const atinge = a.pontos.some((p) => Math.abs(p.y - ponta) < 1e-9 && Math.abs(f(p.x) - ponta) < 1e-9);
      expect(atinge, `a ponta ${ponta} de ${a.imagem.texto} deveria ser atingida num ponto notável`).toBe(true);
    }
  }
  if (a.periodo !== null) {
    for (const t of amostras.slice(0, 60)) {
      if (pertence(a.dominio, t) && pertence(a.dominio, t + a.periodo)) {
        // perto das assíntotas da tg os valores chegam a milhões: o erro é relativo
        const [antes, depois] = [f(t), f(t + a.periodo)];
        expect(Math.abs(depois - antes), `período ${a.periodo} em x = ${t}`).toBeLessThan(1e-6 * Math.max(1, Math.abs(antes)));
      }
    }
  }
  for (const v of a.assintotas.verticais) {
    const lado = pertence(a.dominio, v + 1e-9) ? 1 : -1;
    expect(Math.abs(f(v + lado * 1e-12) - f(v + lado * 1e-3)), `assíntota x = ${v}`).toBeGreaterThan(2);
  }
  for (const linha of tabelaDeValores(a)) {
    if (linha.y === null) expect(pertence(a.dominio, linha.x)).toBe(false);
    else expect(linha.y).toBeCloseTo(f(linha.x), 9);
  }
}

describe('Conferência numérica: o que o motor afirma bate com os valores da função', () => {
  const sorteio = gerador(20261113);
  const escolher = <T>(opcoes: T[]): T => opcoes[Math.floor(sorteio() * opcoes.length)]!;
  const naoNulo = () => escolher([-3, -2, -1, -0.5, 0.5, 1, 2, 3]);
  const qualquer = () => escolher([-3, -2, -1, 0, 1, 2, 3]);
  const formas: [TipoFuncao[], () => string][] = [
    [['constante'], () => `${qualquer()}`],
    [['linear', 'afim'], () => `${naoNulo()}*x + ${qualquer()}`],
    [['quadrática'], () => `${naoNulo()}*x^2 + ${qualquer()}*x + ${qualquer()}`],
    [['modular'], () => `${naoNulo()}*abs(${naoNulo()}*x + ${qualquer()}) + ${qualquer()}`],
    [['exponencial'], () => `${naoNulo()}*${escolher(['2', '3', '0.5', 'e', '(1/3)'])}^(${naoNulo()}*x + ${qualquer()}) + ${qualquer()}`],
    [['logarítmica'], () => `${naoNulo()}*log(${naoNulo()}*x + ${qualquer()}, ${escolher(['2', '3', '10', '0.5'])}) + ${qualquer()}`],
    [['logarítmica'], () => `${naoNulo()}*ln(${naoNulo()}*x + ${qualquer()}) + ${qualquer()}`],
    [['trigonométrica'], () => `${naoNulo()}*${escolher(['sen', 'cos', 'tg'])}(${naoNulo()}*x + ${qualquer()}) + ${qualquer()}`],
  ];
  for (const [tipos, gerar] of formas) {
    it(`${tipos.join(' e ')}: 40 funções sorteadas`, () => {
      for (let i = 0; i < 40; i++) {
        const texto = gerar();
        const a = analisarFuncao(texto);
        expect(tipos, texto).toContain(a.tipo);
        conferir(a);
      }
    });
  }
});
