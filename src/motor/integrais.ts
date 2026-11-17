/**
 * Motor de integrais: aplica as regras da Aula 4 uma de cada vez e registra o passo a passo.
 *
 * Cada passo mostra a regra como ela aparece no slide, com as integrais ainda pendentes
 * escritas como ∫ u dx. Os passos seguintes resolvem essas pendências. A substituição segue
 * o quadro 5: escolhe u = g(x), calcula du = g'(x) dx, integra em u e volta para x.
 *
 * Regras: as seis da lista do projeto (constante, potência, soma/subtração, exponencial,
 * trigonométrica e substituição), mais o múltiplo constante e ∫ 1/x dx = ln|x|, a exceção
 * da potência (quadros 2, 3 e 9). Antes de desistir, o integrando é reescrito com álgebra:
 * distributiva, propriedades das potências e divisão de polinômios. Também sabe as técnicas
 * da aula que vão além da lista: integração por partes (quadro 6), frações parciais
 * (quadro 7) e a arco-tangente, ∫ 1/(1 + x²) dx = arctg x. As identidades trigonométricas
 * (sen²x) ficam de fora: o motor avisa em vez de dar resposta errada.
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
  | 'reescrita'
  | 'simplificação'
  | 'por partes'
  | 'frações parciais'
  | 'arco-tangente'
  | 'identidade trigonométrica';

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

/** A escolha da integração por partes: ∫ u dv = u·v − ∫ v du. */
export interface Partes {
  u: Expr;
  dv: Expr;
  du: Expr;
  v: Expr;
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
  /** Só na integração por partes. */
  partes?: Partes;
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
    const { regra, expansao, substituicao, partes } = aplicarRegra(e, v);
    // Passo final (sem pendências) aparece simplificado; os outros, na forma do slide.
    const passo: PassoIntegral = {
      regra,
      integrando: e,
      variavel: v,
      expansao: temPendencia(expansao) ? expansao : simplificar(expansao),
    };
    if (substituicao) passo.substituicao = substituicao;
    if (partes) passo.partes = partes;
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
  reescrita: 'Reescrever antes de integrar',
  simplificação: 'Simplificação',
  'por partes': 'Integração por partes',
  'identidade trigonométrica': 'Identidade trigonométrica',
  'frações parciais': 'Frações parciais',
  'arco-tangente': 'Integral da arco-tangente',
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
    const du = vale(s.du, 1) ? `d${p.variavel}` : `${textoDoIntegrando(s.du)} d${p.variavel}`; // du = dx, e não du = 1 dx
    const troca = `${s.variavel} = ${paraTexto(s.u)}, d${s.variavel} = ${du}`;
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
  partes?: Partes;
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
      if (quadrado) return { regra: 'trigonométrica', expansao: quadrado };
      const identidade = quadradoPelaIdentidade(base, exp, v);
      if (identidade) return identidade;
      return outrasTecnicas(e, v);
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
    case 'arctg':
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
  // a reescrita vem antes de separar a constante: 3x(x + 1) sai x³ + 3x²/2, e não 3·(x³/3 + x²/2)
  const reescrita = reescrever(e, v);
  if (reescrita) return { regra: 'reescrita', expansao: integral(reescrita, v) };
  const { k, resto } = separarConstante(e, v);
  if (!vale(k, 1)) return { regra: 'múltiplo constante', expansao: mul(k, integral(resto, v)) };
  const simplificada = simplificar(e);
  if (!iguais(simplificada, e)) return { regra: 'simplificação', expansao: integral(simplificada, v) };
  const parciais = fracoesParciais(e, v);
  if (parciais) return parciais;
  const ciclica = partesCiclica(e, v);
  if (ciclica) return ciclica;
  const partes = porPartes(e, v);
  if (partes) return partes;
  throw new ErroDeEntrada(semRegra(e, v));
}

// ─── Identidades do arco duplo (quadro 9) ──────────────────────────────────────

/**
 * sen²u = (1 − cos 2u)/2, cos²u = (1 + cos 2u)/2, tg²u = sec²u − 1 e cotg²u = csc²u − 1:
 * o quadrado vira algo que as outras regras integram.
 */
function quadradoPelaIdentidade(base: Expr, exp: Expr, v: string): Aplicacao | null {
  if (!vale(exp, 2) || base.tipo !== 'func' || !contem(base.arg, v)) return null;
  const u = base.arg;
  const metade = div(num(1), num(2));
  const cos2u = mul(metade, func('cos', simplificar(mul(num(2), u))));
  const identidade: Expr | null =
    base.nome === 'sen'
      ? sub(metade, cos2u)
      : base.nome === 'cos'
        ? soma(metade, cos2u)
        : base.nome === 'tg'
          ? sub(pot(func('sec', u), num(2)), num(1))
          : base.nome === 'cotg'
            ? sub(pot(func('csc', u), num(2)), num(1))
            : null;
  if (!identidade) return null;
  return { regra: 'identidade trigonométrica', expansao: integral(identidade, v) };
}

