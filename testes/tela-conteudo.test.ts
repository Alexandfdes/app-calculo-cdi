/**
 * O conteúdo das aulas (src/tela/conteudos.ts) não pode afirmar o que o motor não confirma.
 * Aqui se refaz cada botão "Calcular" do texto, cada linha das tabelas de derivadas, de
 * integrais e de limites especiais, e cada caso dos laboratórios. Onde dá, a conta também é
 * conferida por fora do motor (derivada numérica por diferença central), para que um erro no
 * texto não passe só porque o motor erra igual.
 */
import { describe, expect, it } from 'vitest';
import { integralDefinida } from '../src/motor/definidas';
import { derivar } from '../src/motor/derivadas';
import { avaliar, lerExpressao } from '../src/motor/expressao';
import type { Expr } from '../src/motor/expressao';
import { analisarFuncao } from '../src/motor/funcoes';
import { integrar } from '../src/motor/integrais';
import { calcularLimite, lerPonto } from '../src/motor/limites';
import {
  AULAS,
  CARRO,
  CONTAS,
  LAB_DERIVADAS,
  LAB_FUNCOES,
  LAB_INTEGRAIS,
  LAB_LIMITES,
  LIMITES_ESPECIAIS,
  TABELA_DERIVADAS,
  TABELA_INTEGRAIS,
  chegadaNaLombada,
  contaDaFrenagem,
  htmlDaAula,
  notacao,
  passoDaSecante,
  posicaoNoInstante,
  velocidadeNoInstante,
} from '../src/tela/conteudos';
import type { Conta } from '../src/tela/conteudos';

const PONTOS = [-2.3, -1.7, -0.9, -0.35, 0.4, 0.8, 1.3, 2.1, 2.9];
const valorDe = (e: Expr, x: number): number => avaliar(e, { x });
const ler = (texto: string): Expr => lerExpressao(texto);
const perto = (a: number, b: number, folga = 1e-9): boolean => Math.abs(a - b) <= folga * Math.max(1, Math.abs(a), Math.abs(b));

/** As duas expressões dão o mesmo valor onde ambas existem (em pelo menos três pontos). */
function mesmaFuncao(a: Expr, b: Expr, rotulo: string): void {
  let comparados = 0;
  for (const x of PONTOS) {
    const [va, vb] = [valorDe(a, x), valorDe(b, x)];
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    expect(perto(va, vb), `${rotulo} em x = ${x}: ${va} ≠ ${vb}`).toBe(true);
    comparados++;
  }
  expect(comparados, `${rotulo}: poucos pontos comparáveis`).toBeGreaterThanOrEqual(3);
}

/** F′ = f pela diferença central, sem passar pelo motor de derivadas. */
function derivadaConfere(F: Expr, f: Expr, rotulo: string): void {
  const h = 1e-5;
  let comparados = 0;
  for (const x of PONTOS) {
    const d = (valorDe(F, x + h) - valorDe(F, x - h)) / (2 * h);
    const v = valorDe(f, x);
    if (!Number.isFinite(d) || !Number.isFinite(v) || Math.abs(v) > 1e4) continue;
    expect(Math.abs(d - v), `${rotulo} em x = ${x}: derivada numérica ${d}, texto ${v}`).toBeLessThanOrEqual(1e-4 * Math.max(1, Math.abs(v)));
    comparados++;
  }
  expect(comparados, `${rotulo}: poucos pontos comparáveis`).toBeGreaterThanOrEqual(3);
}

/** Duas primitivas da mesma função diferem por uma constante. */
function diferemPorConstante(F: Expr, G: Expr, rotulo: string): void {
  const diferencas = PONTOS.map((x) => valorDe(F, x) - valorDe(G, x)).filter(Number.isFinite);
  expect(diferencas.length, `${rotulo}: poucos pontos comparáveis`).toBeGreaterThanOrEqual(3);
  for (const d of diferencas) expect(perto(d, diferencas[0]!), `${rotulo}: a diferença não é constante`).toBe(true);
}

