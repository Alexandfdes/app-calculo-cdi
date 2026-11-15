/**
 * Árvore de expressões do motor de cálculo: leitura do que o usuário digita e impressão.
 *
 * O parser do math.js é usado só para montar a árvore. Derivar, integrar e simplificar
 * são feitos por código deste projeto, regra por regra.
 */
import { isConstantNode, isFunctionNode, isOperatorNode, isParenthesisNode, isSymbolNode, parse } from 'mathjs';
import type { MathNode } from 'mathjs';

export type NomeFuncao = 'sen' | 'cos' | 'tg' | 'cotg' | 'sec' | 'csc' | 'ln' | 'raiz' | 'abs';

export type Expr =
  | { tipo: 'num'; valor: number }
  | { tipo: 'var'; nome: string }
  | { tipo: 'const'; nome: 'e' | 'pi' }
  | { tipo: 'soma'; a: Expr; b: Expr }
  | { tipo: 'sub'; a: Expr; b: Expr }
  | { tipo: 'mul'; a: Expr; b: Expr }
  | { tipo: 'div'; a: Expr; b: Expr }
  | { tipo: 'pot'; base: Expr; exp: Expr }
  | { tipo: 'neg'; a: Expr }
  | { tipo: 'func'; nome: NomeFuncao; arg: Expr }
  | { tipo: 'log'; arg: Expr; base: Expr }
  /** Marcador "(u)'" que só aparece no passo a passo das derivadas. */
  | { tipo: 'derivada'; de: Expr }
  /** Marcador "∫ u dx" que só aparece no passo a passo das integrais. */
  | { tipo: 'integral'; de: Expr; variavel: string };

/** Erro de entrada com mensagem pronta para mostrar ao usuário. */
export class ErroDeEntrada extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeEntrada';
  }
}

// ─── Construtores ──────────────────────────────────────────────────────────────

export const num = (valor: number): Expr => ({ tipo: 'num', valor });
export const variavel = (nome: string): Expr => ({ tipo: 'var', nome });
export const E: Expr = { tipo: 'const', nome: 'e' };
export const PI: Expr = { tipo: 'const', nome: 'pi' };
export const soma = (a: Expr, b: Expr): Expr => ({ tipo: 'soma', a, b });
export const sub = (a: Expr, b: Expr): Expr => ({ tipo: 'sub', a, b });
export const mul = (a: Expr, b: Expr): Expr => ({ tipo: 'mul', a, b });
export const div = (a: Expr, b: Expr): Expr => ({ tipo: 'div', a, b });
export const pot = (base: Expr, exp: Expr): Expr => ({ tipo: 'pot', base, exp });
export const neg = (a: Expr): Expr => ({ tipo: 'neg', a });
export const func = (nome: NomeFuncao, arg: Expr): Expr => ({ tipo: 'func', nome, arg });
export const logBase = (arg: Expr, base: Expr): Expr => ({ tipo: 'log', arg, base });
export const derivada = (de: Expr): Expr => ({ tipo: 'derivada', de });
export const integral = (de: Expr, nomeVariavel: string): Expr => ({ tipo: 'integral', de, variavel: nomeVariavel });

/** A expressão depende da variável? */
export function contem(e: Expr, nome: string): boolean {
  switch (e.tipo) {
    case 'num':
    case 'const':
      return false;
    case 'var':
      return e.nome === nome;
    case 'soma':
    case 'sub':
    case 'mul':
    case 'div':
      return contem(e.a, nome) || contem(e.b, nome);
    case 'pot':
      return contem(e.base, nome) || contem(e.exp, nome);
    case 'neg':
      return contem(e.a, nome);
    case 'func':
      return contem(e.arg, nome);
    case 'log':
      return contem(e.arg, nome) || contem(e.base, nome);
    case 'derivada':
      return contem(e.de, nome);
    case 'integral':
      return e.variavel === nome || contem(e.de, nome);
  }
}