// ─── Integração por partes (quadro 6) ──────────────────────────────────────────

/**
 * ∫ eᵃˣ·sen(bx) dx e ∫ eᵃˣ·cos(bx) dx: por partes duas vezes a integral volta a aparecer,
 * e isolá-la dá a fórmula fechada eᵃˣ·(a·sen(bx) − b·cos(bx))/(a² + b²) (e a do cosseno,
 * com os sinais trocados). Vale com qualquer argumento do primeiro grau.
 */
function partesCiclica(e: Expr, v: string): Aplicacao | null {
  const lista = fatoresDeCima(e);
  if (!lista || lista.length !== 2) return null;
  const expo = lista.find((f) => f.tipo === 'pot' && iguais(f.base, E) && contem(f.exp, v));
  const trig = lista.find((f) => f.tipo === 'func' && (f.nome === 'sen' || f.nome === 'cos') && contem(f.arg, v));
  if (!expo || expo.tipo !== 'pot' || !trig || trig.tipo !== 'func') return null;
  const inclinacao = (g: Expr): Fracao | null => {
    const p = comoPotencias(g, v);
    const c = p && coeficientes(p);
    return c && c.length === 2 ? c[1]! : null;
  };
  const a = inclinacao(expo.exp);
  const b = inclinacao(trig.arg);
  if (!a || !b || b[0] === 0) return null;
  const den = somaF(vezesF(a, a), vezesF(b, b));
  const fa = vezesF(a, fracao(den[1], den[0]));
  const fb = vezesF(b, fracao(den[1], den[0]));
  const seno = mul(fracaoExpr(fa), func('sen', trig.arg));
  const cosseno = mul(fracaoExpr(fb), func('cos', trig.arg));
  const parentese = trig.nome === 'sen' ? sub(seno, cosseno) : soma(mul(fracaoExpr(fa), func('cos', trig.arg)), mul(fracaoExpr(fb), func('sen', trig.arg)));
  return { regra: 'por partes', expansao: simplificar(mul(expo, parentese)) };
}

/**
 * ∫ u dv = u·v − ∫ v du. A escolha de u segue o LIATE: primeiro o logaritmo ou a arco-tangente
 * (que viram algébricas ao derivar), depois o polinômio (que desce de grau a cada passo), com
 * dv sendo a exponencial, o seno ou o cosseno. Assim a nova integral é sempre mais simples.
 */
function porPartes(e: Expr, v: string): Aplicacao | null {
  const lista = fatoresDeCima(e);
  if (!lista) return null;
  const logaritmica = (f: Expr): boolean => (f.tipo === 'func' && (f.nome === 'ln' || f.nome === 'arctg')) || f.tipo === 'log';
  const naoPolinomio = (f: Expr): boolean => contem(f, v) && !polinomio(f, v);
  const escolher = (): number => {
    const outros = lista.filter(naoPolinomio);
    const i = lista.findIndex((f) => logaritmica(f) && contem(f, v));
    if (i >= 0 && outros.length === 1) return i;
    const j = lista.findIndex((f) => contem(f, v) && polinomio(f, v));
    if (j >= 0 && outros.length === 1 && dvSimples(outros[0]!, v)) return j;
    return -1;
  };
  const i = escolher();
  if (i < 0) return null;
  const u = lista[i]!;
  const dv = simplificar(lista.filter((_, k) => k !== i).reduce<Expr>((p, q) => mul(p, q), num(1)));
  const du = derivadaDe(u, v);
  if (!du) return null;
  let V: Expr;
  try {
    V = integrar(dv, v).resultado;
  } catch {
    return null;
  }
  const nova = simplificar(mul(V, du));
  if (iguais(nova, e)) return null;
  return { regra: 'por partes', expansao: sub(mul(u, V), integral(nova, v)), partes: { u, dv, du, v: V } };
}

/** O que serve de dv no LIATE: eˣ, aˣ, sen e cos de um argumento do 1.º grau. */
function dvSimples(f: Expr, v: string): boolean {
  const linear = (a: Expr): boolean => {
    const p = comoPotencias(a, v);
    const c = p && coeficientes(p);
    return !!c && c.length === 2;
  };
  if (f.tipo === 'pot' && !contem(f.base, v)) return linear(f.exp);
  if (f.tipo === 'func' && (f.nome === 'sen' || f.nome === 'cos')) return linear(f.arg);
  return false;
}