function conferir(c: Conta): void {
  const rotulo = `${c.modo} ${c.f}`;
  switch (c.modo) {
    case 'funcao': {
      const a = analisarFuncao(c.f);
      expect(a.tipo, rotulo).toBe(c.resposta);
      if (c.imagem !== undefined) expect(a.imagem.texto, rotulo).toBe(c.imagem);
      if (c.vertice !== undefined) expect(a.quadratica?.vertice, rotulo).toEqual(c.vertice);
      return;
    }
    case 'limite': {
      const r = calcularLimite(c.f, c.ponto ?? '');
      if (c.resposta === 'não existe' || c.resposta === '+∞' || c.resposta === '-∞') expect(r.limite, rotulo).toBe(c.resposta);
      else {
        expect(typeof r.limite, rotulo).toBe('number');
        expect(perto(r.limite as number, avaliar(ler(c.resposta))), `${rotulo}: ${String(r.limite)}`).toBe(true);
      }
      if (c.descontinuidade !== undefined) expect(r.descontinuidade, rotulo).toBe(c.descontinuidade);
      return;
    }
    case 'derivada':
      mesmaFuncao(derivar(c.f).resultado, ler(c.resposta), rotulo);
      derivadaConfere(ler(c.f), ler(c.resposta), rotulo);
      return;
    case 'integral':
      derivadaConfere(ler(c.resposta), ler(c.f), rotulo);
      diferemPorConstante(integrar(c.f).resultado, ler(c.resposta), rotulo);
      return;
    case 'definida': {
      const r = integralDefinida(c.f, c.a ?? '', c.b ?? '');
      if (c.resposta === 'diverge') expect(r.valor, rotulo).toBe('diverge');
      else expect(perto(r.valor as number, avaliar(ler(c.resposta))), `${rotulo}: ${String(r.valor)}`).toBe(true);
    }
  }
}

describe('Contas do texto, refeitas no motor', () => {
  it('há contas das quatro aulas, de todos os modos', () => {
    expect(CONTAS.length).toBeGreaterThan(60);
    expect(new Set(CONTAS.map((c) => c.modo))).toEqual(new Set(['funcao', 'limite', 'derivada', 'integral', 'definida']));
  });

  it.each(CONTAS.map((c, i) => [i, c] as const))('conta %i: %o', (_, c) => conferir(c));
});

describe('Tabelas do conteúdo', () => {
  it.each(TABELA_DERIVADAS.map((l) => [l.f, l.df] as const))('(%s)′ = %s', (f, df) => {
    mesmaFuncao(derivar(f).resultado, ler(df), f);
    derivadaConfere(ler(f), ler(df), f);
  });

  it.each(TABELA_INTEGRAIS.map((l) => [l.f, l.F] as const))('∫ %s dx = %s + C', (f, F) => {
    derivadaConfere(ler(F), ler(f), f);
    diferemPorConstante(integrar(f).resultado, ler(F), f);
  });

  it('a linha de csc² x traz −cotg x, e não a de sec² x repetida, como no slide', () => {
    const linhas = TABELA_INTEGRAIS.filter((l) => l.F === '-cotg(x)');
    expect(linhas.map((l) => l.f)).toEqual(['csc(x)^2']);
  });

  it.each(LIMITES_ESPECIAIS.map((l) => [l.f, l.resposta] as const))('lim %s, com x → 0, = %s', (f, resposta) => {
    const r = calcularLimite(f, '0');
    expect(perto(r.limite as number, avaliar(ler(resposta)))).toBe(true);
  });

  it('os números soltos no texto conferem', () => {
    // valor intermediário: x³ − x − 1 troca de sinal entre 1 e 2
    expect(valorDe(ler('x^3 - x - 1'), 1)).toBe(-1);
    expect(valorDe(ler('x^3 - x - 1'), 2)).toBe(5);
    // máximo e mínimo locais de x³ − 3x
    expect(valorDe(ler('x^3 - 3*x'), -1)).toBe(2);
    expect(valorDe(ler('x^3 - 3*x'), 1)).toBe(-2);
    // sen 30, com 30 em radianos
    expect(Math.sin(30)).toBeCloseTo(-0.988, 3);
    // os quatro caminhos do vértice e a fatoração de x² − 4x − 5
    mesmaFuncao(ler('(x + 1)*(x - 5)'), ler('x^2 - 4*x - 5'), 'fatoração');
    mesmaFuncao(ler('(x - 2)^2 - 9'), ler('x^2 - 4*x - 5'), 'quadrado completo');
    expect(-((-1 - 5) ** 2) / 4).toBe(-9);
    // racionalização e a velocidade média do carro
    mesmaFuncao(ler('(sqrt(x + 1) - 1)/x'), ler('1/(sqrt(x + 1) + 1)'), 'racionalização');
    mesmaFuncao(ler('(20*x - 2*x^2)/x'), ler('20 - 2*x'), 'velocidade média');
    // por partes, que o motor não faz: (eˣ(x − 1))′ = x eˣ
    derivadaConfere(ler('e^x*(x - 1)'), ler('x*e^x'), 'por partes');
  });
});

