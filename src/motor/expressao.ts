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
  | { tipo: 'derivada'; de: Expr };

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
  }
}

export const iguais = (a: Expr, b: Expr): boolean => JSON.stringify(a) === JSON.stringify(b);

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
  }
}

/** Expoentes que dispensam parênteses: número não negativo, variável ou constante. */
const atomico = (e: Expr): boolean =>
  (e.tipo === 'num' && e.valor >= 0) || e.tipo === 'var' || e.tipo === 'const';
