/**
 * Motor de integrais: aplica as regras da Aula 4 uma de cada vez e registra o passo a passo.
 *
 * Cada passo mostra a regra como ela aparece no slide, com as integrais ainda pendentes
 * escritas como ∫ u dx. Os passos seguintes resolvem essas pendências. A substituição segue
 * o quadro 5: escolhe u = g(x), calcula du = g'(x) dx, integra em u e volta para x.
 *
 * Regras: as seis da lista do projeto (constante, potência, soma/subtração, exponencial,
 * trigonométrica e substituição), mais o múltiplo constante e ∫ 1/x dx = ln|x|, a exceção
 * da potência (quadros 2, 3 e 9). Por partes, frações parciais e identidades trigonométricas
 * estão na aula, mas fora da lista do projeto: o motor avisa em vez de dar resposta errada.
 */
import { derivar } from './derivadas';
import {
  E,
  ErroDeEntrada,
  avaliar,
  contem,
  div,
  func,
  iguais,
  integral,
  lerExpressao,
  mul,
  neg,
  num,
  paraTexto,
  pot,
  soma,
  sub,
  trocar,
  variavel,
} from './expressao';
import type { Expr, NomeFuncao } from './expressao';
import { simplificar } from './simplificar';

export type RegraIntegral =
  | 'constante'
  | 'potência'
  | 'logaritmo'
  | 'múltiplo constante'
  | 'soma/subtração'
  | 'exponencial'
  | 'trigonométrica'
  | 'substituição'
  | 'simplificação';

/** A troca de variável do quadro 5: u = g(x) e du = g'(x) dx. */
export interface Substituicao {
  /** A letra nova: u, ou outra se u já estiver em uso. */
  variavel: string;
  /** g(x). */
  u: Expr;
  /** g'(x), o que acompanha dx em du = g'(x) dx. */
  du: Expr;
  /** Preenchida depois de integrar em u: o resultado em u e de volta na variável de antes. */
  volta?: { emU: Expr; emX: Expr };
}

export interface PassoIntegral {
  regra: RegraIntegral;
  /** O integrando deste passo; a variável de integração é `variavel` (x, ou u numa substituição). */
  integrando: Expr;
  variavel: string;
  /** O que a regra produz; as integrais pendentes, ∫ … dx, são resolvidas nos passos seguintes. */
  expansao: Expr;
  /** Só na regra da substituição. */
  substituicao?: Substituicao;
}

export interface ResultadoIntegral {
  entrada: Expr;
  /** Uma primitiva, já simplificada. O + C fica implícito. */
  resultado: Expr;
  passos: PassoIntegral[];
  regrasUsadas: RegraIntegral[];
}

/** Integrais pendentes umas dentro das outras; nenhuma conta da aula chega perto disso. */
const PROFUNDIDADE_MAXIMA = 50;

/** Integra em relação a `x` (ou outra variável, como t no cenário do veículo). */
export function integrar(entrada: string | Expr, x = 'x'): ResultadoIntegral {
  const expr = typeof entrada === 'string' ? lerExpressao(entrada, x) : entrada;
  const passos: PassoIntegral[] = [];
  let profundidade = 0;
  const I = (e: Expr, v: string): Expr => {
    if (++profundidade > PROFUNDIDADE_MAXIMA) throw new ErroDeEntrada('Essa integral é comprida demais para o motor.');
    const { regra, expansao, substituicao } = aplicarRegra(e, v);
    // Passo final (sem pendências) aparece simplificado; os outros, na forma do slide.
    const passo: PassoIntegral = {
      regra,
      integrando: e,
      variavel: v,
      expansao: temPendencia(expansao) ? expansao : simplificar(expansao),
    };
    if (substituicao) passo.substituicao = substituicao;
    passos.push(passo);
    const resolvida = resolver(expansao, I);
    profundidade--;
    if (!substituicao) return resolvida;
    const emU = simplificar(resolvida);
    const emX = simplificar(trocar(emU, variavel(substituicao.variavel), substituicao.u));
    substituicao.volta = { emU, emX };
    return emX;
  };
  const resultado = simplificar(I(expr, x));
  return { entrada: expr, resultado, passos, regrasUsadas: [...new Set(passos.map((p) => p.regra))] };
}