export const iguais = (a: Expr, b: Expr): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Troca cada ocorrência de `alvo` (comparada pela estrutura) por `por`. */
export function trocar(e: Expr, alvo: Expr, por: Expr): Expr {
  if (iguais(e, alvo)) return por;
  switch (e.tipo) {
    case 'num':
    case 'var':
    case 'const':
      return e;
    case 'soma':
    case 'sub':
    case 'mul':
    case 'div':
      return { ...e, a: trocar(e.a, alvo, por), b: trocar(e.b, alvo, por) };
    case 'pot':
      return { ...e, base: trocar(e.base, alvo, por), exp: trocar(e.exp, alvo, por) };
    case 'neg':
      return { ...e, a: trocar(e.a, alvo, por) };
    case 'func':
      return { ...e, arg: trocar(e.arg, alvo, por) };
    case 'log':
      return { ...e, arg: trocar(e.arg, alvo, por), base: trocar(e.base, alvo, por) };
    case 'derivada':
      return { ...e, de: trocar(e.de, alvo, por) };
    case 'integral':
      return { ...e, de: trocar(e.de, alvo, por) };
  }
}

// ─── Leitura ───────────────────────────────────────────────────────────────────

/** Nomes aceitos na entrada (notação da aula e a internacional) → nome interno. */
const FUNCOES = new Map<string, NomeFuncao | 'exp' | 'log'>(Object.entries({
  sen: 'sen', sin: 'sen',
  cos: 'cos',
  tg: 'tg', tan: 'tg',
  cotg: 'cotg', cot: 'cotg',
  sec: 'sec',
  csc: 'csc', cossec: 'csc',
  ln: 'ln',
  raiz: 'raiz', sqrt: 'raiz',
  abs: 'abs',
  exp: 'exp',
  log: 'log',
}) as [string, NomeFuncao | 'exp' | 'log'][]);

/** Lê uma expressão na notação da aula. A única variável aceita é `nomeVariavel`. */
export function lerExpressao(texto: string, nomeVariavel = 'x'): Expr {
  const limpo = texto.trim();
  if (limpo === '') throw new ErroDeEntrada('Digite uma expressão.');
  let arvore: MathNode;
  try {
    arvore = parse(limpo);
  } catch {
    const dica = /\d,\d/.test(limpo) ? ' Use ponto para decimais: 2.5, não 2,5.' : '';
    throw new ErroDeEntrada(`Não consegui ler "${limpo}". Confira os parênteses e os operadores.${dica}`);
  }
  return converter(arvore, nomeVariavel);
}

function converter(no: MathNode, x: string): Expr {
  if (isParenthesisNode(no)) return converter(no.content, x);

  if (isConstantNode(no)) {
    if (typeof no.value !== 'number') throw new ErroDeEntrada(`Valor não suportado: ${String(no.value)}`);
    return num(no.value);
  }

  if (isSymbolNode(no)) {
    if (no.name === x) return variavel(x);
    if (no.name === 'e') return E;
    if (no.name === 'pi' || no.name === 'π') return PI;
    if (FUNCOES.has(no.name)) throw new ErroDeEntrada(`Use parênteses na função: ${no.name}(${x}).`);
    throw new ErroDeEntrada(`Símbolo desconhecido "${no.name}". A variável é ${x}.`);
  }

  if (isOperatorNode(no)) {
    const [a, b] = no.args.map((arg) => converter(arg, x));
    switch (no.fn) {
      case 'add': return soma(a!, b!);
      case 'subtract': return sub(a!, b!);
      case 'multiply': return mul(a!, b!);
      case 'divide': return div(a!, b!);
      case 'pow': return pot(a!, b!);
      case 'unaryMinus': return neg(a!);
      case 'unaryPlus': return a!;
      default: throw new ErroDeEntrada(`Operador não suportado: ${no.op}`);
    }
  }

  if (isFunctionNode(no)) {
    const nome = FUNCOES.get(no.fn.name);
    if (nome === undefined) throw new ErroDeEntrada(`Função desconhecida: ${no.fn.name}`);
    const args = no.args.map((arg) => converter(arg, x));
    if (nome === 'log') {
      if (args.length !== 2) {
        throw new ErroDeEntrada(`"log" sem base é ambíguo. Use ln(${x}) para o logaritmo natural ou log(${x}, 10) com a base.`);
      }
      if (contem(args[1]!, x)) throw new ErroDeEntrada('A base do logaritmo não pode depender da variável.');
      return logBase(args[0]!, args[1]!);
    }
    if (args.length !== 1) throw new ErroDeEntrada(`${no.fn.name} recebe um argumento só.`);
    return nome === 'exp' ? pot(E, args[0]!) : func(nome, args[0]!);
  }

  throw new ErroDeEntrada('Expressão não suportada. Use números, a variável, + − * / ^ e as funções da aula.');
}

