/**
 * O conteúdo das Aulas 1 a 4 para a vista "Conteúdo das aulas": a ordem e a notação dos
 * slides, em cartões, com exemplos que abrem na calculadora e um laboratório por aula.
 *
 * Toda conta que o texto afirma passa pelo motor. Os botões "Calcular" ficam em CONTAS, e as
 * tabelas em TABELA_DERIVADAS, TABELA_INTEGRAIS e LIMITES_ESPECIAIS; o teste
 * testes/tela-conteudo.test.ts refaz cada uma, e o texto não pode afirmar o que o motor não
 * confirma. As tabelas de valores (2x + 1, o limite de (x² − 4)/(x − 2), os ângulos notáveis)
 * são calculadas pelo motor, não digitadas. Onde o slide erra (sec² x no lugar de csc² x na
 * tabela de integrais, pontos trocados no círculo trigonométrico), o texto traz a forma certa.
 *
 * Sem DOM: só monta HTML, para o teste rodar no Node. O desenho dos laboratórios fica em
 * laboratorios.ts; aqui ficam os casos de cada um, para o teste conferir também.
 */
import { lerExpressao } from '../motor/expressao';
import { analisarFuncao, tabelaDeValores, valoresNotaveis } from '../motor/funcoes';
import type { TipoFuncao } from '../motor/funcoes';
import { avaliarFuncao, lerFuncaoDoLimite } from '../motor/limites';
import type { Descontinuidade } from '../motor/limites';
import { escapar, formulaHTML, integralHTML } from './formula';

export type IdAula = 'funcoes' | 'limites' | 'derivadas' | 'integrais';
export type ModoDaConta = 'funcao' | 'limite' | 'derivada' | 'integral' | 'definida';
export type TipoDeLaboratorio = 'funcoes' | 'circulo' | 'limites' | 'derivadas' | 'integrais' | 'lombada';
/** Trecho do plano: x de x0 a x1, y de y0 a y1. */
export type Janela = [number, number, number, number];

/** Uma conta do texto, que o botão "Calcular" abre na calculadora. */
export interface Conta {
  modo: ModoDaConta;
  f: string;
  /** Limite: para onde x vai. */
  ponto?: string;
  /** Integral definida: de a até b. */
  a?: string;
  b?: string;
  /**
   * O que o texto afirma, conferido no motor pelo teste: o tipo (função); o valor do limite
   * ('4', '1/2', '+∞', 'não existe'); a derivada ou a primitiva, sem o + C; o valor da integral
   * definida ou 'diverge'. 'por partes' marca a integral que o motor recusa com esse aviso.
   */
  resposta: string;
  /** Função: a imagem e o vértice que o texto mostra. */
  imagem?: string;
  vertice?: [number, number];
  /** Limite: o tipo de descontinuidade que o texto diz. */
  descontinuidade?: Descontinuidade;
}

export interface Cartao {
  titulo: string;
  /** Cor de destaque, como os quadros coloridos dos slides. */
  cor: string;
  html: string;
  /** Ocupa a largura toda da grade. */
  largo?: boolean;
}

export interface Aula {
  id: IdAula;
  numero: number;
  titulo: string;
  chamada: string;
  ideia: string;
  cartoes: Cartao[];
}

// ─── Fórmulas escritas à mão ───────────────────────────────────────────────────

const FUNCOES_RETAS = new Set(['sen', 'cos', 'tg', 'cotg', 'sec', 'csc', 'ln', 'log', 'lim']);
const LETRAS_RETAS = new Set(['ℝ', 'ℕ', 'ℤ', 'π', 'Δ']);
const eLetra = (c: string): boolean => /\p{L}/u.test(c) && !LETRAS_RETAS.has(c);
const OPERADORES: [string, string][] = [
  [' = ', '<span class="op">=</span>'],
  [' + ', '<span class="op">+</span>'],
  [' - ', '<span class="op">−</span>'],
  [' ± ', '<span class="op">±</span>'],
];

const fracao = (num: string, den: string): string =>
  `<span class="frac"><span class="frac-num">${num}</span><span class="frac-den">${den}</span></span>`;
const raiz = (dentro: string): string => `<span class="raiz"><span class="raiz-sinal">√</span><span class="raiz-dentro">${dentro}</span></span>`;
const limite = (embaixo: string): string =>
  `<span class="lim"><span class="lim-nome">lim</span><span class="lim-sub">${embaixo}</span></span><span class="esp"></span>`;
const integralDeAaB = (a: string, b: string): string =>
  `<span class="int-def"><span class="int">∫</span><span class="int-limites"><span>${b}</span><span>${a}</span></span></span>`;

/**
 * Fórmula escrita à mão, numa notação curta:
 * - ^ e _ para expoente e índice, com {…} quando é mais de um caractere: x^{n-1}, log_a, x_1;
 * - #f{num}{den} (fração), #r{…} (raiz), #lim{x → a}, #int (∫), #int{a}{b} (∫ de a até b),
 *   #ddx (d/dx), #dx, #du, #dt, #dv (o d do diferencial), #t{texto} (texto reto), #{ e #};
 * - letra solta vira variável em itálico; sen, cos, tg, ln, log e lim ficam retos;
 * - " = ", " + " e " - " ganham espaço de operador; - vira −, * vira · e ' vira ′.
 */
export function notacao(s: string): string {
  let i = 0;
  let saida = '';
  const grupo = (): string => {
    if (s[i] !== '{') {
      const c = s[i] ?? '';
      i += 1;
      return c;
    }
    let nivel = 0;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (c === '#') j += 1;
      else if (c === '{') nivel += 1;
      else if (c === '}' && --nivel === 0) {
        const dentro = s.slice(i + 1, j);
        i = j + 1;
        return dentro;
      }
    }
    throw new Error(`Chave sem par na fórmula "${s}"`);
  };
  while (i < s.length) {
    const c = s[i]!;
    if (c === '#') {
      const seguinte = s[i + 1];
      if (seguinte === '{' || seguinte === '}') {
        saida += seguinte;
        i += 2;
        continue;
      }
      const nome = /^[a-z]+/.exec(s.slice(i + 1))?.[0] ?? '';
      i += 1 + nome.length;
      if (nome === 'f') {
        const num = grupo();
        saida += fracao(notacao(num), notacao(grupo()));
      } else if (nome === 'r') saida += raiz(notacao(grupo()));
      else if (nome === 'lim') saida += limite(notacao(grupo()));
      else if (nome === 'int') {
        if (s[i] === '{') {
          const a = grupo();
          saida += integralDeAaB(notacao(a), notacao(grupo()));
        } else saida += '<span class="int">∫</span>';
      } else if (nome === 'ddx') saida += fracao('d', 'd<i class="v">x</i>');
      else if (nome === 't') saida += `<span class="tx">${grupo()}</span>`;
      else if (nome.length === 2 && nome.startsWith('d')) saida += `<span class="dx">d<i class="v">${nome[1]}</i></span>`;
      else throw new Error(`Comando #${nome} desconhecido na fórmula "${s}"`);
      continue;
    }
    if (c === '^' || c === '_') {
      i += 1;
      const dentro = notacao(grupo());
      saida += c === '^' ? `<sup>${dentro}</sup>` : `<sub>${dentro}</sub>`;
      continue;
    }
    const operador = OPERADORES.find(([texto]) => s.startsWith(texto, i));
    if (operador) {
      saida += operador[1];
      i += operador[0].length;
      continue;
    }
    if (eLetra(c)) {
      let j = i;
      while (j < s.length && eLetra(s[j]!)) j += 1;
      const palavra = s.slice(i, j);
      i = j;
      saida += FUNCOES_RETAS.has(palavra) ? `<span class="fn">${palavra}</span>` : [...palavra].map((l) => `<i class="v">${l}</i>`).join('');
      continue;
    }
    const trocas: Record<string, string> = { '-': '−', '*': '<span class="op-mul">·</span>', "'": '′', '<': '&lt;', '>': '&gt;', '&': '&amp;' };
    saida += trocas[c] ?? c;
    i += 1;
  }
  return saida;
}

/** Fórmula no meio do texto. */
const m = (s: string): string => `<span class="formula">${notacao(s)}</span>`;
/** Fórmula em destaque, centralizada; várias lado a lado. */
const bloco = (...fontes: string[]): string => `<p class="formula bloco">${fontes.map((f) => `<span>${notacao(f)}</span>`).join('')}</p>`;
/** Expressão na escrita da calculadora (x^2 - 4*x - 5), mostrada pelo mesmo código da tela. */
const F = (texto: string): string => `<span class="formula">${formulaHTML(lerExpressao(texto))}</span>`;
/** f(x) = …, com a expressão na escrita da calculadora. */
const fx = (texto: string, nome = 'f'): string => `<span class="formula">${notacao(`${nome}(x) = `)}${formulaHTML(lerExpressao(texto))}</span>`;
/** (f)′ = f′ para as tabelas de derivadas. */
const derivadaDe = (f: string, df: string): string =>
  `<span class="formula">(${formulaHTML(lerExpressao(f))})′<span class="op">=</span>${formulaHTML(lerExpressao(df))}</span>`;
/** ∫ f(x) dx = F(x) + C para as tabelas de integrais. */
const integralDe = (f: string, primitiva: string): string =>
  `<span class="formula">${integralHTML(lerExpressao(f), 'x')}<span class="op">=</span>${formulaHTML(lerExpressao(primitiva))}<span class="op">+</span><i class="c">C</i></span>`;

/** Número de uma tabela calculada: até 6 algarismos, com o sinal de menos tipográfico. */
const numero = (v: number): string => String(Number(v.toPrecision(6))).replace('-', '−');

// ─── Contas que abrem na calculadora ───────────────────────────────────────────

/** Toda conta com botão no texto; o teste confere cada uma no motor. */
export const CONTAS: Conta[] = [];

const DESCRICAO: Record<ModoDaConta, (c: Conta) => string> = {
  funcao: (c) => `estudar f(x) = ${c.f}`,
  limite: (c) => `limite de ${c.f} com x indo a ${c.ponto ?? ''}`,
  derivada: (c) => `derivada de ${c.f}`,
  integral: (c) => `integral de ${c.f}`,
  definida: (c) => `integral de ${c.f} de ${c.a ?? ''} a ${c.b ?? ''}`,
};

/** Botão que leva a conta para a calculadora. */
function calcular(c: Conta, rotulo = 'Calcular'): string {
  const i = CONTAS.push(c) - 1;
  const descricao = `${rotulo}: ${DESCRICAO[c.modo](c)}, na calculadora`;
  return `<button type="button" class="conta" data-conta="${i}" aria-label="${escapar(descricao)}">${escapar(rotulo)}<span aria-hidden="true"> ↗</span></button>`;
}

// ─── Tabelas calculadas pelo motor ─────────────────────────────────────────────

/** Entradas e saídas de f, deitadas como na calculadora. */
function tabelaDeEntradas(texto: string, xs: number[]): string {
  const linhas = tabelaDeValores(analisarFuncao(texto), xs);
  const celulas = (valores: string[]): string => valores.map((v) => `<td>${v}</td>`).join('');
  return `<div class="rolagem"><table class="tabela tabela-deitada">
    <tr><th scope="row">${m('x')}</th>${celulas(linhas.map((l) => numero(l.x)))}</tr>
    <tr><th scope="row">${m('f(x)')}</th>${celulas(linhas.map((l) => (l.y === null ? '∄' : numero(l.y))))}</tr>
  </table></div>`;
}