const NOMES: Record<RegraIntegral, string> = {
  constante: 'Integral da constante',
  potência: 'Regra da potência',
  logaritmo: 'Integral de 1/x',
  'múltiplo constante': 'Múltiplo constante',
  'soma/subtração': 'Soma e diferença',
  exponencial: 'Integral da exponencial',
  trigonométrica: 'Integral trigonométrica',
  substituição: 'Substituição',
  simplificação: 'Simplificação',
};

/** O integrando com parênteses quando é soma ou diferença: ∫ (x + 1) dx. */
const textoDoIntegrando = (e: Expr): string => (e.tipo === 'soma' || e.tipo === 'sub' ? `(${paraTexto(e)})` : paraTexto(e));

/**
 * Um passo em texto, por exemplo "Regra da potência: ∫ x^3 dx = x^4/4 + C". A substituição
 * sai como no exemplo do quadro 5, com a volta para x:
 * "Substituição: u = x^2, du = 2*x dx. ∫ 2*x*cos(x^2) dx = ∫ cos(u) du = sen(u) + C = sen(x^2) + C".
 */
export function descreverPasso(p: PassoIntegral): string {
  const integralDoPasso = `∫ ${textoDoIntegrando(p.integrando)} d${p.variavel}`;
  const s = p.substituicao;
  if (s) {
    const troca = `${s.variavel} = ${paraTexto(s.u)}, d${s.variavel} = ${textoDoIntegrando(s.du)} d${p.variavel}`;
    const volta = s.volta ? ` = ${paraTexto(s.volta.emU)} + C = ${paraTexto(s.volta.emX)} + C` : '';
    return `${NOMES.substituição}: ${troca}. ${integralDoPasso} = ${paraTexto(p.expansao)}${volta}`;
  }
  return `${NOMES[p.regra]}: ${integralDoPasso} = ${paraTexto(p.expansao)}${temPendencia(p.expansao) ? '' : ' + C'}`;
}

// ─── Regras ────────────────────────────────────────────────────────────────────

interface Aplicacao {
  regra: RegraIntegral;
  expansao: Expr;
  substituicao?: Substituicao;
}

function aplicarRegra(e: Expr, v: string): Aplicacao {
  const x = variavel(v);
  const depende = (u: Expr) => contem(u, v);
  const ehX = (u: Expr) => u.tipo === 'var' && u.nome === v;

  if (!depende(e)) return { regra: 'constante', expansao: mul(e, x) }; // ∫ k dx = k·x

  switch (e.tipo) {
    case 'var':
      return { regra: 'potência', expansao: primitivaDaPotencia(x, [1, 1]) };
    case 'neg':
      return { regra: 'múltiplo constante', expansao: neg(integral(e.a, v)) };
    case 'soma':
    case 'sub':
      return { regra: 'soma/subtração', expansao: linearidade(e, v) };
    case 'mul': {
      if (!depende(e.a)) return { regra: 'múltiplo constante', expansao: mul(e.a, integral(e.b, v)) };
      if (!depende(e.b)) return { regra: 'múltiplo constante', expansao: mul(e.b, integral(e.a, v)) };
      const tabela = produtoDaTabela(e.a, e.b, x) ?? produtoDaTabela(e.b, e.a, x);
      return tabela ? { regra: 'trigonométrica', expansao: tabela } : outrasTecnicas(e, v);
    }
    case 'div': {
      if (!depende(e.b)) return { regra: 'múltiplo constante', expansao: mul(div(num(1), e.b), integral(e.a, v)) };
      const n = depende(e.a) ? null : expoenteDaVariavel(e.b, v);
      if (!n) return outrasTecnicas(e, v);
      // k/xⁿ = k·x⁻ⁿ; com n = 1 é a exceção da potência, ln|x|
      if (n[0] === n[1]) return { regra: 'logaritmo', expansao: mul(e.a, lnDoModulo(x)) };
      return { regra: 'potência', expansao: mul(e.a, primitivaDaPotencia(x, [-n[0], n[1]])) };
    }
    case 'pot': {
      const { base, exp } = e;
      if (depende(base) && depende(exp)) {
        throw new ErroDeEntrada('Variável na base e no expoente ao mesmo tempo (como x^x) está fora do conteúdo da disciplina.');
      }
      if (ehX(base)) {
        const n = racional(exp);
        if (!n) return { regra: 'potência', expansao: div(pot(x, soma(exp, num(1))), soma(exp, num(1))) }; // como x^pi
        if (n[0] === -n[1]) return { regra: 'logaritmo', expansao: lnDoModulo(x) };
        return { regra: 'potência', expansao: primitivaDaPotencia(x, n) };
      }
      if (ehX(exp)) return exponencial(base, x);
      const quadrado = quadradoDaTabela(base, exp, x);
      return quadrado ? { regra: 'trigonométrica', expansao: quadrado } : outrasTecnicas(e, v);
    }
    case 'func':
      return (ehX(e.arg) ? funcaoDaTabela(e.nome, x) : null) ?? outrasTecnicas(e, v);
    case 'log':
      return outrasTecnicas(e, v);
    case 'num':
    case 'const':
      return { regra: 'constante', expansao: mul(e, x) };
    case 'derivada':
    case 'integral':
      throw new Error('Marcador do passo a passo não pode aparecer na entrada.');
  }
}