// ─── Impressão ─────────────────────────────────────────────────────────────────

/** Precedência para decidir parênteses: quanto maior, mais "colado" o termo. */
function precedencia(e: Expr): number {
  switch (e.tipo) {
    case 'soma':
    case 'sub':
      return 1;
    case 'mul':
    case 'div':
      return 2;
    case 'neg':
      return 3;
    case 'pot':
      return 4;
    case 'num':
      return e.valor < 0 ? 3 : 5;
    case 'integral':
      return 2; // "∫ f dx" se comporta como um produto: 3*(∫ x dx), ∫ x dx - ∫ 1 dx
    default:
      return 5;
  }
}

const entre = (e: Expr, minimo: number): string => (precedencia(e) < minimo ? `(${paraTexto(e)})` : paraTexto(e));

/** Expressão em texto, na notação da aula e legível pelo próprio leitor (e pelo math.js). */
export function paraTexto(e: Expr): string {
  switch (e.tipo) {
    case 'num':
      return String(e.valor);
    case 'var':
      return e.nome;
    case 'const':
      return e.nome;
    case 'soma':
      return `${entre(e.a, 1)} + ${entre(e.b, 1)}`;
    case 'sub':
      return `${entre(e.a, 1)} - ${entre(e.b, 2)}`;
    case 'mul':
      return `${entre(e.a, 2)}*${entre(e.b, 4)}`;
    case 'div':
      return `${entre(e.a, 2)}/${entre(e.b, 4)}`;
    case 'neg':
      return `-${entre(e.a, 2)}`;
    case 'pot':
      return `${entre(e.base, 5)}^${atomico(e.exp) ? paraTexto(e.exp) : `(${paraTexto(e.exp)})`}`;
    case 'func':
      return `${e.nome === 'raiz' ? 'sqrt' : e.nome}(${paraTexto(e.arg)})`;
    case 'log':
      return `log(${paraTexto(e.arg)}, ${paraTexto(e.base)})`;
    case 'derivada':
      return `(${paraTexto(e.de)})'`;
    case 'integral':
      return `∫ ${entre(e.de, 2)} d${e.variavel}`;
  }
}

/** Expoentes que dispensam parênteses: número não negativo, variável ou constante. */
const atomico = (e: Expr): boolean =>
  (e.tipo === 'num' && e.valor >= 0) || e.tipo === 'var' || e.tipo === 'const';

// ─── Texto para ler ────────────────────────────────────────────────────────────

const SOBRESCRITO: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '−': '⁻', x: 'ˣ',
};
const SUBSCRITO: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};

const numeroLido = (v: number): string => {
  const texto = String(Number(Math.abs(v).toPrecision(10)));
  return v < 0 ? `−${texto}` : texto;
};

const lido = (e: Expr, minimo: number): string => (precedencia(e) < minimo ? `(${paraLeitura(e)})` : paraLeitura(e));