describe('Laboratórios', () => {
  /** Valores do controle de min a max, passo a passo. */
  const grade = (p: { min: number; max: number; passo: number }): number[] => {
    const casas = (String(p.passo).split('.')[1] ?? '').length;
    const valores: number[] = [];
    for (let v = p.min; v <= p.max + 1e-9; v += p.passo) valores.push(Number(v.toFixed(casas)));
    return valores;
  };

  it.each(LAB_FUNCOES.map((t) => [t.rotulo, t] as const))('%s: cada posição dos controles dá o tipo certo, ou o laboratório avisa', (_, t) => {
    const iniciais = Object.fromEntries(t.parametros.map((p) => [p.nome, p.inicial]));
    const combinacoes: Record<string, number>[] = [iniciais];
    // cada controle percorrido sozinho, os outros parados
    for (const p of t.parametros) for (const v of grade(p)) combinacoes.push({ ...iniciais, [p.nome]: v });
    // e alguns sorteios com todos mexidos (gerador fixo, para o teste se repetir)
    let semente = 20261114;
    const sortear = (): number => {
      semente = (semente * 1103515245 + 12345) % 2 ** 31;
      return semente / 2 ** 31;
    };
    for (let i = 0; i < 40; i++) combinacoes.push(Object.fromEntries(t.parametros.map((p) => [p.nome, grade(p)[Math.floor(sortear() * grade(p).length)]!])));
    for (const variante of t.variantes ?? ['']) {
      for (const p of combinacoes) {
        const texto = t.montar(p, variante);
        const aviso = t.foraDoTipo(p);
        let tipo: string;
        try {
          tipo = analisarFuncao(texto).tipo;
        } catch {
          tipo = 'recusada';
        }
        if (aviso === null) expect(tipo, `${texto} com ${JSON.stringify(p)}`).toBe(t.tipo);
        else expect(tipo, `${texto}: o aviso diz que sai do tipo`).not.toBe(t.tipo);
      }
    }
  });

  it.each(LAB_LIMITES.map((c) => [c.rotulo, c] as const))('limite, %s: o motor calcula, e a janela mostra o ponto', (_, c) => {
    expect(lerPonto(c.ponto).a).toBe(c.a);
    const r = calcularLimite(c.f, c.ponto);
    expect(r.esquerda).toBeDefined();
    expect(c.janela[0] < c.a && c.a < c.janela[1]).toBe(true);
    expect(c.a - c.hMax).toBeGreaterThanOrEqual(c.janela[0]);
    expect(c.a + c.hMax).toBeLessThanOrEqual(c.janela[1]);
  });

  it.each(LAB_DERIVADAS.map((c) => [c.rotulo, c] as const))('derivada, %s: o motor deriva, e P e Q cabem na janela', (_, c) => {
    const df = derivar(c.f).resultado;
    derivadaConfere(ler(c.f), df, c.f);
    expect(c.faixa[0] <= c.x0 && c.x0 <= c.faixa[1]).toBe(true);
    expect(c.janela[0] <= c.faixa[0] && c.faixa[1] <= c.janela[1]).toBe(true);
    // em todo ponto que o controle alcança, com h no começo, no meio e no fim do caminho
    for (let x0 = c.faixa[0]; x0 <= c.faixa[1] + 1e-9; x0 += 0.05) {
      for (const fracao of [0, 0.5, 1]) {
        const h = passoDaSecante(c, x0, fracao);
        expect(Math.abs(h)).toBeGreaterThan(0);
        expect(x0 + h, `x0 = ${x0}, h = ${h}`).toBeGreaterThanOrEqual(c.janela[0]);
        expect(x0 + h, `x0 = ${x0}, h = ${h}`).toBeLessThanOrEqual(c.janela[1]);
      }
    }
  });

  it.each(LAB_INTEGRAIS.map((c) => [c.rotulo, c] as const))('integral, %s: o motor dá um valor, e a e b cabem na janela', (_, c) => {
    const r = integralDefinida(c.f, c.a, c.b);
    expect(typeof r.valor).toBe('number');
    const [a, b] = [avaliar(ler(c.a)), avaliar(ler(c.b))];
    expect(c.janela[0] < a && b < c.janela[1]).toBe(true);
  });
});