/** Linhas das tabelas dos quadros 3 e 9 com a variável sozinha no argumento. */
function funcaoDaTabela(nome: NomeFuncao, x: Expr): Aplicacao | null {
  const trigonometrica = (expansao: Expr): Aplicacao => ({ regra: 'trigonométrica', expansao });
  switch (nome) {
    case 'sen':
      return trigonometrica(neg(func('cos', x)));
    case 'cos':
      return trigonometrica(func('sen', x));
    case 'tg':
      return trigonometrica(neg(lnDoModulo(func('cos', x))));
    case 'cotg':
      return trigonometrica(lnDoModulo(func('sen', x)));
    case 'sec':
      return trigonometrica(lnDoModulo(soma(func('sec', x), func('tg', x))));
    case 'csc':
      return trigonometrica(lnDoModulo(sub(func('csc', x), func('cotg', x))));
    case 'raiz':
      return { regra: 'potência', expansao: primitivaDaPotencia(x, [1, 2]) }; // √x = x^(1/2)
    case 'ln':
    case 'abs':
      return null;
  }
}

/** sec²x → tg x e csc²x → −cotg x (quadro 9). */
function quadradoDaTabela(base: Expr, exp: Expr, x: Expr): Expr | null {
  if (!vale(exp, 2) || base.tipo !== 'func' || !iguais(base.arg, x)) return null;
  if (base.nome === 'sec') return func('tg', x);
  if (base.nome === 'csc') return neg(func('cotg', x));
  return null;
}

/** sec x·tg x → sec x e csc x·cotg x → −csc x (quadro 9). */
function produtoDaTabela(a: Expr, b: Expr, x: Expr): Expr | null {
  if (a.tipo !== 'func' || b.tipo !== 'func' || !iguais(a.arg, x) || !iguais(b.arg, x)) return null;
  if (a.nome === 'sec' && b.nome === 'tg') return func('sec', x);
  if (a.nome === 'csc' && b.nome === 'cotg') return neg(func('csc', x));
  return null;
}

/** ∫ eˣ dx = eˣ e ∫ aˣ dx = aˣ/ln a, com a > 0 e a ≠ 1 (quadro 3). */
function exponencial(base: Expr, x: Expr): Aplicacao {
  if (iguais(base, E)) return { regra: 'exponencial', expansao: pot(E, x) };
  const a = avaliar(base);
  if (!(a > 0)) throw new ErroDeEntrada(`Na exponencial aˣ a base precisa ser positiva, e aqui ela é ${paraTexto(base)}.`);
  if (a === 1) return { regra: 'constante', expansao: x }; // 1ˣ = 1
  return { regra: 'exponencial', expansao: div(pot(base, x), func('ln', base)) };
}

/** ∫ (f ± g ± …) dx = ∫ f dx ± ∫ g dx ± …, com todos os termos de uma vez (quadro 2). */
function linearidade(e: Expr, v: string): Expr {
  const termos: { positivo: boolean; termo: Expr }[] = [];
  const separar = (t: Expr, positivo: boolean): void => {
    if (t.tipo === 'soma') {
      separar(t.a, positivo);
      separar(t.b, positivo);
    } else if (t.tipo === 'sub') {
      separar(t.a, positivo);
      separar(t.b, !positivo);
    } else {
      termos.push({ positivo, termo: t });
    }
  };
  separar(e, true);
  const [primeiro, ...resto] = termos;
  if (!primeiro) return integral(e, v); // não acontece: soma e diferença têm dois termos
  let resultado = primeiro.positivo ? integral(primeiro.termo, v) : neg(integral(primeiro.termo, v));
  for (const { positivo, termo } of resto) {
    resultado = positivo ? soma(resultado, integral(termo, v)) : sub(resultado, integral(termo, v));
  }
  return resultado;
}