/** Os fatores de um produto sem quociente; null se houver divisão. */
function fatoresDeCima(e: Expr): Expr[] | null {
  if (e.tipo === 'mul') {
    const [a, b] = [fatoresDeCima(e.a), fatoresDeCima(e.b)];
    return a && b ? [...a, ...b] : null;
  }
  if (e.tipo === 'div') return null;
  return [e];
}

// ─── Frações parciais (quadro 7) e arco-tangente ───────────────────────────────

/**
 * R(x)/Q(x), com grau de R menor que o de Q, vira soma de frações simples: A/(x − r)ᵏ para
 * cada raiz racional r de Q e (Bx + C)/(ax² + bx + c) para o fator de grau 2 sem raiz real.
 * Os coeficientes saem de um sistema linear resolvido em frações exatas.
 */
function fracoesParciais(e: Expr, v: string): Aplicacao | null {
  if (e.tipo !== 'div') return null;
  const [cima, baixo] = [comoPotencias(e.a, v), comoPotencias(e.b, v)];
  const R = cima && coeficientes(cima);
  const Q = baixo && coeficientes(baixo);
  if (!R || !Q || Q.length < 2 || R.length >= Q.length) return null;
  const x = variavel(v);
  // grau 2 sem raiz real: completa o quadrado e cai na arco-tangente
  if (Q.length === 3) {
    const [c, b, a] = Q.map(valorF) as [number, number, number];
    if (b * b - 4 * a * c < 0) return quadraticaSemRaiz(R, Q, e.b, v);
  }
  const fatorado = fatorar(Q);
  if (!fatorado) return null;
  const { raizes, sobra } = fatorado;
  // cada fração simples e o polinômio que multiplica o seu numerador quando se tira o mínimo
  const termos: { base: Fracao[]; denominador: Expr; linear: boolean }[] = [];
  const porRaiz = (r: Fracao): Fracao[] => [[-r[0], r[1]], [1, 1]];
  for (const { r, m } of raizes) {
    const xr = r[0] === 0 ? x : r[0] < 0 ? soma(x, fracaoExpr([-r[0], r[1]])) : sub(x, fracaoExpr(r));
    for (let k = 1; k <= m; k++) {
      let base: Fracao[] = sobra;
      for (const outra of raizes) {
        const vezes = outra === raizes.find((z) => z.r === r) ? m - k : outra.m;
        for (let j = 0; j < vezes; j++) base = multiplicarC(base, porRaiz(outra.r));
      }
      termos.push({ base, denominador: k === 1 ? xr : pot(xr, num(k)), linear: false });
    }
  }
  if (sobra.length === 3) {
    let base: Fracao[] = [[1, 1]];
    for (const { r, m } of raizes) for (let j = 0; j < m; j++) base = multiplicarC(base, porRaiz(r));
    const q = paraExpressao(dosCoeficientes(sobra), v);
    termos.push({ base: multiplicarC(base, [[0, 1], [1, 1]]), denominador: q, linear: true });
    termos.push({ base, denominador: q, linear: false });
  } else if (sobra.length !== 1) {
    return null;
  }
  if (termos.length < 2) return null; // um fator só: a substituição ou a potência resolvem
  const n = Q.length - 1;
  const matriz = Array.from({ length: n }, (_, linha) => [
    ...termos.map((t): Fracao => t.base[linha] ?? [0, 1]),
    R[linha] ?? ([0, 1] as Fracao),
  ]);
  const solucao = resolverSistema(matriz);
  if (!solucao) return null;
  const parcelas: Expr[] = [];
  for (let i = 0; i < termos.length; i++) {
    const t = termos[i]!;
    const k = solucao[i]!;
    if (t.linear) {
      // Bx/q e C/q ficam no mesmo denominador
      const C = solucao[i + 1]!;
      i++;
      if (k[0] === 0 && C[0] === 0) continue;
      // numerador com inteiros e o denominador comum para fora: (-4x - 66)/q vezes 1/1025
      const comum = (k[1] * C[1]) / mdc(k[1], C[1]);
      const numerador = simplificar(soma(mul(num((k[0] * comum) / k[1]), x), num((C[0] * comum) / C[1])));
      const fracaoSimples = div(numerador, t.denominador);
      parcelas.push(comum === 1 ? fracaoSimples : mul(fracaoExpr([1, comum]), fracaoSimples));
      continue;
    }
    if (k[0] !== 0) parcelas.push(div(fracaoExpr(k), t.denominador));
  }
  if (parcelas.length === 0 || (parcelas.length === 1 && iguais(simplificar(parcelas[0]!), simplificar(e)))) return null;
  const expansao = parcelas.map((p) => integral(p, v)).reduce((a, b) => soma(a, b));
  return { regra: 'frações parciais', expansao };
}