describe('O carro chegando na lombada', () => {
  it('com 1 s de reação e freada de 4 m/s², chega em t = 4 s a 8 m/s (28,8 km/h): 20 m de reação e 42 m freando', () => {
    const c = chegadaNaLombada(CARRO.reacao, CARRO.freada);
    expect(c.parou).toBe(false);
    expect(c.tempo).toBeCloseTo(4, 12);
    expect(c.velocidade).toBeCloseTo(8, 12);
    expect(c.velocidade * 3.6).toBeCloseTo(28.8, 12);
    expect([c.reacaoM, c.frenagemM]).toEqual([20, 42]);
  });

  it('as contas da história batem com o motor', () => {
    expect(analisarFuncao('-2*x^2 + 24*x - 2').quadratica?.vertice).toEqual([6, 70]);
    expect(valorDe(ler('-2*x^2 + 24*x - 2'), 1)).toBe(20); // o freio entra nos 20 m
    expect(valorDe(ler('-2*x^2 + 24*x - 2'), 4)).toBe(62); // e o carro chega à lombada em t = 4
    mesmaFuncao(derivar('-2*x^2 + 24*x - 2').resultado, ler('24 - 4*x'), 'v = s′');
    expect(integralDefinida('20', '0', '1').valor).toBeCloseTo(20, 12);
    expect(integralDefinida('24 - 4*x', '1', '4').valor).toBeCloseTo(42, 12);
    const aceleracao = calcularLimite('x < 1 ? 0 : -4', '1');
    expect([aceleracao.esquerda, aceleracao.direita, aceleracao.descontinuidade]).toEqual([0, -4, 'salto']);
    const velocidade = calcularLimite('x < 1 ? 20 : 24 - 4*x', '1');
    expect(velocidade.limite).toBe(20);
    expect(velocidade.descontinuidade).toBeUndefined();
    // a primitiva da velocidade é a posição, a menos da constante (C = −2)
    diferemPorConstante(integrar('24 - 4*x').resultado, ler('-2*x^2 + 24*x - 2'), 'posição');
  });

  it('o número do texto: com 1,5 s de reação sobram 32 m para frear e o carro chega a 43,2 km/h', () => {
    const c = chegadaNaLombada(1.5, CARRO.freada);
    expect(c.frenagemM).toBe(32);
    expect(c.velocidade * 3.6).toBeCloseTo(43.2, 12);
  });

  it('em toda posição dos controles, o carro chega à lombada (ou para antes), e o motor confirma os metros freando', () => {
    const reacoes = Array.from({ length: 16 }, (_, i) => Number((0.5 + 0.1 * i).toFixed(1)));
    const freadas = Array.from({ length: 11 }, (_, i) => 2 + 0.5 * i);
    let pararam = 0;
    for (const r of reacoes) {
      for (const a of freadas) {
        const c = chegadaNaLombada(r, a);
        const rotulo = `reação ${r} s, freada ${a} m/s²`;
        if (c.parou) {
          pararam++;
          expect(posicaoNoInstante(c, c.tempo), rotulo).toBeLessThanOrEqual(CARRO.distancia + 1e-9);
        } else expect(posicaoNoInstante(c, c.tempo), rotulo).toBeCloseTo(CARRO.distancia, 9);
        expect(velocidadeNoInstante(c, c.tempo), rotulo).toBeCloseTo(c.velocidade, 9);
        // a posição do laboratório é a integral da velocidade: a derivada numérica volta a ela
        for (const t of [0.3, r + 0.2, (r + c.tempo) / 2]) {
          const d = (posicaoNoInstante(c, t + 1e-6) - posicaoNoInstante(c, t - 1e-6)) / 2e-6;
          expect(d, `${rotulo}, t = ${t}`).toBeCloseTo(velocidadeNoInstante(c, t), 4);
        }
        // a conta que o botão abre na calculadora dá os mesmos metros freando
        const conta = contaDaFrenagem(c);
        conferir(conta);
        expect(integralDefinida(conta.f, conta.a ?? '', conta.b ?? '').valor as number, rotulo).toBeCloseTo(c.frenagemM, 9);
      }
    }
    expect(pararam).toBeGreaterThan(0); // freada forte e reação rápida: para antes da lombada
  });
});