/** x chegando perto de a pelos dois lados, com f(a) no meio. */
function tabelaDoLimite(texto: string, a: number, esquerda: number[], direita: number[]): string {
  const f = lerFuncaoDoLimite(texto);
  const valor = (t: number): string => {
    const y = avaliarFuncao(f, t);
    return Number.isFinite(y) ? numero(y) : 'não existe';
  };
  const coluna = (t: number, classe = ''): [string, string] => [`<td${classe}>${numero(t)}</td>`, `<td${classe}>${valor(t)}</td>`];
  const colunas = [...esquerda.map((t) => coluna(t)), coluna(a, ' class="no-ponto"'), ...direita.map((t) => coluna(t))];
  return `<div class="rolagem"><table class="tabela tabela-deitada tabela-limite">
    <tr><th scope="row">${m('x')}</th>${colunas.map((c) => c[0]).join('')}</tr>
    <tr><th scope="row">${m('f(x)')}</th>${colunas.map((c) => c[1]).join('')}</tr>
  </table></div>`;
}

/** A tabela de valores notáveis do slide das trigonométricas, saída do motor. */
function tabelaDosAngulos(): string {
  const graus = [0, 30, 45, 60, 90, 180, 270, 360];
  const valores = graus.map((g) => valoresNotaveis(g));
  const celula = (s: string): string => (s === 'indefinida' ? '<td class="nao-existe">∄</td>' : `<td>${F(s)}</td>`);
  const linha = (rotulo: string, chave: 'rad' | 'sen' | 'cos' | 'tg'): string =>
    `<tr><th scope="row">${rotulo}</th>${valores.map((v) => celula(v[chave])).join('')}</tr>`;
  return `<div class="rolagem"><table class="tabela-aula angulos">
    <thead><tr><th scope="col">${m('θ')} (graus)</th>${graus.map((g) => `<th scope="col">${g}°</th>`).join('')}</tr></thead>
    <tbody>${linha(`${m('θ')} (rad)`, 'rad')}${linha(m('sen θ'), 'sen')}${linha(m('cos θ'), 'cos')}${linha(m('tg θ'), 'tg')}</tbody>
  </table></div>
  <p class="nota-tabela">∄: a tangente não existe em 90° e em 270°, onde ${m('cos θ = 0')}.</p>`;
}

// ─── Aula 1: Funções ───────────────────────────────────────────────────────────

const TIPOS: { nome: string; lei: string; dominio: string; imagem: string; reconhecer: string; conta: Conta }[] = [
  {
    nome: 'Constante',
    lei: m('f(x) = b'),
    dominio: m('ℝ'),
    imagem: m('#{b#}'),
    reconhecer: 'Reta horizontal: a saída não muda.',
    conta: { modo: 'funcao', f: '3', resposta: 'constante', imagem: '{3}' },
  },
  {
    nome: 'Linear',
    lei: `${m('f(x) = ax')}, ${m('a ≠ 0')}`,
    dominio: m('ℝ'),
    imagem: m('ℝ'),
    reconhecer: `Reta pela origem; sobe se ${m('a > 0')} e desce se ${m('a < 0')}.`,
    conta: { modo: 'funcao', f: '2*x', resposta: 'linear', imagem: 'ℝ' },
  },
  {
    nome: 'Afim',
    lei: `${m('f(x) = ax + b')}, ${m('a ≠ 0')}`,
    dominio: m('ℝ'),
    imagem: m('ℝ'),
    reconhecer: `${m('a')} é a inclinação e ${m('b')}, o corte no eixo ${m('y')}; a raiz é ${m('x = -#f{b}{a}')}.`,
    conta: { modo: 'funcao', f: '-2*x + 4', resposta: 'afim', imagem: 'ℝ' },
  },
  {
    nome: 'Quadrática',
    lei: `${m('f(x) = ax^2 + bx + c')}, ${m('a ≠ 0')}`,
    dominio: m('ℝ'),
    imagem: `${m('[y_v, +∞)')} se ${m('a > 0')}; ${m('(-∞, y_v]')} se ${m('a < 0')}`,
    reconhecer: `Parábola com vértice em ${m('x_v = -#f{b}{2a}')}.`,
    conta: { modo: 'funcao', f: 'x^2 - 4*x - 5', resposta: 'quadrática', imagem: '[−9, +∞)' },
  },
  {
    nome: 'Modular',
    lei: m('f(x) = |x|'),
    dominio: m('ℝ'),
    imagem: m('[0, +∞)'),
    reconhecer: `Gráfico em V, com bico em ${m('x = 0')}; nunca é negativa.`,
    conta: { modo: 'funcao', f: 'abs(x - 2)', resposta: 'modular', imagem: '[0, +∞)' },
  },
  {
    nome: 'Exponencial',
    lei: `${m('f(x) = a^x')}, ${m('a > 0')} e ${m('a ≠ 1')}`,
    dominio: m('ℝ'),
    imagem: m('(0, +∞)'),
    reconhecer: `Passa por ${m('(0, 1)')}; cresce se ${m('a > 1')} e decresce se ${m('0 < a < 1')}.`,
    conta: { modo: 'funcao', f: '2^x', resposta: 'exponencial', imagem: '(0, +∞)' },
  },
  {
    nome: 'Logarítmica',
    lei: `${m('f(x) = log_a x')}, ${m('a > 0')} e ${m('a ≠ 1')}`,
    dominio: m('(0, +∞)'),
    imagem: m('ℝ'),
    reconhecer: `Passa por ${m('(1, 0)')}; é a inversa da exponencial.`,
    conta: { modo: 'funcao', f: 'log(x, 2)', resposta: 'logarítmica', imagem: 'ℝ' },
  },
  {
    nome: 'Trigonométrica',
    lei: `${m('sen x')} e ${m('cos x')}`,
    dominio: m('ℝ'),
    imagem: m('[-1, 1]'),
    reconhecer: `Ondas que se repetem a cada ${m('2π')}.`,
    conta: { modo: 'funcao', f: 'sen(x)', resposta: 'trigonométrica', imagem: '[−1, 1]' },
  },
  {
    nome: 'Trigonométrica',
    lei: m('tg x'),
    dominio: m('ℝ - #{#f{π}{2} + kπ#}'),
    imagem: m('ℝ'),
    reconhecer: `Não existe onde ${m('cos x = 0')}; repete a cada ${m('π')}.`,
    conta: { modo: 'funcao', f: 'tg(x)', resposta: 'trigonométrica', imagem: 'ℝ' },
  },
];