/**
 * A expressão para ler numa frase, como no caderno: x² − 4x − 5, 3·2ˣ, 2 sen x, |x − 2|,
 * log₁₀ x. Não volta para o leitor: para isso existe paraTexto.
 */
export function paraLeitura(e: Expr): string {
  switch (e.tipo) {
    case 'num':
      return numeroLido(e.valor);
    case 'var':
      return e.nome;
    case 'const':
      return e.nome === 'pi' ? 'π' : 'e';
    case 'soma':
      if (e.b.tipo === 'num' && e.b.valor < 0) return `${lido(e.a, 1)} − ${numeroLido(-e.b.valor)}`;
      if (e.b.tipo === 'neg') return `${lido(e.a, 1)} − ${lido(e.b.a, 2)}`;
      return `${lido(e.a, 1)} + ${lido(e.b, 1)}`;
    case 'sub':
      return `${lido(e.a, 1)} − ${lido(e.b, 2)}`;
    case 'mul':
      return `${lido(e.a, 2)}${juntarFatores(e.a, e.b)}${lido(e.b, 4)}`;
    case 'div':
      return `${lido(e.a, 2)}/${lido(e.b, 4)}`;
    case 'neg':
      return `−${lido(e.a, 2)}`;
    case 'pot':
      return potenciaLida(e.base, e.exp);
    case 'func':
      if (e.nome === 'abs') return `|${paraLeitura(e.arg)}|`;
      if (e.nome === 'raiz') return `√${atomico(e.arg) ? paraLeitura(e.arg) : `(${paraLeitura(e.arg)})`}`;
      return `${e.nome}${argumentoLido(e.arg)}`;
    case 'log': {
      const base = paraLeitura(e.base);
      if (!/^\d+$/.test(base)) return `log(${paraLeitura(e.arg)}, ${base})`;
      return `log${[...base].map((c) => SUBSCRITO[c]).join('')}${argumentoLido(e.arg)}`;
    }
    case 'derivada':
      return `(${paraLeitura(e.de)})′`;
    case 'integral':
      return `∫ ${lido(e.de, 2)} d${e.variavel}`;
  }
}

/** sen x e ln x sem parênteses quando o argumento é só a variável (ou um número, ou uma constante). */
const argumentoLido = (arg: Expr): string =>
  atomico(arg) ? ` ${paraLeitura(arg)}` : arg.tipo === 'func' && arg.nome === 'abs' ? paraLeitura(arg) : `(${paraLeitura(arg)})`;

/** 2x, 2π, 2(x + 1) e 2|x| colados; 2 sen x com espaço; 3·2ˣ e o resto com ponto. */
function juntarFatores(a: Expr, b: Expr): string {
  const letra = b.tipo === 'var' || b.tipo === 'const' || (b.tipo === 'pot' && (b.base.tipo === 'var' || b.base.tipo === 'const'));
  const barra = b.tipo === 'func' && (b.nome === 'abs' || b.nome === 'raiz');
  const numero = a.tipo === 'num' || (a.tipo === 'neg' && a.a.tipo === 'num');
  if (numero && (letra || barra || precedencia(b) < 4)) return '';
  if ((b.tipo === 'func' && !barra) || b.tipo === 'log') return ' ';
  return '·';
}

/** Expoente simples vira sobrescrito (x², 2ˣ, e⁻²ˣ); o resto fica com ^: 2^(x + 1). */
function potenciaLida(base: Expr, exp: Expr): string {
  const expoente = paraLeitura(exp);
  const inteiroPositivo = exp.tipo === 'num' && Number.isInteger(exp.valor) && exp.valor > 0;
  const sobrescrito = (t: string): string => [...t].map((c) => SOBRESCRITO[c] ?? c).join('');
  // sen² x, como nos slides; |x|² e o resto das funções ganham parênteses só quando precisam
  if ((base.tipo === 'func' && base.nome !== 'abs') || base.tipo === 'log') {
    if (inteiroPositivo && base.tipo === 'func' && base.nome !== 'raiz') return `${base.nome}${sobrescrito(expoente)}${argumentoLido(base.arg)}`;
    return `(${paraLeitura(base)})${inteiroPositivo ? sobrescrito(expoente) : `^(${expoente})`}`;
  }
  const corpo = lido(base, 5);
  if (expoente !== '' && expoente !== '−' && /^−?\d*x?$/.test(expoente)) return corpo + sobrescrito(expoente);
  return `${corpo}^${atomico(exp) ? expoente : `(${expoente})`}`;
}