/** Quando nenhuma linha da tabela serve: substituição, constante para fora, simplificação, ou aviso. */
function outrasTecnicas(e: Expr, v: string): Aplicacao {
  const s = tentarSubstituicao(e, v);
  if (s) {
    const { emU, ...substituicao } = s;
    return { regra: 'substituição', expansao: integral(emU, s.variavel), substituicao };
  }
  const { k, resto } = separarConstante(e, v);
  if (!vale(k, 1)) return { regra: 'múltiplo constante', expansao: mul(k, integral(resto, v)) };
  const simplificada = simplificar(e);
  if (!iguais(simplificada, e)) return { regra: 'simplificação', expansao: integral(simplificada, v) };
  throw new ErroDeEntrada(semRegra(e, v));
}

// ─── Substituição (quadro 5) ───────────────────────────────────────────────────

/**
 * Procura u = g(x) tal que o integrando seja f(u)·g'(x), a menos de uma constante. Para cada
 * candidato: troca g por u, divide por g'(x) e confere se ainda sobrou x.
 */
function tentarSubstituicao(e: Expr, v: string): (Substituicao & { emU: Expr }) | null {
  const u = letraNova(e, v);
  for (const g of candidatos(e, v)) {
    const dg = derivadaDe(g, v);
    if (!dg || vale(dg, 0)) continue;
    const emU = simplificar(div(trocar(e, g, variavel(u)), dg));
    if (contem(emU, v)) continue; // g'(x) não está no integrando
    if (iguais(trocar(emU, variavel(u), variavel(v)), e)) continue; // não avançou, como 1/(2x) com u = 2x
    return { variavel: u, u: g, du: dg, emU };
  }
  return null;
}

function derivadaDe(g: Expr, v: string): Expr | null {
  try {
    return derivar(g, v).resultado;
  } catch {
    return null;
  }
}

/**
 * Candidatos a u, na ordem em que são testados: o que está dentro de funções, expoentes,
 * bases de potências e denominadores; por fim, os próprios fatores (sen x·cos x: u = sen x).
 */
function candidatos(e: Expr, v: string): Expr[] {
  const lista: Expr[] = [];
  const incluir = (g: Expr): void => {
    if (contem(g, v) && g.tipo !== 'var' && !lista.some((h) => iguais(h, g))) lista.push(g);
  };
  const visitar = (f: Expr): void => {
    switch (f.tipo) {
      case 'func':
      case 'log':
        incluir(f.arg);
        visitar(f.arg);
        return;
      case 'pot':
        incluir(contem(f.exp, v) ? f.exp : f.base);
        visitar(f.base);
        visitar(f.exp);
        return;
      case 'div':
        visitar(f.a);
        incluir(f.b);
        visitar(f.b);
        return;
      case 'soma':
      case 'sub':
      case 'mul':
        visitar(f.a);
        visitar(f.b);
        return;
      case 'neg':
        visitar(f.a);
        return;
      default:
        return;
    }
  };
  visitar(e);
  fatores(e).forEach(incluir);
  return lista;
}

/** Os fatores de um produto ou quociente, de cima e de baixo. */
function fatores(e: Expr): Expr[] {
  if (e.tipo === 'mul' || e.tipo === 'div') return [...fatores(e.a), ...fatores(e.b)];
  if (e.tipo === 'neg') return fatores(e.a);
  return [e];
}

/** A letra da substituição: u, ou outra se u já for a variável ou aparecer no integrando. */
function letraNova(e: Expr, v: string): string {
  const letra = ['u', 'w', 's', 'z', 'p', 'q'].find((l) => l !== v && !contem(e, l));
  if (!letra) throw new ErroDeEntrada('Substituições demais umas dentro das outras.');
  return letra;
}