const funcoes: Aula = {
  id: 'funcoes',
  numero: 1,
  titulo: 'Funções',
  chamada: 'Uma regra que transforma cada entrada em uma única saída.',
  ideia: `Uma <strong>função</strong> associa a cada elemento ${m('x')} do domínio um único valor ${m('f(x)')}. Pense numa máquina: entra ${m('x')}, sai ${m('f(x)')}. Cada tipo de função tem uma lei, um formato de gráfico e um comportamento próprios, e reconhecê-los é o primeiro passo para as outras aulas.`,
  cartoes: [
    {
      titulo: 'Laboratório: mexa nos parâmetros',
      cor: '#22d3ee',
      largo: true,
      html: `<p>Escolha um tipo e arraste os controles: o gráfico, o domínio (em verde, no eixo ${m('x')}) e a imagem (em roxo, no eixo ${m('y')}) mudam na hora. Passe o mouse ou o dedo sobre o gráfico para escolher uma entrada e ver a saída. As contas vêm do mesmo motor da calculadora.</p>
      <div class="lab" data-lab="funcoes"></div>`,
    },
    {
      titulo: 'Entrada, saída, domínio e imagem',
      cor: '#38bdf8',
      html: `<p>Uma função é uma regra que leva cada entrada ${m('x')} a <strong>uma única</strong> saída ${m('y = f(x)')}.</p>
      <dl class="definicoes">
        <div><dt>Domínio</dt><dd>As entradas que a regra aceita. Em ${m('f(x) = ln x')}, só os ${m('x > 0')}.</dd></div>
        <div><dt>Contradomínio</dt><dd>Onde as saídas podem cair; em geral, ${m('ℝ')}.</dd></div>
        <div><dt>Imagem</dt><dd>As saídas que de fato aparecem. Em ${m('f(x) = x^2')}, a imagem é ${m('[0, +∞)')}: nenhuma saída é negativa.</dd></div>
      </dl>
      <div class="exemplo">
        <p class="exemplo-titulo">Exemplo</p>
        <p>${fx('2*x + 1')}:</p>
        ${tabelaDeEntradas('2*x + 1', [-1, 0, 1, 2, 3])}
        <p>Cada entrada tem uma só saída, e a reta sobe sem parar: toda saída real aparece. Domínio ${m('ℝ')} e imagem ${m('ℝ')}.</p>
        ${calcular({ modo: 'funcao', f: '2*x + 1', resposta: 'afim', imagem: 'ℝ' })}
      </div>`,
    },
    {
      titulo: 'Os oito tipos de função',
      cor: '#a78bfa',
      largo: true,
      html: `<p>Cada tipo tem sua lei, seu domínio e sua imagem. O botão abre um exemplo na calculadora, com o gráfico e a ficha completa.</p>
      <table class="tabela-aula empilha tipos">
        <thead><tr><th scope="col">Tipo</th><th scope="col">Lei</th><th scope="col">Domínio</th><th scope="col">Imagem</th><th scope="col">Para reconhecer</th><th scope="col"><span class="so-leitor">Exemplo</span></th></tr></thead>
        <tbody>${TIPOS.map(
          (t) =>
            `<tr><th scope="row">${t.nome}</th><td data-rotulo="Lei">${t.lei}</td><td data-rotulo="Domínio">${t.dominio}</td><td data-rotulo="Imagem">${t.imagem}</td><td data-rotulo="Reconhecer">${t.reconhecer}</td><td>${calcular(t.conta)}</td></tr>`,
        ).join('')}</tbody>
      </table>`,
    },
    {
      titulo: 'Quadrática: o vértice por quatro caminhos',
      cor: '#f472b6',
      largo: true,
      html: `<p>Em ${m('f(x) = ax^2 + bx + c')}, com ${m('a ≠ 0')}, o gráfico é uma parábola. Se ${m('a > 0')}, a concavidade é para cima e o vértice é o ponto mais baixo; se ${m('a < 0')}, é para baixo e o vértice é o mais alto.</p>
      ${bloco('x_v = -#f{b}{2a}', 'Δ = b^2 - 4ac', 'y_v = -#f{Δ}{4a}')}
      <p>Com ${fx('x^2 - 4*x - 5')}, em que ${m('a = 1')}, ${m('b = -4')} e ${m('c = -5')}, o eixo de simetria é ${m('x_v = -#f{(-4)}{2*1} = 2')}. O ${m('y_v')} sai por qualquer um destes caminhos:</p>
      <ol class="caminhos">
        <li><strong>Pela própria função</strong>${m('y_v = f(2) = 2^2 - 4*2 - 5 = -9')}</li>
        <li><strong>Pela fórmula direta</strong>${m('Δ = (-4)^2 - 4*1*(-5) = 36')}${m('y_v = -#f{36}{4*1} = -9')}</li>
        <li><strong>Pelas raízes</strong>${m('x^2 - 4x - 5 = (x + 1)(x - 5)')}${m('y_v = -#f{a(x_1 - x_2)^2}{4} = -#f{(-1 - 5)^2}{4} = -9')}</li>
        <li><strong>Completando o quadrado</strong>${m('x^2 - 4x - 5 = (x - 2)^2 - 9')}<span>e o vértice aparece direto.</span></li>
      </ol>
      <p>Vértice ${m('V = (2, -9)')}: como ${m('a > 0')}, é o ponto de mínimo, e a imagem é ${m('[-9, +∞)')}. As raízes também saem sem Báskara: pelo produto nulo, ${m('(x + 1)(x - 5) = 0')} dá ${m('x = -1')} ou ${m('x = 5')}. Confira por soma e produto: ${m('x_1 + x_2 = -#f{b}{a} = 4')} e ${m('x_1*x_2 = #f{c}{a} = -5')}.</p>
      ${calcular({ modo: 'funcao', f: 'x^2 - 4*x - 5', resposta: 'quadrática', imagem: '[−9, +∞)', vertice: [2, -9] })}`,
    },
    {
      titulo: 'Exponencial e logarítmica: uma desfaz a outra',
      cor: '#4ade80',
      html: `<p>Se ${m('y = a^x')}, com ${m('a > 0')} e ${m('a ≠ 1')}, então ${m('x = log_a y')}. O logaritmo responde: a que expoente devo elevar ${m('a')} para obter ${m('y')}? Por exemplo, ${m('2^3 = 8')}, então ${m('log_2 8 = 3')}.</p>
      <table class="tabela-aula comparacao">
        <thead><tr><th scope="col"><span class="so-leitor">Característica</span></th><th scope="col">${m('a^x')}</th><th scope="col">${m('log_a x')}</th></tr></thead>
        <tbody>
          <tr><th scope="row">Domínio</th><td>${m('ℝ')}</td><td>${m('(0, +∞)')}</td></tr>
          <tr><th scope="row">Imagem</th><td>${m('(0, +∞)')}</td><td>${m('ℝ')}</td></tr>
          <tr><th scope="row">Passa por</th><td>${m('(0, 1)')}</td><td>${m('(1, 0)')}</td></tr>
          <tr><th scope="row">Assíntota</th><td>${m('y = 0')}</td><td>${m('x = 0')}</td></tr>
          <tr><th scope="row">Se ${m('a > 1')}</th><td>crescente</td><td>crescente</td></tr>
          <tr><th scope="row">Se ${m('0 < a < 1')}</th><td>decrescente</td><td>decrescente</td></tr>
        </tbody>
      </table>
      <p>Os dois gráficos são simétricos em relação à reta ${m('y = x')}, como todo par de funções inversas.</p>
      <p class="lembrete">Por que a base precisa ser positiva e diferente de 1? Com ${m('a = 1')}, ${m('1^x = 1')} para todo ${m('x')}: vira constante. Com ${m('a = -2')}, ${m('(-2)^{1/2} = #r{-2}')} nem é um número real.</p>
      <p>Propriedades do logaritmo: ${m('log_a(xy) = log_a x + log_a y')}, ${m('log_a #f{x}{y} = log_a x - log_a y')}, ${m('log_a(x^n) = n*log_a x')} e a mudança de base ${m('log_a x = #f{log_b x}{log_b a}')}.</p>
      <div class="botoes">${calcular({ modo: 'funcao', f: '2^x', resposta: 'exponencial', imagem: '(0, +∞)' }, 'Calcular 2ˣ')}${calcular(
        { modo: 'funcao', f: 'log(x, 2)', resposta: 'logarítmica', imagem: 'ℝ' },
        'Calcular log₂ x',
      )}</div>`,
    },
    {
      titulo: 'Trigonométricas: o ponto que gira',
      cor: '#fb923c',
      largo: true,
      html: `<div class="duas-colunas">
        <div>
          <p>No círculo trigonométrico, de raio 1, o ângulo ${m('θ')} marca o ponto ${m('P = (cos θ, sen θ)')}: o cosseno é a abscissa e o seno, a ordenada. Por isso vale a relação fundamental ${m('sen^2 θ + cos^2 θ = 1')}.</p>
          <p>Os ângulos podem estar em graus ou em radianos: ${m('180° = π #t{rad}')}, então ${m('1° = #f{π}{180} #t{rad}')}.</p>
          <ul>
            <li>${m('sen x')} e ${m('cos x')}: domínio ${m('ℝ')}, imagem ${m('[-1, 1]')} e período ${m('2π')}.</li>
            <li>${m('tg x = #f{sen x}{cos x}')}: não existe onde ${m('cos x = 0')}, em ${m('x = #f{π}{2} + kπ')}; imagem ${m('ℝ')} e período ${m('π')}.</li>
            <li>Paridade: ${m('sen(-x) = -sen x')} e ${m('tg(-x) = -tg x')} (ímpares); ${m('cos(-x) = cos x')} (par).</li>
          </ul>
          <p>Gire o ponto no círculo e veja o seno virar uma onda: a altura de ${m('P')} é a altura do gráfico.</p>
        </div>
        <div class="lab" data-lab="circulo"></div>
      </div>
      <p class="exemplos-titulo">Valores notáveis</p>
      ${tabelaDosAngulos()}
      <div class="botoes">${calcular({ modo: 'funcao', f: 'sen(x)', resposta: 'trigonométrica', imagem: '[−1, 1]' }, 'Calcular sen x')}${calcular(
        { modo: 'funcao', f: 'tg(x)', resposta: 'trigonométrica', imagem: 'ℝ' },
        'Calcular tg x',
      )}${calcular({ modo: 'funcao', f: '0.3 - 0.3*cos(x)', resposta: 'trigonométrica', imagem: '[0, 0.6]' }, '🚗 A roda do carro')}</div>`,
    },
    {
      titulo: 'Cuidado com estes erros',
      cor: '#fb7185',
      html: `<ul class="erros">
        <li>Chamar o contradomínio de imagem: a imagem são só as saídas que aparecem.</li>
        <li>Esquecer as condições: ${m('a ≠ 0')} na afim e na quadrática; base ${m('a > 0')} e ${m('a ≠ 1')} na exponencial e no logaritmo.</li>
        <li>Calcular o logaritmo de zero ou de um número negativo: o domínio de ${m('log_a x')} é ${m('x > 0')}.</li>
        <li>Achar que ${m('tg x')} existe em ${m('#f{π}{2}')}: ali ${m('cos x = 0')}.</li>
        <li>Misturar graus e radianos: ${m('sen 30° = #f{1}{2}')}, mas ${m('sen 30 ≈ -0.988')}, porque ali são 30 radianos.</li>
      </ul>`,
    },
  ],
};

// ─── Aula 2: Limites ───────────────────────────────────────────────────────────

/** Os limites fundamentais do quadro 7; com a = 2 e α = 3 nas linhas que têm parâmetro (o botão usa esses). */
export const LIMITES_ESPECIAIS: { mostra: string; valor: string; f: string; ponto: string; resposta: string; nota?: string }[] = [
  { mostra: '#lim{x → 0} #f{sen x}{x}', valor: '1', f: 'sen(x)/x', ponto: '0', resposta: '1' },
  { mostra: '#lim{x → 0} #f{1 - cos x}{x}', valor: '0', f: '(1 - cos(x))/x', ponto: '0', resposta: '0' },
  { mostra: '#lim{x → 0} #f{1 - cos x}{x^2}', valor: '#f{1}{2}', f: '(1 - cos(x))/x^2', ponto: '0', resposta: '1/2' },
  { mostra: '#lim{x → 0} #f{e^x - 1}{x}', valor: '1', f: '(e^x - 1)/x', ponto: '0', resposta: '1' },
  {
    mostra: '#lim{x → 0} #f{a^x - 1}{x}',
    valor: 'ln a',
    f: '(2^x - 1)/x',
    ponto: '0',
    resposta: 'ln(2)',
    nota: `com ${m('a > 0')}; o botão usa ${m('a = 2')}, que dá ${m('ln 2')}`,
  },
  { mostra: '#lim{x → 0} #f{ln(1 + x)}{x}', valor: '1', f: 'ln(1 + x)/x', ponto: '0', resposta: '1' },
  { mostra: '#lim{x → 0} #f{(1 + x)^α - 1}{x}', valor: 'α', f: '((1 + x)^3 - 1)/x', ponto: '0', resposta: '3', nota: `o botão usa ${m('α = 3')}` },
];

/** Esboços dos quatro tipos de descontinuidade (quadro 9). */
function esbocoOscilante(): string {
  const pontos: string[] = [];
  for (let i = 0; i <= 400; i++) {
    const t = -1 + (2 * i) / 400;
    if (Math.abs(t) < 0.004) continue;
    pontos.push(`${(60 + t * 52).toFixed(1)},${(36 - 22 * Math.sin(1.2 / t)).toFixed(1)}`);
  }
  return `<polyline class="traco" points="${pontos.join(' ')}" />`;
}

const EIXOS = '<line class="eixo" x1="4" y1="64" x2="116" y2="64" /><line class="guia" x1="60" y1="4" x2="60" y2="66" />';
const DESCONTINUIDADES: { nome: string; texto: string; desenho: string; conta: Conta }[] = [
  {
    nome: 'Removível',
    texto: `O limite existe, mas ${m('f(a)')} não existe ou é diferente dele. Ex.: ${F('(x^2 - 4)/(x - 2)')} em ${m('x = 2')}.`,
    desenho: `<path class="traco" d="M6 58 C 30 54, 48 42, 60 34 S 92 14, 114 8" /><circle class="oco" cx="60" cy="34" r="4.5" />`,
    conta: { modo: 'limite', f: '(x^2 - 4)/(x - 2)', ponto: '2', resposta: '4', descontinuidade: 'removível' },
  },
  {
    nome: 'De salto',
    texto: `Os limites laterais existem, mas são diferentes. Ex.: ${F('abs(x)/x')} em ${m('x = 0')}.`,
    desenho: `<path class="traco" d="M6 48 H56" /><circle class="oco" cx="60" cy="48" r="4.5" /><path class="traco" d="M64 20 H114" /><circle class="cheio" cx="60" cy="20" r="4.5" />`,
    conta: { modo: 'limite', f: 'abs(x)/x', ponto: '0', resposta: 'não existe', descontinuidade: 'salto' },
  },
  {
    nome: 'Infinita',
    texto: `${m('f(x)')} vai a ${m('±∞')} perto de ${m('a')}. Ex.: ${F('1/x')} em ${m('x = 0')}.`,
    desenho: `<path class="traco" d="M6 40 C 36 42, 50 50, 56 66" /><path class="traco" d="M64 4 C 70 26, 84 32, 114 34" />`,
    conta: { modo: 'limite', f: '1/x', ponto: '0', resposta: 'não existe', descontinuidade: 'infinita' },
  },
  {
    nome: 'Essencial',
    texto: `${m('f(x)')} oscila sem parar e não se aproxima de valor nenhum. Ex.: ${F('sen(1/x)')} em ${m('x = 0')}.`,
    desenho: esbocoOscilante(),
    conta: { modo: 'limite', f: 'sen(1/x)', ponto: '0', resposta: 'não existe', descontinuidade: 'essencial' },
  },
];