// ─── Valor numérico ────────────────────────────────────────────────────────────

/**
 * Expoente racional p/q com q ímpar (1/3, 2/3, −5/7…), na forma irredutível; senão, null.
 * São os expoentes em que bᵉ é real também para b < 0: ∛−8 = −2.
 */
export function fracaoDeIndiceImpar(e: number): { p: number; q: number } | null {
  if (!Number.isFinite(e)) return null;
  for (let q = 1; q <= 99; q += 2) {
    const p = Math.round(e * q);
    if (Math.abs(p - e * q) <= 1e-9 * q) return { p, q };
  }
  return null;
}

/** bᵉ nos reais: com b < 0 e e = p/q, q ímpar, vale (−1)ᵖ·|b|ᵉ (o JavaScript daria NaN). */
export function potenciaReal(b: number, e: number): number {
  if (b < 0 && !Number.isInteger(e)) {
    const f = fracaoDeIndiceImpar(e);
    if (f) return (f.p % 2 === 0 ? 1 : -1) * Math.abs(b) ** e;
  }
  return b ** e;
}

/** Só números reais finitos; o resto (divisão por zero, ln de negativo…) vira NaN. */
const real = (v: number): number => (Number.isFinite(v) ? v : Number.NaN);

function funcaoNumerica(nome: NomeFuncao, t: number): number {
  switch (nome) {
    case 'sen':
      return Math.sin(t);
    case 'cos':
      return Math.cos(t);
    case 'tg':
      return Math.tan(t);
    case 'cotg':
      return 1 / Math.tan(t);
    case 'sec':
      return 1 / Math.cos(t);
    case 'csc':
      return 1 / Math.sin(t);
    case 'ln':
      return Math.log(t);
    case 'raiz':
      return Math.sqrt(t);
    case 'abs':
      return Math.abs(t);
  }
}

/**
 * Valor da expressão com as variáveis em `valores`; NaN onde ela não tem valor real.
 * Atenção: tg(π/2) em ponto flutuante dá ~1,6·10¹⁶, não NaN. Para saber onde uma expressão
 * não existe, olhe a estrutura dela (zeros de cos, de denominadores…), não o tamanho do valor.
 */
export function avaliar(e: Expr, valores: Record<string, number> = {}): number {
  switch (e.tipo) {
    case 'num':
      return e.valor;
    case 'var':
      return valores[e.nome] ?? Number.NaN;
    case 'const':
      return e.nome === 'e' ? Math.E : Math.PI;
    case 'soma':
      return real(avaliar(e.a, valores) + avaliar(e.b, valores));
    case 'sub':
      return real(avaliar(e.a, valores) - avaliar(e.b, valores));
    case 'mul':
      return real(avaliar(e.a, valores) * avaliar(e.b, valores));
    case 'div':
      return real(avaliar(e.a, valores) / avaliar(e.b, valores));
    case 'pot':
      return real(potenciaReal(avaliar(e.base, valores), avaliar(e.exp, valores)));
    case 'neg':
      return -avaliar(e.a, valores);
    case 'func':
      return real(funcaoNumerica(e.nome, avaliar(e.arg, valores)));
    case 'log':
      return real(Math.log(avaliar(e.arg, valores)) / Math.log(avaliar(e.base, valores)));
    case 'derivada':
    case 'integral':
      throw new Error('Marcador do passo a passo não tem valor numérico.');
  }
}