describe('HTML das aulas', () => {
  const VAZIOS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr']);

  /** As tags abrem e fecham na ordem certa. */
  function balanceado(html: string): string[] {
    const pilha: string[] = [];
    const erros: string[] = [];
    for (const m of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/gi)) {
      const [, fecha, nome, autoFechada] = m;
      const tag = nome!.toLowerCase();
      if (VAZIOS.has(tag) || autoFechada) continue;
      if (!fecha) pilha.push(tag);
      else if (pilha.pop() !== tag) erros.push(`</${tag}> fora de ordem perto de "${html.slice(Math.max(0, m.index - 60), m.index + 10)}"`);
    }
    return [...erros, ...pilha.map((t) => `<${t}> sem fechar`)];
  }

  it.each(AULAS.map((a) => [a.titulo, a] as const))('%s: tags fechadas, botões e laboratórios válidos', (_, aula) => {
    const html = htmlDaAula(aula);
    expect(balanceado(html)).toEqual([]);
    for (const m of html.matchAll(/data-conta="(\d+)"/g)) expect(Number(m[1])).toBeLessThan(CONTAS.length);
    for (const m of html.matchAll(/data-lab="([a-z]+)"/g)) expect(['funcoes', 'circulo', 'limites', 'derivadas', 'integrais', 'lombada']).toContain(m[1]);
    expect(html).not.toMatch(/undefined|NaN/);
  });

  it('cada aula tem um laboratório e o exemplo do carro', () => {
    for (const aula of AULAS) {
      const html = htmlDaAula(aula);
      expect(html).toContain('data-lab=');
      expect(html).toContain('class="historia cartao"');
      expect(html).toContain('data-lab="lombada"');
    }
  });
});

describe('Notação das fórmulas escritas à mão', () => {
  it('expoente, índice, fração, raiz, limite e integral', () => {
    expect(notacao('x^2')).toBe('<i class="v">x</i><sup>2</sup>');
    expect(notacao('x_v')).toBe('<i class="v">x</i><sub><i class="v">v</i></sub>');
    expect(notacao('x^{n-1}')).toBe('<i class="v">x</i><sup><i class="v">n</i>−1</sup>');
    expect(notacao('#f{a}{b}')).toContain('<span class="frac-num"><i class="v">a</i></span><span class="frac-den"><i class="v">b</i></span>');
    expect(notacao('#r{x}')).toContain('class="raiz-sinal">√');
    expect(notacao('#lim{x → 0}')).toContain('<span class="lim-sub"><i class="v">x</i> → 0</span>');
    expect(notacao('#int{0}{π}')).toContain('<span class="int-limites"><span>π</span><span>0</span></span>');
    expect(notacao('#dx')).toBe('<span class="dx">d<i class="v">x</i></span>');
  });

  it('sen, cos e ln retos; letras soltas em itálico; operadores com espaço', () => {
    expect(notacao('sen x')).toBe('<span class="fn">sen</span> <i class="v">x</i>');
    expect(notacao('a - b')).toBe('<i class="v">a</i><span class="op">−</span><i class="v">b</i>');
    expect(notacao("f'(x)")).toBe('<i class="v">f</i>′(<i class="v">x</i>)');
    expect(notacao('#{b#}')).toBe('{<i class="v">b</i>}');
    expect(notacao('x < 5')).toBe('<i class="v">x</i> &lt; 5');
  });

  it('erro de digitação na fórmula aparece na hora', () => {
    expect(() => notacao('#f{a}{b')).toThrow(/Chave sem par/);
    expect(() => notacao('#xyz{a}')).toThrow(/desconhecido/);
  });
});