const limites: Aula = {
  id: 'limites',
  numero: 2,
  titulo: 'Limites e continuidade',
  chamada: 'Para onde f(x) vai quando x chega perto de a.',
  ideia: `O <strong>limite</strong> de ${m('f(x)')} quando ${m('x')} tende a ${m('a')} é o número ${m('L')} do qual ${m('f(x)')} fica tão perto quanto se queira, desde que ${m('x')} esteja perto o bastante de ${m('a')}, com ${m('x ≠ a')}. Não importa o valor de ${m('f(a)')}, que pode nem existir: importa o comportamento de ${m('f')} perto de ${m('a')}. É a ideia que sustenta as derivadas e as integrais.`,
  cartoes: [
    {
      titulo: 'Laboratório: chegue perto do ponto',
      cor: '#22d3ee',
      largo: true,
      html: `<p>Escolha um caso e aperte <strong>▶ Aproximar</strong>: ${m('x')} anda até ${m('a')} pelos dois lados. O ponto rosa vem pela esquerda e o verde, pela direita. Se os dois chegam ao mesmo valor, esse valor é o limite; se chegam a valores diferentes, ou nunca se acalmam, o limite não existe.</p>
      <div class="lab" data-lab="limites"></div>`,
    },
    {
      titulo: 'Perto de a, não em a',
      cor: '#f472b6',
      html: `<p>${fx('(x^2 - 4)/(x - 2)')} não existe em ${m('x = 2')}: a conta dá ${m('#f{0}{0}')}. Mas veja o que acontece perto de 2:</p>
      ${tabelaDoLimite('(x^2 - 4)/(x - 2)', 2, [1.9, 1.99, 1.999], [2.001, 2.01, 2.1])}
      <p>Pelos dois lados, ${m('f(x)')} se aproxima de 4. Escrevemos ${m('#lim{x → 2} #f{x^2 - 4}{x - 2} = 4')}.</p>
      ${calcular({ modo: 'limite', f: '(x^2 - 4)/(x - 2)', ponto: '2', resposta: '4', descontinuidade: 'removível' })}`,
    },
    {
      titulo: 'A definição formal (ε–δ)',
      cor: '#60a5fa',
      html: `${bloco('#lim{x → a} f(x) = L')}
      <p>quer dizer: para todo ${m('ε > 0')} existe ${m('δ > 0')} tal que, se ${m('0 < |x - a| < δ')}, então ${m('|f(x) - L| < ε')}.</p>
      <ul>
        <li>${m('ε')} diz o quão perto ${m('f(x)')} precisa ficar de ${m('L')}.</li>
        <li>${m('δ')} diz o quão perto ${m('x')} precisa estar de ${m('a')} para isso acontecer.</li>
      </ul>
      <p>Se, para qualquer ${m('ε')}, por menor que seja, existe um ${m('δ')} que funciona, o limite é ${m('L')}. Nas contas usamos as propriedades e as técnicas dos próximos cartões; a definição é o que garante que elas valem.</p>`,
    },
    {
      titulo: 'Limites laterais',
      cor: '#38bdf8',
      html: `${bloco('#lim{x → a^-} f(x) = L_1', '#lim{x → a^+} f(x) = L_2')}
      <p>O primeiro olha só os ${m('x')} à esquerda de ${m('a')}, menores que ele; o segundo, só os da direita. O limite existe se, e somente se, os dois laterais existem e são iguais: ${m('L_1 = L_2 = L')}.</p>
      <div class="exemplo">
        <p class="exemplo-titulo">Exemplo</p>
        <p>${fx('abs(x)/x')} vale ${m('-1')} para ${m('x < 0')} e ${m('1')} para ${m('x > 0')}. Então ${m('#lim{x → 0^-} f(x) = -1')} e ${m('#lim{x → 0^+} f(x) = 1')}: como os laterais são diferentes, o limite em 0 não existe.</p>
        ${calcular({ modo: 'limite', f: 'abs(x)/x', ponto: '0', resposta: 'não existe', descontinuidade: 'salto' })}
      </div>`,
    },
    {
      titulo: 'Propriedades dos limites',
      cor: '#facc15',
      html: `<p>Se ${m('#lim{x → a} f(x) = L')} e ${m('#lim{x → a} g(x) = M')}, então, com todos os limites em ${m('x → a')}:</p>
      <ul class="propriedades">
        <li>${m('lim (f + g) = L + M')}</li>
        <li>${m('lim (f - g) = L - M')}</li>
        <li>${m('lim (k*f) = k*L')}</li>
        <li>${m('lim (f*g) = L*M')}</li>
        <li>${m('lim #f{f}{g} = #f{L}{M}')}, se ${m('M ≠ 0')}</li>
        <li>${m('lim [f(x)]^n = L^n')}</li>
        <li>${m('lim #r{f(x)} = #r{L}')}, se ${m('L ≥ 0')}</li>
        <li>${m('lim |f(x)| = |L|')}</li>
      </ul>
      <div class="exemplo">
        <p class="exemplo-titulo">Exemplo</p>
        <p>${m('#lim{x → 1} (3x^2 + 2x) = 3*1^2 + 2*1 = 5')}, pela soma, pelo múltiplo constante e pela potência.</p>
        ${calcular({ modo: 'limite', f: '3*x^2 + 2*x', ponto: '1', resposta: '5' })}
      </div>`,
    },
    {
      titulo: 'Roteiro para calcular um limite',
      cor: '#a78bfa',
      largo: true,
      html: `<ol class="roteiro">
        <li><strong>Substitua ${m('x = a')}.</strong> Deu um número? Esse é o limite: a função é contínua ali.</li>
        <li><strong>Deu ${m('#f{0}{0}')}?</strong> É uma forma indeterminada: o resultado pode ser qualquer número, e é preciso simplificar antes.
          <div class="tecnicas">
            <div><p class="tecnica-nome">Fatoração</p>${m('#f{x^2 - 4}{x - 2} = #f{(x - 2)(x + 2)}{x - 2} = x + 2 → 4')}${calcular({ modo: 'limite', f: '(x^2 - 4)/(x - 2)', ponto: '2', resposta: '4' })}</div>
            <div><p class="tecnica-nome">Racionalização</p>${m('#f{#r{x + 1} - 1}{x} = #f{(#r{x + 1} - 1)(#r{x + 1} + 1)}{x(#r{x + 1} + 1)} = #f{1}{#r{x + 1} + 1} → #f{1}{2}')}${calcular({ modo: 'limite', f: '(sqrt(x + 1) - 1)/x', ponto: '0', resposta: '1/2' })}</div>
            <div><p class="tecnica-nome">Limite fundamental</p>${m('#lim{x → 0} #f{sen x}{x} = 1')}${calcular({ modo: 'limite', f: 'sen(x)/x', ponto: '0', resposta: '1' })}</div>
          </div>
        </li>
        <li><strong>Deu ${m('#f{k}{0}')}, com ${m('k ≠ 0')}?</strong> O limite é infinito ou não existe: estude os limites laterais.</li>
        <li><strong>Interprete</strong> o resultado no contexto do problema.</li>
      </ol>`,
    },
    {
      titulo: 'Limites no infinito',
      cor: '#60a5fa',
      html: `<p>${m('#lim{x → +∞} f(x)')} mostra para onde ${m('f')} vai quando ${m('x')} cresce sem parar.</p>
      <ul class="propriedades">
        <li>${m('#lim{x → +∞} #f{1}{x} = 0')}</li>
        <li>${m('#lim{x → +∞} #f{1}{x^n} = 0')}, com ${m('n > 0')}</li>
        <li>${m('#lim{x → +∞} x^n = +∞')}, com ${m('n > 0')}</li>
        <li>${m('#lim{x → +∞} #r{x} = +∞')}</li>
      </ul>
      <p>Numa fração de polinômios, compare os graus. Numerador de grau menor: o limite é 0. Graus iguais: é a razão dos coeficientes líderes. Numerador de grau maior: vai a ${m('+∞')} ou a ${m('-∞')}, conforme os sinais.</p>
      <div class="exemplo">
        <p class="exemplo-titulo">Exemplo</p>
        <p>${m('#lim{x → +∞} #f{3x^2 + 1}{2x^2 - x} = #f{3}{2}')}: graus iguais, razão dos líderes.</p>
        ${calcular({ modo: 'limite', f: '(3*x^2 + 1)/(2*x^2 - x)', ponto: 'inf', resposta: '3/2' })}
      </div>`,
    },
    {
      titulo: 'Limites especiais',
      cor: '#2dd4bf',
      html: `<p>Formas ${m('#f{0}{0}')} que aparecem tanto que vale guardar o resultado:</p>
      <table class="tabela-aula especiais">
        <tbody>${LIMITES_ESPECIAIS.map(
          (l) =>
            `<tr><td>${m(`${l.mostra} = ${l.valor}`)}${l.nota ? `<span class="nota-linha">${l.nota}</span>` : ''}</td><td>${calcular({ modo: 'limite', f: l.f, ponto: l.ponto, resposta: l.resposta })}</td></tr>`,
        ).join('')}</tbody>
      </table>`,
    },
    {
      titulo: 'Continuidade e tipos de descontinuidade',
      cor: '#facc15',
      largo: true,
      html: `<p>${m('f')} é <strong>contínua</strong> em ${m('a')} quando três coisas acontecem: ${m('f(a)')} existe, ${m('#lim{x → a} f(x)')} existe e os dois são iguais. No gráfico: sem furo, sem salto e sem disparar para o infinito em ${m('a')}.</p>
      <div class="descontinuidades">${DESCONTINUIDADES.map(
        (d) =>
          `<div class="descontinuidade"><svg viewBox="0 0 120 70" aria-hidden="true">${EIXOS}${d.desenho}</svg><p class="tecnica-nome">${d.nome}</p><p>${d.texto}</p>${calcular(d.conta)}</div>`,
      ).join('')}</div>
      <p class="lembrete">As funções elementares são contínuas em todo o seu domínio: polinômios em ${m('ℝ')}; frações onde o denominador não zera; seno e cosseno em ${m('ℝ')}; exponenciais em ${m('ℝ')}; logaritmos em ${m('x > 0')}.</p>`,
    },
    {
      titulo: 'Dois teoremas importantes',
      cor: '#e879f9',
      html: `<p><strong>Confronto (sanduíche).</strong> Se ${m('g(x) ≤ f(x) ≤ h(x)')} perto de ${m('a')} e ${m('g')} e ${m('h')} têm o mesmo limite ${m('L')}, então ${m('#lim{x → a} f(x) = L')}. Exemplo: ${m('-x^2 ≤ x^2 sen #f{1}{x} ≤ x^2')}, e os dois lados vão a 0; logo ${m('#lim{x → 0} x^2 sen #f{1}{x} = 0')}.</p>
      ${calcular({ modo: 'limite', f: 'x^2*sen(1/x)', ponto: '0', resposta: '0' })}
      <p><strong>Valor intermediário.</strong> Se ${m('f')} é contínua em ${m('[a, b]')} e ${m('k')} está entre ${m('f(a)')} e ${m('f(b)')}, existe ${m('c')} em ${m('[a, b]')} com ${m('f(c) = k')}. Exemplo: ${fx('x^3 - x - 1')} tem ${m('f(1) = -1')} e ${m('f(2) = 5')}; como é contínua e troca de sinal, tem uma raiz entre 1 e 2.</p>`,
    },
  ],
};

// ─── Aula 3: Derivadas ─────────────────────────────────────────────────────────