/**
 * ∫ (Bx + C)/(ax² + bx + c) dx sem raiz real: a parte com 2ax + b em cima sai por substituição,
 * num ln, e o resto D/(ax² + bx + c), completando o quadrado, dá (2D/√Δ)·arctg((2ax + b)/√Δ),
 * com Δ = 4ac − b².
 */
function quadraticaSemRaiz(R: Fracao[], Q: Fracao[], denominador: Expr, v: string): Aplicacao {
  const x = variavel(v);
  const [c, b, a] = Q as [Fracao, Fracao, Fracao];
  const B = R[1] ?? ([0, 1] as Fracao);
  const C = R[0] ?? ([0, 1] as Fracao);
  const divF = (p: Fracao, q: Fracao): Fracao => vezesF(p, fracao(q[1], q[0]));
  const doisA = vezesF([2, 1], a);
  const derivadaDeQ = simplificar(soma(mul(fracaoExpr(doisA), x), fracaoExpr(b)));
  const D = somaF(C, vezesF([-1, 1], divF(vezesF(B, b), doisA))); // C − B·b/(2a)
  const delta = somaF(vezesF([4, 1], vezesF(a, c)), vezesF([-1, 1], vezesF(b, b))); // 4ac − b²
  const exata = raizExata(delta);
  // com √Δ exata, tudo vira fração: 1/(x² + 1) dá arctg x, e não 2·arctg(2x/√4)/√4
  const arco = exata
    ? simplificar(
        mul(
          fracaoExpr(divF(vezesF([2, 1], D), exata)),
          func('arctg', soma(mul(fracaoExpr(divF(doisA, exata)), x), fracaoExpr(divF(b, exata)))),
        ),
      )
    : simplificar(mul(div(fracaoExpr(vezesF([2, 1], D)), func('raiz', fracaoExpr(delta))), func('arctg', div(derivadaDeQ, func('raiz', fracaoExpr(delta))))));
  if (B[0] === 0) return { regra: 'arco-tangente', expansao: arco };
  const parteLn = mul(fracaoExpr(divF(B, doisA)), integral(div(derivadaDeQ, denominador), v));
  if (D[0] === 0) return { regra: 'frações parciais', expansao: parteLn };
  return { regra: 'frações parciais', expansao: soma(parteLn, integral(div(fracaoExpr(D), denominador), v)) };
}

/** √(p/q) como fração, quando p e q são quadrados perfeitos. */
function raizExata([p, q]: Fracao): Fracao | null {
  const [rp, rq] = [Math.round(Math.sqrt(p)), Math.round(Math.sqrt(q))];
  return p > 0 && rp * rp === p && rq * rq === q ? fracao(rp, rq) : null;
}

const fracaoExpr = ([p, q]: Fracao): Expr => {
  const cima = q === 1 ? num(Math.abs(p)) : div(num(Math.abs(p)), num(q));
  return p < 0 ? neg(cima) : cima;
};

function multiplicarC(p: Fracao[], q: Fracao[]): Fracao[] {
  const r: Fracao[] = Array.from({ length: p.length + q.length - 1 }, (): Fracao => [0, 1]);
  p.forEach((a, i) => q.forEach((b, j) => (r[i + j] = somaF(r[i + j]!, vezesF(a, b)))));
  return r;
}

/** As raízes racionais de Q, com multiplicidade, e o que sobra: uma constante ou um grau 2 sem raiz real. */
function fatorar(Q: Fracao[]): { raizes: { r: Fracao; m: number }[]; sobra: Fracao[] } | null {
  let resto = Q;
  const raizes: { r: Fracao; m: number }[] = [];
  const valorEm = (P: Fracao[], r: Fracao): Fracao => P.reduceRight<Fracao>((acc, c) => somaF(vezesF(acc, r), c), [0, 1]);
  const divisores = (k: number): number[] => {
    const m = Math.abs(k);
    if (m > 1e5) return [];
    const d: number[] = [];
    for (let i = 1; i <= m; i++) if (m % i === 0) d.push(i);
    return d;
  };
  while (resto.length > 1) {
    const mmc = resto.reduce((m, [, q]) => (m * q) / mdc(m, q), 1);
    const inteiros = resto.map(([p, q]) => (p * mmc) / q);
    const [a0, an] = [inteiros[0]!, inteiros[inteiros.length - 1]!];
    let achada: Fracao | null = a0 === 0 ? [0, 1] : null;
    if (!achada) {
      busca: for (const p of divisores(a0)) {
        for (const q of divisores(an)) {
          for (const r of [fracao(p, q), fracao(-p, q)]) {
            if (valorEm(resto, r)[0] === 0) {
              achada = r;
              break busca;
            }
          }
        }
      }
    }
    if (!achada) break;
    const raiz = achada;
    const d = dividirPolinomios(resto, [[-raiz[0], raiz[1]], [1, 1]]);
    if (!d) return null;
    resto = d.S;
    const ja = raizes.find((z) => z.r[0] === raiz[0] && z.r[1] === raiz[1]);
    if (ja) ja.m++;
    else raizes.push({ r: raiz, m: 1 });
  }
  if (resto.length > 3 || resto.length === 2) return null;
  if (resto.length === 3) {
    const [c, b, a] = resto.map(valorF) as [number, number, number];
    if (b * b - 4 * a * c >= 0) return null; // raízes irracionais: fora do alcance
  }
  return { raizes, sobra: resto };
}