/** Separa o produto em constante e resto: 3·sec x·tg x = 3 · (sec x·tg x). */
function separarConstante(e: Expr, v: string): { k: Expr; resto: Expr } {
  const constantes = { cima: [] as Expr[], baixo: [] as Expr[] };
  const resto = { cima: [] as Expr[], baixo: [] as Expr[] };
  let positivo = true;
  const visitar = (f: Expr, emCima: boolean): void => {
    if (f.tipo === 'neg') {
      positivo = !positivo;
      visitar(f.a, emCima);
    } else if (f.tipo === 'mul') {
      visitar(f.a, emCima);
      visitar(f.b, emCima);
    } else if (f.tipo === 'div') {
      visitar(f.a, emCima);
      visitar(f.b, !emCima);
    } else {
      (contem(f, v) ? resto : constantes)[emCima ? 'cima' : 'baixo'].push(f);
    }
  };
  visitar(e, true);
  const produto = (l: Expr[]): Expr => (l.length === 0 ? num(1) : l.reduce((p, q) => mul(p, q)));
  const k = div(produto(constantes.cima), produto(constantes.baixo));
  return {
    k: simplificar(positivo ? k : neg(k)),
    resto: resto.baixo.length === 0 ? produto(resto.cima) : div(produto(resto.cima), produto(resto.baixo)),
  };
}

// ─── Avisos para o que fica fora do projeto ────────────────────────────────────

const TRIGONOMETRICAS: ReadonlySet<NomeFuncao> = new Set<NomeFuncao>(['sen', 'cos', 'tg', 'cotg', 'sec', 'csc']);

/** Aviso para o que não tem regra no projeto, dizendo qual técnica da aula a integral pede. */
function semRegra(e: Expr, v: string): string {
  const texto = `∫ ${textoDoIntegrando(e)} d${v}`;
  const foraDoProjeto = (tecnica: string, onde: string): string =>
    `Não há regra do projeto para ${texto}: ela pede ${tecnica} (Aula 4, ${onde}), que está na aula mas fora das regras do projeto.`;
  if (temModulo(e)) return `${texto}: o módulo só entra na integral definida, cortando o intervalo onde a função troca de sinal.`;
  if ((e.tipo === 'func' && e.nome === 'ln') || e.tipo === 'log') return foraDoProjeto('integração por partes', 'quadro 6');
  if (e.tipo === 'div' && polinomio(e.a, v) && polinomio(e.b, v)) {
    return foraDoProjeto('frações parciais, por ser uma fração de polinômios', 'quadro 7');
  }
  if (e.tipo === 'pot' && e.base.tipo === 'func' && TRIGONOMETRICAS.has(e.base.nome)) {
    return foraDoProjeto('identidades trigonométricas', 'quadro 9');
  }
  if (e.tipo === 'mul' && fatores(e).some((f) => polinomio(f, v)) && fatores(e).some((f) => transcendente(f, v))) {
    return foraDoProjeto('integração por partes', 'quadro 6');
  }
  return `Não encontrei uma regra da Aula 4 para ${texto}. O motor usa: constante, potência, soma e diferença, múltiplo constante, exponencial, trigonométricas e substituição.`;
}

/** Polinômio em v: números, v, somas, produtos e potências com expoente natural. */
function polinomio(e: Expr, v: string): boolean {
  switch (e.tipo) {
    case 'num':
    case 'const':
      return true;
    case 'var':
      return e.nome === v;
    case 'soma':
    case 'sub':
    case 'mul':
      return polinomio(e.a, v) && polinomio(e.b, v);
    case 'neg':
      return polinomio(e.a, v);
    case 'pot': {
      const n = racional(e.exp);
      return polinomio(e.base, v) && n !== null && n[1] === 1 && n[0] >= 0;
    }
    default:
      return false;
  }
}

/** Tem função (sen, ln…) ou exponencial com a variável no expoente? */
function transcendente(e: Expr, v: string): boolean {
  switch (e.tipo) {
    case 'func':
    case 'log':
      return true;
    case 'pot':
      return contem(e.exp, v) || transcendente(e.base, v);
    case 'soma':
    case 'sub':
    case 'mul':
    case 'div':
      return transcendente(e.a, v) || transcendente(e.b, v);
    case 'neg':
      return transcendente(e.a, v);
    default:
      return false;
  }
}