const REGRAS_DE_DERIVACAO: { nome: string; forma: string; f: string; df: string }[] = [
  { nome: 'Constante', forma: '#ddx[c] = 0', f: '7', df: '0' },
  { nome: 'Potência', forma: '#ddx[x^n] = nx^{n-1}', f: 'x^5', df: '5*x^4' },
  { nome: 'Múltiplo constante', forma: "#ddx[k*f(x)] = k*f'(x)", f: '4*x^3', df: '12*x^2' },
  { nome: 'Soma e diferença', forma: "#ddx[f(x) ± g(x)] = f'(x) ± g'(x)", f: 'x^3 - 4*x + 2', df: '3*x^2 - 4' },
  { nome: 'Produto', forma: "#ddx[f(x)*g(x)] = f'(x)*g(x) + f(x)*g'(x)", f: 'x^2*sen(x)', df: '2*x*sen(x) + x^2*cos(x)' },
  { nome: 'Quociente', forma: "#ddx#f{f(x)}{g(x)} = #f{f'(x)*g(x) - f(x)*g'(x)}{[g(x)]^2}", f: 'sen(x)/x', df: '(x*cos(x) - sen(x))/x^2' },
  { nome: 'Cadeia', forma: "#ddx[f(g(x))] = f'(g(x))*g'(x)", f: 'sen(3*x)', df: '3*cos(3*x)' },
];

/** A tabela do quadro 3 e a do quadro 4; com n = 5, a = 2 e a = 10 nas linhas que têm parâmetro. */
export const TABELA_DERIVADAS: { f: string; df: string; mostra?: [string, string]; condicao?: string; grupo: 'elementares' | 'trigonométricas' }[] = [
  { f: 'x^5', df: '5*x^4', mostra: ['x^n', 'nx^{n-1}'], grupo: 'elementares' },
  { f: 'sqrt(x)', df: '1/(2*sqrt(x))', condicao: 'x > 0', grupo: 'elementares' },
  { f: '1/x', df: '-1/x^2', condicao: 'x ≠ 0', grupo: 'elementares' },
  { f: 'e^x', df: 'e^x', grupo: 'elementares' },
  { f: '2^x', df: '2^x*ln(2)', mostra: ['a^x', 'a^x ln a'], condicao: 'a > 0, a ≠ 1', grupo: 'elementares' },
  { f: 'ln(x)', df: '1/x', condicao: 'x > 0', grupo: 'elementares' },
  { f: 'log(x, 10)', df: '1/(x*ln(10))', mostra: ['log_a x', '#f{1}{x ln a}'], condicao: 'x > 0', grupo: 'elementares' },
  { f: 'sen(x)', df: 'cos(x)', grupo: 'trigonométricas' },
  { f: 'cos(x)', df: '-sen(x)', grupo: 'trigonométricas' },
  { f: 'tg(x)', df: 'sec(x)^2', grupo: 'trigonométricas' },
  { f: 'cotg(x)', df: '-csc(x)^2', grupo: 'trigonométricas' },
  { f: 'sec(x)', df: 'sec(x)*tg(x)', grupo: 'trigonométricas' },
  { f: 'csc(x)', df: '-csc(x)*cotg(x)', grupo: 'trigonométricas' },
];

function tabelaDeDerivadas(grupo: 'elementares' | 'trigonométricas'): string {
  const linhas = TABELA_DERIVADAS.filter((l) => l.grupo === grupo).map((l) => {
    const [f, df] = l.mostra ? [m(l.mostra[0]), m(l.mostra[1])] : [F(l.f), F(l.df)];
    const condicao = l.condicao ? ` <span class="nota-linha">${m(l.condicao)}</span>` : '';
    return `<tr><td>${f}${condicao}</td><td>${df}</td></tr>`;
  });
  return `<table class="tabela-aula derivadas">
    <caption>${grupo === 'elementares' ? 'Funções elementares' : 'Trigonométricas'}</caption>
    <thead><tr><th scope="col">${m('f(x)')}</th><th scope="col">${m("f'(x)")}</th></tr></thead>
    <tbody>${linhas.join('')}</tbody>
  </table>`;
}

const CADEIA: { f: string; dentro: string; df: string }[] = [
  { f: 'sen(3*x)', dentro: '3*x', df: '3*cos(3*x)' },
  { f: 'cos(5*x^2)', dentro: '5*x^2', df: '-10*x*sen(5*x^2)' },
  { f: 'tg(x^2 + 1)', dentro: 'x^2 + 1', df: '2*x*sec(x^2 + 1)^2' },
  { f: 'e^(sen(x))', dentro: 'sen(x)', df: 'e^(sen(x))*cos(x)' },
  { f: 'ln(cos(x))', dentro: 'cos(x)', df: '-tg(x)' },
  { f: 'sqrt(tg(x))', dentro: 'tg(x)', df: 'sec(x)^2/(2*sqrt(tg(x)))' },
];

const derivadas: Aula = {
  id: 'derivadas',
  numero: 3,
  titulo: 'Derivadas',
  chamada: 'A taxa de variação instantânea: a inclinação da reta tangente.',
  ideia: `A <strong>derivada</strong> de ${m('f')} em ${m('x')} mede quão depressa ${m('f(x)')} muda quando ${m('x')} muda um pouquinho. Ela é o limite da taxa de variação média: no gráfico, é a inclinação da reta tangente; no movimento, é a velocidade.`,
  cartoes: [
    {
      titulo: 'Laboratório: da secante à tangente',
      cor: '#22d3ee',
      largo: true,
      html: `<p>A reta secante passa por ${m('P = (x_0, f(x_0))')} e ${m('Q = (x_0 + h, f(x_0 + h))')}, e sua inclinação é a taxa média ${m('#f{f(x_0 + h) - f(x_0)}{h}')}. Aperte <strong>▶ h → 0</strong>: ${m('Q')} escorrega até ${m('P')}, a secante vira a tangente e a inclinação chega a ${m("f'(x_0)")}, que o motor calcula pelas regras.</p>
      <div class="lab" data-lab="derivadas"></div>`,
    },
    {
      titulo: 'Definição e interpretações',
      cor: '#f472b6',
      html: `${bloco("f'(x) = #lim{h → 0} #f{f(x + h) - f(x)}{h}")}
      <ul>
        <li><strong>Geométrica:</strong> ${m("f'(a)")} é o coeficiente angular da reta tangente ao gráfico no ponto ${m('(a, f(a))')}.</li>
        <li><strong>Física:</strong> se ${m('s(t)')} é a posição, ${m("s'(t)")} é a velocidade instantânea.</li>
        <li><strong>Econômica:</strong> é a taxa de variação do custo ou da receita (custo marginal, receita marginal).</li>
      </ul>
      <div class="exemplo">
        <p class="exemplo-titulo">Pela definição</p>
        <p>Com ${fx('x^2')}: ${m('#f{(x + h)^2 - x^2}{h} = #f{2xh + h^2}{h} = 2x + h')}, que vai a ${m('2x')} quando ${m('h → 0')}. Logo ${m("(x^2)' = 2x")}.</p>
        ${calcular({ modo: 'derivada', f: 'x^2', resposta: '2*x' })}
      </div>`,
    },
    {
      titulo: 'As sete regras de derivação',
      cor: '#a78bfa',
      largo: true,
      html: `<p>Com estas regras se deriva qualquer combinação das funções da aula, sem voltar à definição.</p>
      <table class="tabela-aula empilha regras-aula">
        <thead><tr><th scope="col">Regra</th><th scope="col">Fórmula</th><th scope="col">Exemplo</th><th scope="col"><span class="so-leitor">Calcular</span></th></tr></thead>
        <tbody>${REGRAS_DE_DERIVACAO.map(
          (r) =>
            `<tr><th scope="row">${r.nome}</th><td data-rotulo="Fórmula">${m(r.forma)}</td><td data-rotulo="Exemplo">${derivadaDe(r.f, r.df)}</td><td>${calcular({ modo: 'derivada', f: r.f, resposta: r.df })}</td></tr>`,
        ).join('')}</tbody>
      </table>`,
    },
    {
      titulo: 'Tabela de derivadas',
      cor: '#2dd4bf',
      largo: true,
      html: `<div class="tabelas-lado">${tabelaDeDerivadas('elementares')}${tabelaDeDerivadas('trigonométricas')}</div>
      <p class="lembrete">Lembre-se: ${m('e ≈ 2.718')} e ${m('ln x = log_e x')}. Na forma geral, ${m("#ddx[a^u] = a^u ln a*u'")} e ${m("#ddx[ln u] = #f{u'}{u}")}.</p>`,
    },
    {
      titulo: 'Regra da cadeia passo a passo',
      cor: '#fb923c',
      largo: true,
      html: `<p>Para derivar uma composta ${m('f(g(x))')}, separe a função de fora, ${m('f')}, da de dentro, ${m('u = g(x)')}. Derive a de fora mantendo a de dentro e multiplique pela derivada da de dentro: ${m("[f(u)]' = f'(u)*u'")}.</p>
      <table class="tabela-aula empilha cadeia">
        <thead><tr><th scope="col">Função</th><th scope="col">De dentro, ${m('u')}</th><th scope="col">Derivada</th><th scope="col"><span class="so-leitor">Calcular</span></th></tr></thead>
        <tbody>${CADEIA.map(
          (c) =>
            `<tr><td data-rotulo="Função">${F(c.f)}</td><td data-rotulo="De dentro">${F(c.dentro)}</td><td data-rotulo="Derivada">${F(c.df)}</td><td>${calcular({ modo: 'derivada', f: c.f, resposta: c.df })}</td></tr>`,
        ).join('')}</tbody>
      </table>`,
    },
    {
      titulo: 'Para que serve a derivada',
      cor: '#4ade80',
      html: `<ul>
        <li>${m("f'(x) > 0")} num intervalo: ${m('f')} cresce ali; ${m("f'(x) < 0")}: ${m('f')} decresce.</li>
        <li>${m("f'(c) = 0")}: a tangente é horizontal, e ${m('c')} é candidato a máximo ou mínimo.</li>
        <li>A segunda derivada mostra a concavidade: ${m("f''(x) > 0")}, para cima; ${m("f''(x) < 0")}, para baixo.</li>
      </ul>
      <div class="exemplo">
        <p class="exemplo-titulo">Exemplo</p>
        <p>Em ${fx('x^3 - 3*x')}, a derivada ${m("f'(x) = 3x^2 - 3")} zera em ${m('x = -1')} e em ${m('x = 1')}. Como ${m("f''(x) = 6x")}, ${m('f(-1) = 2')} é máximo local e ${m('f(1) = -2')} é mínimo local.</p>
        ${calcular({ modo: 'derivada', f: 'x^3 - 3*x', resposta: '3*x^2 - 3' })}
      </div>`,
    },
    {
      titulo: 'Erros comuns',
      cor: '#fb7185',
      html: `<ul class="erros">
        <li>Esquecer a regra da cadeia: ${m("(sen 3x)' = 3 cos 3x")}, e não ${m('cos 3x')}.</li>
        <li>Errar o sinal: ${m("(cos x)' = -sen x")}.</li>
        <li>Confundir tangente e cotangente: ${m("(tg x)' = sec^2 x")}, mas ${m("(cotg x)' = -csc^2 x")}.</li>
        <li>Derivar o produto como produto das derivadas: ${m("(x^2 sen x)' ≠ 2x cos x")}.</li>
        <li>Trocar a ordem no quociente: é ${m("f'g - fg'")}, nessa ordem, sobre ${m('g^2')}.</li>
      </ul>`,
    },
  ],
};

// ─── Aula 4: Integrais ─────────────────────────────────────────────────────────