/** Eliminação de Gauss em frações exatas; a última coluna é o lado direito. */
function resolverSistema(m: Fracao[][]): Fracao[] | null {
  const n = m.length;
  const a = m.map((linha) => linha.map((c): Fracao => [c[0], c[1]]));
  for (let col = 0; col < n; col++) {
    const piv = a.findIndex((linha, i) => i >= col && linha[col]![0] !== 0);
    if (piv < 0) return null;
    [a[col], a[piv]] = [a[piv]!, a[col]!];
    const p = a[col]!;
    const inv = fracao(p[col]![1], p[col]![0]);
    for (let j = col; j <= n; j++) p[j] = vezesF(p[j]!, inv);
    for (let i = 0; i < n; i++) {
      const f = a[i]![col]!;
      if (i === col || f[0] === 0) continue;
      for (let j = col; j <= n; j++) {
        const novo = somaF(a[i]![j]!, vezesF([-f[0], f[1]], p[j]!));
        if (!exata(novo)) return null;
        a[i]![j] = novo;
      }
    }
  }
  return a.map((linha) => linha[n]!);
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
    const trocada = trocar(e, g, variavel(u));
    let emU = simplificar(div(trocada, dg));
    if (contem(emU, v)) {
      // g'(x) está no integrando, mas multiplicada por uma constante que a simplificação não viu
      const comConstante = substituicaoComConstante(trocada, dg, v, u);
      if (!comConstante || contem(comConstante, v) || !confereSubstituicao(e, comConstante, g, dg, v, u)) continue;
      emU = comConstante;
    }
    if (iguais(trocar(emU, variavel(u), variavel(v)), e)) continue; // não avançou, como 1/(2x) com u = 2x
    return { variavel: u, u: g, du: dg, emU };
  }
  return null;
}

/** Pontos para comparar duas funções de x, longe de valores notáveis. */
const AMOSTRAS = [0.37, 1.23, 2.71, -0.83, -1.9, 3.3, 0.61];

/**
 * Quando a simplificação não cancela g′(x) sozinha, como em (6x + 3)(x² + x)⁴ com u = x² + x:
 * separa os fatores que dependem só de x dos que dependem só de u e confere se a parte em x é
 * um múltiplo constante de g′(x). Aqui, (6x + 3)/(2x + 1) = 3, e sobra ∫ 3u⁴ du.
 */
function substituicaoComConstante(trocada: Expr, dg: Expr, v: string, u: string): Expr | null {
  const fatoresX = { cima: [] as Expr[], baixo: [] as Expr[] };
  const fatoresU = { cima: [] as Expr[], baixo: [] as Expr[] };
  const separar = (f: Expr, emCima: boolean): boolean => {
    if (f.tipo === 'mul') return separar(f.a, emCima) && separar(f.b, emCima);
    if (f.tipo === 'div') return separar(f.a, emCima) && separar(f.b, !emCima);
    if (f.tipo === 'neg') {
      fatoresX.cima.push(num(-1));
      return separar(f.a, emCima);
    }
    if (contem(f, v) && contem(f, u)) return false;
    (contem(f, u) ? fatoresU : fatoresX)[emCima ? 'cima' : 'baixo'].push(f);
    return true;
  };
  if (!separar(trocada, true)) return null;
  const produto = (l: Expr[]): Expr => (l.length === 0 ? num(1) : l.reduce((p, q) => mul(p, q)));
  const parteX = div(produto(fatoresX.cima), produto(fatoresX.baixo));
  const razoes: number[] = [];
  for (const t of AMOSTRAS) {
    const [a, b] = [avaliar(parteX, { [v]: t }), avaliar(dg, { [v]: t })];
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(b) > 1e-9) razoes.push(a / b);
  }
  const k = razoes[0];
  if (razoes.length < 3 || k === undefined || !razoes.every((r) => Math.abs(r - k) <= 1e-9 * Math.max(1, Math.abs(k)))) return null;
  const c = racional(num(k));
  if (!c || c[0] === 0) return null;
  const constante = c[1] === 1 ? num(c[0]) : div(num(c[0]), num(c[1]));
  return simplificar(mul(constante, div(produto(fatoresU.cima), produto(fatoresU.baixo))));
}