function temModulo(e: Expr): boolean {
  switch (e.tipo) {
    case 'func':
      return e.nome === 'abs' || temModulo(e.arg);
    case 'log':
      return temModulo(e.arg);
    case 'pot':
      return temModulo(e.base) || temModulo(e.exp);
    case 'soma':
    case 'sub':
    case 'mul':
    case 'div':
      return temModulo(e.a) || temModulo(e.b);
    case 'neg':
      return temModulo(e.a);
    default:
      return false;
  }
}

// ─── Números e potências ───────────────────────────────────────────────────────

const vale = (e: Expr, valor: number): boolean => e.tipo === 'num' && e.valor === valor;
const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));
const lnDoModulo = (u: Expr): Expr => func('ln', func('abs', u));

/** p/q com q > 0 e sem fator comum. */
function fracao(p: number, q: number): [number, number] {
  const sinal = q < 0 ? -1 : 1;
  const g = mdc(Math.abs(p), Math.abs(q)) || 1;
  return [(sinal * p) / g, (sinal * q) / g];
}

/** O número racional que a expressão representa (2, −1, 1/2, 0.5…), como [p, q]; ou null. */
function racional(e: Expr): [number, number] | null {
  if (e.tipo === 'num') {
    for (let q = 1; q <= 1000; q++) {
      const p = Math.round(e.valor * q);
      if (Math.abs(e.valor * q - p) < 1e-9) return fracao(p, q);
    }
    return null;
  }
  if (e.tipo === 'neg') {
    const r = racional(e.a);
    return r ? [-r[0], r[1]] : null;
  }
  if (e.tipo === 'div') {
    const a = racional(e.a);
    const b = racional(e.b);
    return a && b && b[0] !== 0 ? fracao(a[0] * b[1], a[1] * b[0]) : null;
  }
  return null;
}

/** ∫ xⁿ dx = xⁿ⁺¹/(n + 1), com n = p/q ≠ −1 escrito como fração: ∫ √x dx = 2·x^(3/2)/3. */
function primitivaDaPotencia(x: Expr, [p, q]: [number, number]): Expr {
  const [a, b] = fracao(p + q, q); // n + 1 = a/b
  const expoente = b === 1 ? num(a) : div(num(a), num(b));
  return div(mul(num(b), pot(x, expoente)), num(a));
}

/** n (como [p, q]) se a expressão for x, xⁿ ou √x; senão, null. */
function expoenteDaVariavel(e: Expr, v: string): [number, number] | null {
  if (e.tipo === 'var' && e.nome === v) return [1, 1];
  if (e.tipo === 'pot' && e.base.tipo === 'var' && e.base.nome === v) return racional(e.exp);
  if (e.tipo === 'func' && e.nome === 'raiz' && e.arg.tipo === 'var' && e.arg.nome === v) return [1, 2];
  return null;
}

// ─── Pendências ────────────────────────────────────────────────────────────────

function temPendencia(e: Expr): boolean {
  switch (e.tipo) {
    case 'integral':
      return true;
    case 'num':
    case 'var':
    case 'const':
    case 'derivada':
      return false;
    case 'soma':
    case 'sub':
    case 'mul':
    case 'div':
      return temPendencia(e.a) || temPendencia(e.b);
    case 'pot':
      return temPendencia(e.base) || temPendencia(e.exp);
    case 'neg':
      return temPendencia(e.a);
    case 'func':
      return temPendencia(e.arg);
    case 'log':
      return temPendencia(e.arg) || temPendencia(e.base);
  }
}

/** Troca cada pendência ∫ u dx pela integral de u. */
function resolver(e: Expr, I: (u: Expr, v: string) => Expr): Expr {
  switch (e.tipo) {
    case 'integral':
      return I(e.de, e.variavel);
    case 'num':
    case 'var':
    case 'const':
    case 'derivada':
      return e;
    case 'soma':
    case 'sub':
    case 'mul':
    case 'div':
      return { ...e, a: resolver(e.a, I), b: resolver(e.b, I) };
    case 'pot':
      return { ...e, base: resolver(e.base, I), exp: resolver(e.exp, I) };
    case 'neg':
      return { ...e, a: resolver(e.a, I) };
    case 'func':
      return { ...e, arg: resolver(e.arg, I) };
    case 'log':
      return { ...e, arg: resolver(e.arg, I), base: resolver(e.base, I) };
  }
}