/** A tabela do quadro 3, com a correção da linha de csc² x; n = 3 e a = 2 nas linhas com parâmetro. */
export const TABELA_INTEGRAIS: { f: string; F: string; mostra?: [string, string]; condicao?: string }[] = [
  { f: '5', F: '5*x', mostra: ['k', 'kx'] },
  { f: 'x^3', F: 'x^4/4', mostra: ['x^n', '#f{x^{n+1}}{n + 1}'], condicao: 'n ≠ -1' },
  { f: '1/x', F: 'ln(abs(x))' },
  { f: 'e^x', F: 'e^x' },
  { f: '2^x', F: '2^x/ln(2)', mostra: ['a^x', '#f{a^x}{ln a}'], condicao: 'a > 0, a ≠ 1' },
  { f: 'sen(x)', F: '-cos(x)' },
  { f: 'cos(x)', F: 'sen(x)' },
  { f: 'sec(x)^2', F: 'tg(x)' },
  { f: 'csc(x)^2', F: '-cotg(x)' },
  { f: 'sec(x)*tg(x)', F: 'sec(x)' },
  { f: 'csc(x)*cotg(x)', F: '-csc(x)' },
];

const REGRAS_DE_INTEGRACAO: { nome: string; forma: string; f: string; F: string }[] = [
  { nome: 'Constante', forma: '#int k #dx = kx + C', f: '5', F: '5*x' },
  { nome: 'Potência', forma: '#int x^n #dx = #f{x^{n+1}}{n + 1} + C', f: 'x^3', F: 'x^4/4' },
  { nome: 'Soma e diferença', forma: '#int [f(x) ± g(x)] #dx = #int f(x) #dx ± #int g(x) #dx', f: '3*x^2 - 4*x + 2', F: 'x^3 - 2*x^2 + 2*x' },
  { nome: 'Exponencial', forma: '#int e^x #dx = e^x + C', f: 'e^(-2*x)', F: '-e^(-2*x)/2' },
  { nome: 'Trigonométrica', forma: '#int cos x #dx = sen x + C', f: 'cos(3*x)', F: 'sen(3*x)/3' },
  { nome: 'Substituição', forma: "#int f(g(x))*g'(x) #dx = #int f(u) #du", f: '2*x*cos(x^2)', F: 'sen(x^2)' },
];