/** f(g(x))·g′(x) volta ao integrando, conferido em pontos da amostra. */
function confereSubstituicao(e: Expr, emU: Expr, g: Expr, dg: Expr, v: string, u: string): boolean {
  let comparados = 0;
  for (const t of AMOSTRAS) {
    const esperado = avaliar(e, { [v]: t });
    const obtido = avaliar(emU, { [u]: avaliar(g, { [v]: t }) }) * avaliar(dg, { [v]: t });
    if (!Number.isFinite(esperado) || !Number.isFinite(obtido)) continue;
    if (Math.abs(esperado - obtido) > 1e-9 * Math.max(1, Math.abs(esperado))) return false;
    comparados++;
  }
  return comparados >= 3;
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

// ─── Reescrever antes de integrar ──────────────────────────────────────────────
//
// Antes de desistir, o integrando vira uma soma de potências de x: a distributiva em x(x + 1),
// as propriedades das potências em x²√x = x^(5/2) e a fração com um termo só embaixo,
// (x² + 1)/x = x + 1/x. Fração de polinômios com mais de um termo embaixo passa pela divisão,
// P = Q·S + R, quando o resto R/Q sai pelas regras do projeto. Coeficientes e expoentes ficam
// como frações exatas, para a reescrita não arredondar nada.

/** p/q, com q > 0 e sem fator comum. */
type Fracao = [number, number];

const exata = ([p, q]: Fracao): boolean => Number.isSafeInteger(p) && Number.isSafeInteger(q) && Math.abs(p) < 1e9 && q < 1e9;
const somaF = ([a, b]: Fracao, [c, d]: Fracao): Fracao => fracao(a * d + c * b, b * d);
const vezesF = ([a, b]: Fracao, [c, d]: Fracao): Fracao => fracao(a * c, b * d);
const valorF = ([p, q]: Fracao): number => p / q;

/** Soma de termos c·xⁿ, com n e c racionais; a chave é o expoente. */
type Potencias = Map<string, { n: Fracao; c: Fracao }>;

const MAX_TERMOS = 40;

function umTermo(n: Fracao, c: Fracao): Potencias {
  const p: Potencias = new Map();
  if (c[0] !== 0) p.set(`${n[0]}/${n[1]}`, { n, c });
  return p;
}

function juntar(p: Potencias, q: Potencias, sinal: 1 | -1): Potencias | null {
  const r: Potencias = new Map(p);
  for (const [k, { n, c }] of q) {
    const novo = somaF(r.get(k)?.c ?? [0, 1], [sinal * c[0], c[1]]);
    if (!exata(novo)) return null;
    if (novo[0] === 0) r.delete(k);
    else r.set(k, { n, c: novo });
  }
  return r;
}

function multiplicarP(p: Potencias, q: Potencias): Potencias | null {
  let r: Potencias | null = new Map();
  for (const a of p.values()) {
    for (const b of q.values()) {
      const [n, c] = [somaF(a.n, b.n), vezesF(a.c, b.c)];
      if (!exata(n) || !exata(c)) return null;
      r = juntar(r, umTermo(n, c), 1);
      if (!r || r.size > MAX_TERMOS) return null;
    }
  }
  return r;
}

/** Constante como fração exata (2, −1/3, 0.5); null para π, e, √2. */
function constanteExata(e: Expr): Fracao | null {
  const v = avaliar(e);
  if (!Number.isFinite(v)) return null;
  const r = racional(num(v));
  return r && Math.abs(valorF(r) - v) <= 1e-12 * Math.max(1, Math.abs(v)) ? r : null;
}

/** A expressão como soma de potências de v com coeficientes racionais, ou null. */
function comoPotencias(e: Expr, v: string): Potencias | null {
  if (!contem(e, v)) {
    const k = constanteExata(e);
    return k ? umTermo([0, 1], k) : null;
  }
  switch (e.tipo) {
    case 'var':
      return e.nome === v ? umTermo([1, 1], [1, 1]) : null;
    case 'soma':
    case 'sub': {
      const [a, b] = [comoPotencias(e.a, v), comoPotencias(e.b, v)];
      return a && b ? juntar(a, b, e.tipo === 'soma' ? 1 : -1) : null;
    }
    case 'neg': {
      const a = comoPotencias(e.a, v);
      return a ? juntar(new Map(), a, -1) : null;
    }
    case 'mul': {
      const [a, b] = [comoPotencias(e.a, v), comoPotencias(e.b, v)];
      return a && b ? multiplicarP(a, b) : null;
    }
    case 'div': {
      // só com um termo embaixo: (x² + 1)/x = x + 1/x; com mais, é a divisão de polinômios
      const [a, b] = [comoPotencias(e.a, v), comoPotencias(e.b, v)];
      const unico = b && b.size === 1 ? [...b.values()][0] : undefined;
      if (!a || !unico) return null;
      return multiplicarP(a, umTermo([-unico.n[0], unico.n[1]], fracao(unico.c[1], unico.c[0])));
    }
    case 'pot': {
      const r = contem(e.exp, v) ? null : constanteExata(e.exp);
      return r ? potenciaDe(e.base, r, v) : null;
    }
    case 'func':
      return e.nome === 'raiz' ? potenciaDe(e.arg, [1, 2], v) : null;
    default:
      return null;
  }
}

/**
 * (base)ʳ como soma de potências. Expoente fracionário só sobre a própria variável (xʳ):
 * (x²)^(1/2) é |x|, e não x. Expoente natural multiplica; inteiro negativo, só com um termo.
 */
function potenciaDe(base: Expr, [p, q]: Fracao, v: string): Potencias | null {
  if (base.tipo === 'var' && base.nome === v) return umTermo([p, q], [1, 1]);
  if (q !== 1) return null;
  const b = comoPotencias(base, v);
  if (!b) return null;
  if (p >= 0 && p <= 12) {
    let r: Potencias | null = umTermo([0, 1], [1, 1]);
    for (let i = 0; i < p && r; i++) r = multiplicarP(r, b);
    return r;
  }
  const unico = p < 0 && b.size === 1 ? [...b.values()][0] : undefined;
  if (unico) {
    let inverso: Fracao = [1, 1];
    for (let i = 0; i < -p; i++) inverso = vezesF(inverso, fracao(unico.c[1], unico.c[0]));
    const expoente = vezesF(unico.n, [p, 1]);
    return exata(inverso) && exata(expoente) ? umTermo(expoente, inverso) : null;
  }
  return null;
}

/** A soma de potências como expressão, do maior expoente para o menor: x^2/2 - x + 1/x. */
function paraExpressao(p: Potencias, v: string): Expr {
  const x = variavel(v);
  const termos = [...p.values()].sort((a, b) => valorF(b.n) - valorF(a.n));
  if (termos.length === 0) return num(0);
  const exprs = termos.map(({ n: [pn, qn], c: [pc, qc] }) => {
    const m = Math.abs(pn);
    const potencia: Expr | null = m === 0 ? null : qn === 1 ? (m === 1 ? x : pot(x, num(m))) : m === 1 && qn === 2 ? func('raiz', x) : pot(x, div(num(m), num(qn)));
    const cima = pn > 0 && potencia ? (Math.abs(pc) === 1 ? potencia : mul(num(Math.abs(pc)), potencia)) : num(Math.abs(pc));
    const embaixo = pn < 0 && potencia ? (qc === 1 ? potencia : mul(num(qc), potencia)) : qc === 1 ? null : num(qc);
    const termo = embaixo ? div(cima, embaixo) : cima;
    return pc < 0 ? neg(termo) : termo;
  });
  return exprs.reduce((acc, t) => (t.tipo === 'neg' ? sub(acc, t.a) : soma(acc, t)));
}

/** Os coeficientes (grau 0, 1, 2…) quando todos os expoentes são naturais. */
function coeficientes(p: Potencias): Fracao[] | null {
  let grau = 0;
  for (const { n } of p.values()) {
    if (n[1] !== 1 || n[0] < 0) return null;
    grau = Math.max(grau, n[0]);
  }
  const c: Fracao[] = Array.from({ length: grau + 1 }, (): Fracao => [0, 1]);
  for (const { n, c: k } of p.values()) c[n[0]] = k;
  return c;
}

const dosCoeficientes = (c: Fracao[]): Potencias => {
  const p: Potencias = new Map();
  c.forEach((k, i) => {
    if (k[0] !== 0) p.set(`${i}/1`, { n: [i, 1], c: k });
  });
  return p;
};

/** P = Q·S + R, com grau(R) < grau(Q), em frações exatas; null se o grau de P for menor. */
function dividirPolinomios(P: Fracao[], Q: Fracao[]): { S: Fracao[]; R: Fracao[] } | null {
  const dq = Q.length - 1;
  const lider = Q[dq]!;
  if (P.length - 1 < dq || lider[0] === 0) return null;
  const R = P.map((c): Fracao => [c[0], c[1]]);
  const S: Fracao[] = Array.from({ length: P.length - dq }, (): Fracao => [0, 1]);
  for (let k = P.length - 1; k >= dq; k--) {
    const coef = vezesF(R[k]!, fracao(lider[1], lider[0]));
    if (!exata(coef)) return null;
    S[k - dq] = coef;
    for (let j = 0; j <= dq; j++) {
      const novo = somaF(R[k - dq + j]!, vezesF([-coef[0], coef[1]], Q[j]!));
      if (!exata(novo)) return null;
      R[k - dq + j] = novo;
    }
  }
  return { S, R: R.slice(0, dq) };
}

/** O integrando reescrito (distributiva, potências ou divisão de polinômios), ou null se não mudar. */
function reescrever(e: Expr, v: string): Expr | null {
  const p = comoPotencias(e, v);
  if (p) {
    const nova = simplificar(paraExpressao(p, v));
    return iguais(nova, e) || iguais(nova, simplificar(e)) ? null : nova;
  }
  if (e.tipo !== 'div') return null;
  const [cima, baixo] = [comoPotencias(e.a, v), comoPotencias(e.b, v)];
  const P = cima && coeficientes(cima);
  const Q = baixo && baixo.size > 1 ? coeficientes(baixo) : null;
  if (!P || !Q) return null;
  const d = dividirPolinomios(P, Q);
  if (!d) return null;
  const quociente = simplificar(paraExpressao(dosCoeficientes(d.S), v));
  if (d.R.every((c) => c[0] === 0)) return quociente;
  // o resto R/Q precisa sair pelas regras do projeto; senão a integral pede frações parciais
  const resto = div(simplificar(paraExpressao(dosCoeficientes(d.R), v)), e.b);
  try {
    integrar(resto, v);
  } catch {
    return null;
  }
  return soma(quociente, resto);
}

// ─── Avisos para o que fica fora do projeto ────────────────────────────────────

const TRIGONOMETRICAS: ReadonlySet<NomeFuncao> = new Set<NomeFuncao>(['sen', 'cos', 'tg', 'cotg', 'sec', 'csc']);

/** Aviso para o que não tem regra no projeto, dizendo qual técnica da aula a integral pede. */
function semRegra(e: Expr, v: string): string {
  const texto = `∫ ${textoDoIntegrando(e)} d${v}`;
  const foraDoProjeto = (tecnica: string, onde: string): string =>
    `O motor não conseguiu resolver ${texto}: ela pede ${tecnica} (Aula 4, ${onde}) num caso que ele ainda não alcança.`;
  if (temModulo(e)) return `${texto}: o módulo só entra na integral definida, cortando o intervalo onde a função troca de sinal.`;
  if ((e.tipo === 'func' && e.nome === 'ln') || e.tipo === 'log') return foraDoProjeto('integração por partes', 'quadro 6');
  if (e.tipo === 'div' && polinomio(e.a, v) && polinomio(e.b, v)) {
    // denominador de grau 2 sem raiz real: o que sobra é a arco-tangente, e não frações parciais
    const baixo = comoPotencias(e.b, v);
    const q = baixo && coeficientes(baixo);
    if (q && q.length === 3) {
      const [c, b, a] = q.map(valorF) as [number, number, number];
      if (b * b - 4 * a * c < 0) {
        return `Não há regra do projeto para ${texto}: o denominador ${paraTexto(e.b)} não tem raiz real, e a integral pede a arco-tangente (∫ 1/(1 + x²) dx = arctg x + C), que fica fora das regras do projeto.`;
      }
    }
    return foraDoProjeto('frações parciais, por ser uma fração de polinômios', 'quadro 7');
  }
  if (e.tipo === 'pot' && e.base.tipo === 'func' && TRIGONOMETRICAS.has(e.base.nome)) {
    return foraDoProjeto('identidades trigonométricas de potência maior que 2', 'quadro 9');
  }
  if (e.tipo === 'mul' && fatores(e).some((f) => polinomio(f, v)) && fatores(e).some((f) => transcendente(f, v))) {
    return foraDoProjeto('integração por partes', 'quadro 6');
  }
  return `Não encontrei uma regra da Aula 4 para ${texto}. O motor usa: constante, potência, soma e diferença, múltiplo constante, exponencial, trigonométricas, substituição, integração por partes, frações parciais e arco-tangente.`;
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
    case 'div':
      return polinomio(e.a, v) && !contem(e.b, v);
    default:
      return false;
  }
}

/** Tem função (sen, ln…) ou exponencial com a variável no expoente? */
function transcendente(e: Expr, v: string): boolean {
  switch (e.tipo) {
    case 'func':
      // raiz e módulo são algébricas: x²√x sai pela potência, e não por partes
      return e.nome === 'raiz' || e.nome === 'abs' ? transcendente(e.arg, v) : true;
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