const integrais: Aula = {
  id: 'integrais',
  numero: 4,
  titulo: 'Integrais',
  chamada: 'O caminho de volta da derivada e a soma de infinitas fatias.',
  ideia: `<strong>Integrar</strong> é o processo inverso de derivar: achar uma função ${m('F')} cuja derivada é ${m('f')}. A integral indefinida reúne todas essas primitivas, ${m('F(x) + C')}. Já a integral definida soma infinitas fatias finíssimas e mede a área, com sinal, entre o gráfico e o eixo ${m('x')}. O Teorema Fundamental do Cálculo liga as duas ideias.`,
  cartoes: [
    {
      titulo: 'Laboratório: retângulos que viram área',
      cor: '#22d3ee',
      largo: true,
      html: `<p>A integral definida é o limite das somas de Riemann: retângulos cada vez mais finos debaixo da curva. Aperte <strong>▶ Mais retângulos</strong> para dobrar ${m('n')} e veja a soma chegar ao valor exato do Teorema Fundamental, ${m('F(b) - F(a)')}. Abaixo do eixo ${m('x')}, os retângulos contam negativo.</p>
      <div class="lab" data-lab="integrais"></div>`,
    },
    {
      titulo: 'Primitiva e a constante C',
      cor: '#f472b6',
      html: `${bloco("#int f(x) #dx = F(x) + C, #t{em que} F'(x) = f(x)")}
      <p>${m('F')} é uma <strong>primitiva</strong>, ou antiderivada, de ${m('f')}. E por que o ${m('+ C')}? Porque a derivada de uma constante é zero: ${m('x^2')}, ${m('x^2 + 1')} e ${m('x^2 - 7')} têm todas derivada ${m('2x')}. A integral indefinida é a família inteira, deslocada para cima e para baixo.</p>
      <div class="exemplo">
        <p class="exemplo-titulo">Exemplo</p>
        <p>${m('#int 2x #dx = x^2 + C')}. Confira derivando: ${m("(x^2 + C)' = 2x")}.</p>
        ${calcular({ modo: 'integral', f: '2*x', resposta: 'x^2' })}
      </div>`,
    },
    {
      titulo: 'Propriedades da integral indefinida',
      cor: '#60a5fa',
      html: `<ul class="propriedades uma-coluna">
        <li><strong>Linearidade:</strong> ${m('#int [a*f(x) + b*g(x)] #dx = a#int f(x) #dx + b#int g(x) #dx')}</li>
        <li><strong>Integral da derivada:</strong> ${m("#int F'(x) #dx = F(x) + C")}</li>
        <li><strong>Derivada da integral:</strong> ${m('#ddx[#int f(x) #dx] = f(x)')}</li>
        <li><strong>Unicidade:</strong> duas primitivas da mesma ${m('f')} diferem por uma constante.</li>
      </ul>
      <p class="lembrete">A integral desfaz a derivada, até uma constante. Por isso dá para conferir qualquer primitiva derivando.</p>`,
    },
    {
      titulo: 'Integrais imediatas',
      cor: '#2dd4bf',
      html: `<table class="tabela-aula imediatas">
        <tbody>${TABELA_INTEGRAIS.map((l) => {
          const formula = l.mostra ? m(`#int ${l.mostra[0]} #dx = ${l.mostra[1]} + C`) : integralDe(l.f, l.F);
          const condicao = l.condicao ? `<span class="nota-linha">${m(l.condicao)}</span>` : '';
          return `<tr><td>${formula}${condicao}</td><td>${calcular({ modo: 'integral', f: l.f, resposta: l.F })}</td></tr>`;
        }).join('')}</tbody>
      </table>`,
    },
    {
      titulo: 'As seis regras do projeto',
      cor: '#a78bfa',
      largo: true,
      html: `<p>O enunciado pede pelo menos cinco regras de integração; a calculadora usa estas seis, além do múltiplo constante e de ${m('#int #f{1}{x} #dx = ln|x| + C')}.</p>
      <table class="tabela-aula empilha regras-aula">
        <thead><tr><th scope="col">Regra</th><th scope="col">Fórmula</th><th scope="col">Exemplo</th><th scope="col"><span class="so-leitor">Calcular</span></th></tr></thead>
        <tbody>${REGRAS_DE_INTEGRACAO.map(
          (r) =>
            `<tr><th scope="row">${r.nome}</th><td data-rotulo="Fórmula">${m(r.forma)}</td><td data-rotulo="Exemplo">${integralDe(r.f, r.F)}</td><td>${calcular({ modo: 'integral', f: r.f, resposta: r.F })}</td></tr>`,
        ).join('')}</tbody>
      </table>
      <p>Quando o integrando chega como produto ou fração, a calculadora reescreve antes de integrar: aplica a distributiva, junta as potências e divide os polinômios, como em ${m('#int x^2 #r{x} #dx = #int x^{5/2} #dx')}. Na substituição, uma constante que acompanha ${m("g'(x)")} vai para fora: em ${m('#int (4x + 2) cos(x^2 + x) #dx')}, com ${m('u = x^2 + x')}, ${m('4x + 2 = 2(2x + 1)')}.</p>
      <div class="botoes">${calcular({ modo: 'integral', f: '(x + 1)*(x - 1)', resposta: 'x^3/3 - x' }, 'Calcular ∫ (x + 1)(x − 1) dx')}${calcular(
        { modo: 'integral', f: '(4*x + 2)*cos(x^2 + x)', resposta: '2*sen(x^2 + x)' },
        'Calcular ∫ (4x + 2) cos(x² + x) dx',
      )}</div>`,
    },
    {
      titulo: 'Substituição em quatro passos',
      cor: '#e879f9',
      html: `<p>Serve quando a integral tem uma função de dentro, ${m('g(x)')}, acompanhada da sua derivada ${m("g'(x)")}.</p>
      <ol class="roteiro">
        <li><strong>Escolha</strong> ${m('u = g(x)')}. Em ${m('#int 2x cos(x^2) #dx')}, ${m('u = x^2')}.</li>
        <li><strong>Calcule</strong> ${m("#du = g'(x) #dx")}: ${m('#du = 2x #dx')}.</li>
        <li><strong>Troque</strong> na integral: ${m('#int cos(x^2)*2x #dx = #int cos u #du')}.</li>
        <li><strong>Resolva e volte</strong> para ${m('x')}: ${m('sen u + C = sen(x^2) + C')}.</li>
      </ol>
      ${calcular({ modo: 'integral', f: '2*x*cos(x^2)', resposta: 'sen(x^2)' })}`,
    },
    {
      titulo: 'Integral definida e o Teorema Fundamental',
      cor: '#facc15',
      largo: true,
      html: `${bloco('#int{a}{b} f(x) #dx = F(b) - F(a)')}
      <p>Se ${m('F')} é uma primitiva de ${m('f')} e ${m('f')} é contínua em ${m('[a, b]')}, a integral definida é a variação da primitiva. Ela soma as fatias ${m('f(x) #dx')} de ${m('a')} até ${m('b')}: é a área com sinal entre o gráfico e o eixo ${m('x')}, positiva acima do eixo e negativa abaixo.</p>
      <div class="tecnicas">
        <div><p class="tecnica-nome">A área sob o seno</p>${m('#int{0}{π} sen x #dx = [-cos x]_0^π = -cos π + cos 0 = 2')}${calcular({ modo: 'definida', f: 'sen(x)', a: '0', b: 'pi', resposta: '2' })}</div>
        <div><p class="tecnica-nome">Integral não é área</p><p>${m('#int{0}{2π} sen x #dx = 0')}: a parte de baixo cancela a de cima. A área é ${m('#int{0}{2π} |sen x| #dx = 4')}.</p><div class="botoes">${calcular(
          { modo: 'definida', f: 'sen(x)', a: '0', b: '2*pi', resposta: '0' },
          'Calcular a integral',
        )}${calcular({ modo: 'definida', f: 'abs(sen(x))', a: '0', b: '2*pi', resposta: '4' }, 'Calcular a área')}</div></div>
        <div><p class="tecnica-nome">Quando o TFC não vale</p><p>${m('#int{-1}{1} #f{1}{x^2} #dx')} não é ${m('-2')}: em ${m('x = 0')} a função vai ao infinito, o teorema não se aplica e a integral diverge.</p>${calcular({ modo: 'definida', f: '1/x^2', a: '-1', b: '1', resposta: 'diverge' })}</div>
      </div>`,
    },
    {
      titulo: 'Outras técnicas de integração',
      cor: '#fb923c',
      html: `<p>Algumas integrais pedem técnicas que estão nos slides, mas fora das seis regras do projeto. A calculadora reconhece esses casos e diz qual técnica seria usada.</p>
      <ul>
        <li><strong>Por partes:</strong> ${m('#int u #dv = uv - #int v #du')}. Em ${m('#int x e^x #dx')}, com ${m('u = x')} e ${m('#dv = e^x #dx')}: ${m('x e^x - #int e^x #dx = e^x(x - 1) + C')}.</li>
        <li><strong>Frações parciais:</strong> em ${m('#int #f{P(x)}{Q(x)} #dx')}, fatore ${m('Q')}, quebre em frações simples e integre termo a termo.</li>
        <li><strong>Substituições trigonométricas:</strong> ${m('#r{a^2 - x^2}')} com ${m('x = a sen θ')}; ${m('#r{a^2 + x^2}')} com ${m('x = a tg θ')}; ${m('#r{x^2 - a^2}')} com ${m('x = a sec θ')}.</li>
      </ul>
      ${calcular({ modo: 'integral', f: 'x*e^x', resposta: 'por partes' }, 'Ver o aviso da calculadora')}`,
    },
    {
      titulo: 'Erros comuns',
      cor: '#fb7185',
      html: `<ul class="erros">
        <li>Esquecer o ${m('+ C')} na integral indefinida.</li>
        <li>Usar a regra da potência com ${m('n = -1')}: o certo é ${m('#int #f{1}{x} #dx = ln|x| + C')}.</li>
        <li>Na substituição, esquecer de trocar ${m('#dx')} por ${m('#du')}, ou de voltar para ${m('x')} no fim.</li>
        <li>Aplicar o TFC com ${m('f')} descontínua no intervalo, como em ${m('#int{-1}{1} #f{1}{x^2} #dx')}.</li>
        <li>Confundir integral com área: abaixo do eixo ${m('x')}, a integral conta negativo.</li>
      </ul>
      <p class="lembrete">Confira sempre derivando: se ${m("F' = f")}, a primitiva está certa.</p>`,
    },
  ],
};

export const AULAS: Aula[] = [funcoes, limites, derivadas, integrais];

// ─── O carro que chega na lombada, nas quatro aulas ────────────────────────────

const HISTORIA: { aula: IdAula; numero: number; titulo: string; texto: string; botao: string }[] = [
  {
    aula: 'funcoes',
    numero: 1,
    titulo: 'Funções',
    texto: `Durante a reação, a posição é afim: ${m('s(t) = 20t')}. Depois que o freio entra, é quadrática: ${m('s(t) = -2t^2 + 24t - 2')}, com ${m('a < 0')}. O carro chega à lombada, em ${m('s = 62')} m, no instante ${m('t = 4')} s. O vértice ${m('(6, 70)')} mostra que, sem soltar o freio, ele pararia 8 m depois dela.`,
    botao: calcular({ modo: 'funcao', f: '-2*x^2 + 24*x - 2', resposta: 'quadrática', imagem: '(−∞, 70]', vertice: [6, 70] }),
  },
  {
    aula: 'limites',
    numero: 2,
    titulo: 'Limites',
    texto: `Em ${m('t = 1')} s o pé sai do acelerador e vai para o freio. Dos dois lados, a velocidade chega a 20 m/s: ela é contínua aí. A aceleração não: vale 0 antes e −4 m/s² depois. Os limites laterais são diferentes, uma descontinuidade de salto.`,
    botao: calcular({ modo: 'limite', f: 'x < 1 ? 0 : -4', ponto: '1', resposta: 'não existe', descontinuidade: 'salto' }),
  },
  {
    aula: 'derivadas',
    numero: 3,
    titulo: 'Derivadas',
    texto: `A velocidade é a derivada da posição: na frenagem, ${m("v(t) = s'(t) = 24 - 4t")}, e a aceleração é ${m("v'(t) = -4")} m/s². Na lombada, ${m('v(4) = 8')} m/s, ou 28,8 km/h: dentro dos 30 km/h. Em ${m('t = 1')} o gráfico da velocidade faz uma quina (as derivadas laterais são 0 e −4), e ali ela não tem derivada.`,
    botao: calcular({ modo: 'derivada', f: '-2*x^2 + 24*x - 2', resposta: '24 - 4*x' }),
  },
  {
    aula: 'integrais',
    numero: 4,
    titulo: 'Integrais',
    texto: `A distância é a área sob a velocidade: ${m('#int{0}{1} 20 #dt + #int{1}{4} (24 - 4t) #dt = 20 + 42 = 62')} m, exatamente onde está a lombada. Só a reação gasta 20 m: com 1,5 s de reação, sobrariam 32 m para frear, e o carro chegaria a 43,2 km/h.`,
    botao: calcular({ modo: 'definida', f: '24 - 4*x', a: '1', b: '4', resposta: '42' }),
  },
];

/** O carro chegando na lombada nas quatro aulas, com a aula aberta em destaque, e o laboratório dele. */
export function historiaDoCarro(atual: IdAula): string {
  return `<section class="historia" aria-labelledby="historia-${atual}">
    <h3 id="historia-${atual}"><span aria-hidden="true">🚗</span> Um carro chegando na lombada, nas quatro aulas</h3>
    <p class="historia-intro">Um carro vem a 20 m/s (72 km/h). No instante ${m('t = 0')}, o motorista vê uma lombada 62 m à frente, que pede no máximo 30 km/h. Ele leva 1 s para reagir e então freia, perdendo 4 m/s a cada segundo, até chegar à lombada. O mesmo problema atravessa as quatro aulas. Na calculadora, o tempo ${m('t')} é digitado como ${m('x')}.</p>
    <ol class="historia-passos">${HISTORIA.map(
      (p) => `<li${p.aula === atual ? ' class="atual" aria-current="step"' : ''}>
        <a class="historia-aula" href="#${p.aula}">${p.titulo}</a>
        <p>${p.texto}</p>
        ${p.botao}
      </li>`,
    ).join('')}</ol>
    <h4 class="historia-lab">Laboratório: o motorista e a lombada</h4>
    <p class="historia-intro">Mude o tempo de reação e a força da freada e veja com que velocidade o carro chega. A área azul debaixo da velocidade é a distância andada.</p>
    <div class="lab lab-lombada" data-lab="lombada"></div>
  </section>`;
}

/** A aula inteira: o topo, os cartões, o carro e a navegação para as vizinhas. */
export function htmlDaAula(aula: Aula): string {
  const i = AULAS.indexOf(aula);
  const anterior = AULAS[i - 1];
  const proxima = AULAS[i + 1];
  const cartoes = aula.cartoes.map(
    (c, j) => `<section class="cartao${c.largo ? ' largo' : ''}" style="--cor: ${c.cor}; --i: ${j}" aria-labelledby="cartao-${aula.id}-${j}">
      <h3 id="cartao-${aula.id}-${j}">${c.titulo}</h3>
      ${c.html}
    </section>`,
  );
  return `<header class="aula-topo">
      
      <h2 class="aula-titulo" tabindex="-1">${aula.titulo}</h2>
      <p class="aula-chamada">${aula.chamada}</p>
      <p class="aula-ideia">${aula.ideia}</p>
    </header>
    <div class="cartoes">${cartoes.join('')}</div>
    ${historiaDoCarro(aula.id)}
    <nav class="aula-navegacao" aria-label="Outras aulas">
      ${anterior ? `<a href="#${anterior.id}">← ${anterior.titulo}</a>` : '<span></span>'}
      ${proxima ? `<a href="#${proxima.id}">${proxima.titulo} →</a>` : '<a href="#calculadora">Ir para a calculadora →</a>'}
    </nav>`;
}

// ─── Casos dos laboratórios ────────────────────────────────────────────────────

export interface ParametroDoLab {
  nome: string;
  min: number;
  max: number;
  passo: number;
  inicial: number;
}

export interface TipoNoLab {
  tipo: TipoFuncao;
  rotulo: string;
  /** A forma geral, na notação de notacao(). */
  forma: (variante: string) => string;
  parametros: ParametroDoLab[];
  /** Só na trigonométrica: sen, cos ou tg. */
  variantes?: string[];
  /** A função na escrita da calculadora, com os valores dos controles. */
  montar: (p: Record<string, number>, variante: string) => string;
  /** Quando os controles tiram a função do tipo (a = 0, base 1): o que dizer ao aluno. */
  foraDoTipo: (p: Record<string, number>) => string | null;
  janela: Janela;
  pi?: boolean;
}

const vezes = (c: number, parte: string): string => (c === 1 ? parte : c === -1 ? `-${parte}` : `${c}*${parte}`);
const mais = (texto: string, c: number): string => (c === 0 ? texto : `${texto} ${c < 0 ? '-' : '+'} ${Math.abs(c)}`);
/** c₁·parte₁ + c₂·parte₂ + …, sem os termos nulos e com o sinal no lugar certo. */
function polinomio(termos: [number, string][]): string {
  const partes: string[] = [];
  for (const [c, parte] of termos) {
    if (c === 0) continue;
    const modulo = Math.abs(c);
    const corpo = parte === '' ? String(modulo) : modulo === 1 ? parte : `${modulo}*${parte}`;
    partes.push(partes.length === 0 ? `${c < 0 ? '-' : ''}${corpo}` : `${c < 0 ? '-' : '+'} ${corpo}`);
  }
  return partes.length > 0 ? partes.join(' ') : '0';
}
const valor = (p: Record<string, number>, nome: string): number => p[nome] ?? 0;

export const LAB_FUNCOES: TipoNoLab[] = [
  {
    tipo: 'constante',
    rotulo: 'Constante',
    forma: () => 'f(x) = b',
    parametros: [{ nome: 'b', min: -4, max: 4, passo: 0.5, inicial: 2 }],
    montar: (p) => polinomio([[valor(p, 'b'), '']]),
    foraDoTipo: () => null,
    janela: [-5, 5, -5, 5],
  },
  {
    tipo: 'linear',
    rotulo: 'Linear',
    forma: () => 'f(x) = ax',
    parametros: [{ nome: 'a', min: -3, max: 3, passo: 0.5, inicial: 1.5 }],
    montar: (p) => polinomio([[valor(p, 'a'), 'x']]),
    foraDoTipo: (p) => (valor(p, 'a') === 0 ? 'Com a = 0, sobra f(x) = 0: vira constante. A linear exige a ≠ 0.' : null),
    janela: [-5, 5, -5, 5],
  },
  {
    tipo: 'afim',
    rotulo: 'Afim',
    forma: () => 'f(x) = ax + b',
    parametros: [
      { nome: 'a', min: -3, max: 3, passo: 0.5, inicial: 2 },
      { nome: 'b', min: -4, max: 4, passo: 0.5, inicial: 1 },
    ],
    montar: (p) => polinomio([
      [valor(p, 'a'), 'x'],
      [valor(p, 'b'), ''],
    ]),
    foraDoTipo: (p) =>
      valor(p, 'a') === 0
        ? 'Com a = 0, sobra f(x) = b: vira constante. A afim exige a ≠ 0.'
        : valor(p, 'b') === 0
          ? 'Com b = 0, a reta passa pela origem: é a função linear, um caso particular da afim.'
          : null,
    janela: [-5, 5, -5, 5],
  },
  {
    tipo: 'quadrática',
    rotulo: 'Quadrática',
    forma: () => 'f(x) = ax^2 + bx + c',
    parametros: [
      { nome: 'a', min: -2, max: 2, passo: 0.25, inicial: 1 },
      { nome: 'b', min: -4, max: 4, passo: 0.5, inicial: -2 },
      { nome: 'c', min: -5, max: 5, passo: 0.5, inicial: -3 },
    ],
    montar: (p) => polinomio([
      [valor(p, 'a'), 'x^2'],
      [valor(p, 'b'), 'x'],
      [valor(p, 'c'), ''],
    ]),
    foraDoTipo: (p) => (valor(p, 'a') === 0 ? 'Com a = 0, some o termo em x²: vira afim ou constante. A quadrática exige a ≠ 0.' : null),
    janela: [-5, 6, -7, 9],
  },
  {
    tipo: 'modular',
    rotulo: 'Modular',
    forma: () => 'f(x) = a|x - h| + k',
    parametros: [
      { nome: 'a', min: -2, max: 2, passo: 0.5, inicial: 1 },
      { nome: 'h', min: -3, max: 3, passo: 0.5, inicial: 1 },
      { nome: 'k', min: -3, max: 3, passo: 0.5, inicial: -2 },
    ],
    montar: (p) =>
      valor(p, 'a') === 0
        ? polinomio([[valor(p, 'k'), '']])
        : mais(
            vezes(
              valor(p, 'a'),
              `abs(${polinomio([
                [1, 'x'],
                [-valor(p, 'h'), ''],
              ])})`,
            ),
            valor(p, 'k'),
          ),
    foraDoTipo: (p) => (valor(p, 'a') === 0 ? 'Com a = 0, o módulo some e sobra a constante k.' : null),
    janela: [-5, 5, -5, 5],
  },
  {
    tipo: 'exponencial',
    rotulo: 'Exponencial',
    forma: () => 'f(x) = a^x',
    parametros: [{ nome: 'a', min: 0.2, max: 3, passo: 0.1, inicial: 2 }],
    montar: (p) => `${valor(p, 'a')}^x`,
    foraDoTipo: (p) => (valor(p, 'a') === 1 ? 'Com a = 1, 1ˣ = 1 para todo x: vira constante. A exponencial exige a > 0 e a ≠ 1.' : null),
    janela: [-4, 4, -1.5, 8.5],
  },
  {
    tipo: 'logarítmica',
    rotulo: 'Logarítmica',
    forma: () => 'f(x) = log_a x',
    parametros: [{ nome: 'a', min: 0.2, max: 4, passo: 0.1, inicial: 2 }],
    montar: (p) => `log(x, ${valor(p, 'a')})`,
    foraDoTipo: (p) =>
      valor(p, 'a') === 1 ? 'Com a = 1, nenhum expoente leva 1 a outro número: log₁ x não existe. A base precisa ser positiva e diferente de 1.' : null,
    janela: [-1, 9, -5, 5],
  },
  {
    tipo: 'trigonométrica',
    rotulo: 'Trigonométrica',
    forma: (v) => `f(x) = A ${v}(Bx) + D`,
    variantes: ['sen', 'cos', 'tg'],
    parametros: [
      { nome: 'A', min: -3, max: 3, passo: 0.5, inicial: 1 },
      { nome: 'B', min: 0.5, max: 3, passo: 0.5, inicial: 1 },
      { nome: 'D', min: -2, max: 2, passo: 0.5, inicial: 0 },
    ],
    montar: (p, v) =>
      valor(p, 'A') === 0 ? polinomio([[valor(p, 'D'), '']]) : mais(vezes(valor(p, 'A'), `${v}(${vezes(valor(p, 'B'), 'x')})`), valor(p, 'D')),
    foraDoTipo: (p) => (valor(p, 'A') === 0 ? 'Com A = 0 a onda some: sobra a constante D.' : null),
    janela: [-2 * Math.PI, 2 * Math.PI, -4.5, 4.5],
    pi: true,
  },
];

export interface CasoDoLimite {
  rotulo: string;
  f: string;
  ponto: string;
  a: number;
  /** Distância inicial de x até a; o controle vai dela até um décimo de milésimo dela. */
  hMax: number;
  janela: Janela;
}

export const LAB_LIMITES: CasoDoLimite[] = [
  { rotulo: 'Furo', f: '(x^2 - 4)/(x - 2)', ponto: '2', a: 2, hMax: 1.5, janela: [-1, 5, -1, 7] },
  { rotulo: 'sen x / x', f: 'sen(x)/x', ponto: '0', a: 0, hMax: 4, janela: [-7, 7, -0.6, 1.5] },
  { rotulo: 'Salto', f: 'abs(x)/x', ponto: '0', a: 0, hMax: 1.5, janela: [-3, 3, -2.2, 2.2] },
  { rotulo: 'Infinito', f: '1/x^2', ponto: '0', a: 0, hMax: 1.5, janela: [-3, 3, -1, 12] },
  { rotulo: 'Oscila', f: 'sen(1/x)', ponto: '0', a: 0, hMax: 0.5, janela: [-0.6, 0.6, -1.7, 1.7] },
  // a velocidade média nos h segundos depois de o freio entrar: [s(1 + h) − s(1)]/h, com h no lugar de x
  { rotulo: '🚗 Velocidade ao frear', f: '(20*x - 2*x^2)/x', ponto: '0', a: 0, hMax: 1.8, janela: [-2, 6, -2, 28] },
];

export interface CasoDaDerivada {
  rotulo: string;
  f: string;
  /** Onde o ponto P começa, e até onde o controle o leva. */
  x0: number;
  faixa: [number, number];
  hMax: number;
  janela: Janela;
  pi?: boolean;
}

export const LAB_DERIVADAS: CasoDaDerivada[] = [
  { rotulo: 'x²', f: 'x^2', x0: 1, faixa: [-2.5, 2.5], hMax: 2, janela: [-3, 3, -1.5, 9] },
  { rotulo: 'x³ − 3x', f: 'x^3 - 3*x', x0: -0.5, faixa: [-2.2, 2.2], hMax: 1.5, janela: [-2.6, 2.6, -4.5, 4.5] },
  { rotulo: 'sen x', f: 'sen(x)', x0: 1, faixa: [-6, 6], hMax: 2, janela: [-2 * Math.PI, 2 * Math.PI, -2, 2], pi: true },
  { rotulo: 'eˣ', f: 'e^x', x0: 0.5, faixa: [-2.5, 1.8], hMax: 1.5, janela: [-3, 2.5, -1.5, 9] },
  { rotulo: '🚗 Posição s(t)', f: '-2*x^2 + 24*x - 2', x0: 2, faixa: [1, 4], hMax: 1.5, janela: [0, 7, -6, 78] },
];

/**
 * O h da secante no laboratório de derivadas: começa no máximo e encolhe mil vezes enquanto o
 * controle vai de 0 a 1. Perto da borda direita, Q passa para a esquerda de P (h negativo), ou
 * h começa menor, para Q nunca sair da janela.
 */
export function passoDaSecante(caso: CasoDaDerivada, x0: number, fracao: number): number {
  const [direita, esquerda] = [caso.janela[1] - x0, x0 - caso.janela[0]];
  const sinal = direita >= Math.min(caso.hMax, esquerda) ? 1 : -1;
  const maximo = Math.min(caso.hMax, 0.92 * (sinal > 0 ? direita : esquerda));
  return sinal * maximo * 10 ** (-3 * fracao);
}

export interface CasoDaIntegral {
  rotulo: string;
  f: string;
  a: string;
  b: string;
  janela: Janela;
  pi?: boolean;
}

export const LAB_INTEGRAIS: CasoDaIntegral[] = [
  { rotulo: 'x² de 0 a 2', f: 'x^2', a: '0', b: '2', janela: [-0.4, 2.4, -0.6, 4.8] },
  { rotulo: 'sen x de 0 a π', f: 'sen(x)', a: '0', b: 'pi', janela: [-0.4, 3.6, -0.4, 1.4], pi: true },
  { rotulo: 'sen x de 0 a 2π', f: 'sen(x)', a: '0', b: '2*pi', janela: [-0.5, 6.8, -1.4, 1.4], pi: true },
  { rotulo: 'eˣ de 0 a 1', f: 'e^x', a: '0', b: '1', janela: [-0.3, 1.3, -0.3, 3.1] },
  { rotulo: '🚗 v(t) de 1 a 4', f: '24 - 4*x', a: '1', b: '4', janela: [0.4, 4.6, -2, 24] },
];

// ─── O carro e a lombada: o movimento do laboratório ──────────────────────────

/** O carro da história: 20 m/s (72 km/h), lombada a 62 m, 1 s de reação, freada de 4 m/s², no máximo 30 km/h na lombada. */
export const CARRO = { velocidade: 20, distancia: 62, reacao: 1, freada: 4, limiteKmH: 30 } as const;

/** Como o carro chega à lombada, para um tempo de reação e uma freada. Distâncias em m, tempos em s, velocidades em m/s. */
export interface ChegadaNaLombada {
  reacao: number;
  freada: number;
  /** Quando chega à lombada; se parar antes, quando para. */
  tempo: number;
  /** Velocidade na lombada (0 se parou antes). */
  velocidade: number;
  /** Metros andados durante a reação e durante a frenagem. */
  reacaoM: number;
  frenagemM: number;
  /** Freou tanto que parou antes da lombada. */
  parou: boolean;
}

/**
 * O movimento da história: v(t) = 20 até t = r e v(t) = 20 − a·(t − r) depois. A distância é a
 * integral da velocidade; igualando a 62 m sai v² = 20² − 2a·(62 − 20r) na chegada. Se esse
 * número for negativo, a velocidade zera antes: o carro para antes da lombada.
 */
export function chegadaNaLombada(reacao: number, freada: number): ChegadaNaLombada {
  const { velocidade: v0, distancia } = CARRO;
  const reacaoM = v0 * reacao;
  const sobra = distancia - reacaoM;
  if (sobra <= 0) return { reacao, freada, tempo: distancia / v0, velocidade: v0, reacaoM: distancia, frenagemM: 0, parou: false };
  const quadrado = v0 * v0 - 2 * freada * sobra;
  if (quadrado > 0) {
    const v = Math.sqrt(quadrado);
    return { reacao, freada, tempo: reacao + (v0 - v) / freada, velocidade: v, reacaoM, frenagemM: sobra, parou: false };
  }
  return { reacao, freada, tempo: reacao + v0 / freada, velocidade: 0, reacaoM, frenagemM: (v0 * v0) / (2 * freada), parou: true };
}

/** Velocidade no instante t, até a chegada (depois dela, o laboratório não desenha). */
export function velocidadeNoInstante(c: ChegadaNaLombada, t: number): number {
  return t <= c.reacao ? CARRO.velocidade : Math.max(0, CARRO.velocidade - c.freada * (t - c.reacao));
}

/** Posição no instante t, em metros desde onde o motorista viu a lombada: a integral da velocidade de 0 a t. */
export function posicaoNoInstante(c: ChegadaNaLombada, t: number): number {
  const v0 = CARRO.velocidade;
  if (t <= c.reacao) return v0 * Math.min(t, c.tempo);
  const u = Math.min(t, c.tempo) - c.reacao;
  return c.reacaoM + v0 * u - (c.freada * u * u) / 2;
}

/** Número curto para a calculadora: 25.2, e não 25.200000000000003. */
const paraConta = (v: number): string => String(Number(v.toFixed(6)));

/**
 * A frenagem como conta da calculadora: a integral da velocidade 20 + a·r − a·t, de t = r até a
 * chegada, que dá os metros andados freando. A chegada vai exata: como número quando é curto,
 * senão como expressão (1 + (20 − √148)/3), que a calculadora lê.
 */
export function contaDaFrenagem(c: ChegadaNaLombada): Conta {
  const v0 = CARRO.velocidade;
  const f = `${paraConta(v0 + c.freada * c.reacao)} - ${paraConta(c.freada)}*x`;
  const curto = Math.abs(c.tempo * 1000 - Math.round(c.tempo * 1000)) < 1e-6;
  const quadrado = v0 * v0 - 2 * c.freada * (CARRO.distancia - c.reacaoM);
  const fim = curto
    ? paraConta(c.tempo)
    : c.parou
      ? `${paraConta(c.reacao)} + ${v0}/${paraConta(c.freada)}`
      : `${paraConta(c.reacao)} + (${v0} - sqrt(${paraConta(quadrado)}))/${paraConta(c.freada)}`;
  return { modo: 'definida', f, a: paraConta(c.reacao), b: fim, resposta: String(Number(c.frenagemM.toPrecision(15))) };
}
