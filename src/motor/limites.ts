/**
 * Motor de limites (Aula 2). Segue o roteiro do quadro 11: tenta a substituição direta; se
 * der forma indeterminada, usa fatoração, racionalização ou um limite fundamental; olha os
 * limites laterais quando precisa; e classifica a continuidade no ponto (quadros 8 e 9).
 *
 * As contas são simbólicas, com as propriedades do quadro 4 (soma, produto, quociente,
 * potência, composição). A única parte numérica é o estudo do sinal perto do ponto: de que
 * lado um denominador chega a zero, ou se o que está dentro de |…| é positivo ou negativo.
 * Isso é feito testando valores bem perto de a, como na tabela de sinais do papel.
 *
 * Funções por partes (o cenário do veículo) entram no formato x < 5 ? 2*x : 10 - 3*(x - 5),
 * lido só aqui: os outros motores continuam recusando condicional.
 */
import { isConditionalNode, isOperatorNode, isParenthesisNode, isSymbolNode, parse } from 'mathjs';
import type { MathNode } from 'mathjs';
import { E, ErroDeEntrada, PI, avaliar, contem, div, fracaoDeIndiceImpar, func, iguais, lerExpressao, mul, neg, num, paraTexto, pot, potenciaReal, soma, sub, trocar, variavel } from './expressao';
import type { Expr, NomeFuncao } from './expressao';
import { derivar } from './derivadas';
import { numeroParaLer } from './numeros';
import { comoPolinomio, dividirPorRaiz, grau, lider, paraExpr, zeraEm } from './polinomios';
import type { Polinomio } from './polinomios';
import { simplificar } from './simplificar';

/** Valor de um limite lateral (ou no infinito). "sem valor": f não existe desse lado perto do ponto. */
export type ValorLimite = number | '+∞' | '-∞' | 'oscila' | 'sem valor';
export type Descontinuidade = 'removível' | 'infinita' | 'salto' | 'essencial';

export type TecnicaLimite =
  | 'substituição direta'
  | 'por partes'
  | 'forma indeterminada'
  | 'fatoração'
  | 'racionalização'
  | 'limite fundamental'
  | 'limite infinito'
  | 'módulo'
  | 'oscilação'
  | 'confronto'
  | 'limite no infinito'
  | 'limites laterais'
  | 'continuidade'
  | 'ordem de crescimento'
  | 'mudança de variável'
  | 'L’Hôpital';

export interface PassoLimite {
  tecnica: TecnicaLimite;
  /** O passo em uma frase, com as expressões escritas como no leitor (x^2, sqrt). */
  texto: string;
  /** Uma cadeia de contas, para mostrar como A = B = C. */
  contas?: Expr[];
}

/** f por partes: uma fórmula à esquerda do corte e outra à direita. */
export interface PorPartes {
  corte: number;
  /** O corte como foi escrito (para mostrar 5, ou π). */
  textoCorte: Expr;
  esquerda: Expr;
  direita: Expr;
  /** O valor em x = corte vem da fórmula da esquerda (x <= c) ou da direita (x < c)? */
  corteNaEsquerda: boolean;
}

export type FuncaoDoLimite = { tipo: 'expressao'; e: Expr } | ({ tipo: 'partes' } & PorPartes);

export interface ResultadoLimite {
  funcao: FuncaoDoLimite;
  /** O ponto: um número, ou ±Infinity. */
  a: number;
  /** O ponto como expressão (para mostrar π); null no infinito. */
  ponto: Expr | null;
  /** Só no ponto finito. */
  esquerda?: ValorLimite;
  direita?: ValorLimite;
  limite: ValorLimite | 'não existe';
  /** Forma exata quando o número sozinho não diz tudo, como ln(2). */
  exato?: Expr;
  /** f(a), quando existe (só no ponto finito). */
  valorEmA: number | null;
  /** Ausente quando f é contínua em a, e no infinito. */
  descontinuidade?: Descontinuidade;
  passos: PassoLimite[];
  /** O que o resultado diz sobre a função, em uma ou duas frases. */
  interpretacao: string;
}

// ─── Leitura ───────────────────────────────────────────────────────────────────

const INFINITOS: Record<string, 1 | -1> = {
  '∞': 1,
  '+∞': 1,
  inf: 1,
  '+inf': 1,
  infinito: 1,
  '+infinito': 1,
  infinity: 1,
  '+infinity': 1,
  oo: 1,
  '+oo': 1,
  '-∞': -1,
  '−∞': -1,
  '-inf': -1,
  '-infinito': -1,
  '-infinity': -1,
  '-oo': -1,
};

/** O ponto do limite: número, expressão constante (pi, 2*pi, e) ou infinito (inf, -inf, ∞). */
export function lerPonto(ponto: number | string, x = 'x'): { a: number; expr: Expr | null } {
  if (typeof ponto === 'number') {
    if (Number.isNaN(ponto)) throw new ErroDeEntrada('O ponto do limite precisa ser um número.');
    return { a: ponto, expr: Number.isFinite(ponto) ? num(ponto) : null };
  }
  const limpo = ponto.trim().toLowerCase().replace(/\s+/g, '');
  if (limpo === '') throw new ErroDeEntrada('Digite o ponto para onde x vai, por exemplo 2, pi ou inf.');
  const sinal = INFINITOS[limpo];
  if (sinal !== undefined) return { a: sinal * Number.POSITIVE_INFINITY, expr: null };
  const expr = lerExpressao(ponto, x);
  if (contem(expr, x)) throw new ErroDeEntrada(`O ponto do limite não pode depender de ${x}.`);
  const a = avaliar(expr);
  if (!Number.isFinite(a)) throw new ErroDeEntrada(`"${ponto}" não é um número real. Para o infinito, use inf ou -inf.`);
  return { a, expr };
}

/** Lê f; aceita função por partes no formato x < c ? f1 : f2 (também <=, > e >=). */
export function lerFuncaoDoLimite(texto: string, x = 'x'): FuncaoDoLimite {
  if (!texto.includes('?')) return { tipo: 'expressao', e: lerExpressao(texto, x) };
  const formato = `Use o formato ${x} < 5 ? 2*${x} : 10 - 3*(${x} - 5): a primeira fórmula vale quando a condição é verdadeira.`;
  let no: MathNode;
  try {
    no = parse(texto.trim());
  } catch {
    throw new ErroDeEntrada(`Não consegui ler a função por partes. ${formato}`);
  }
  if (!isConditionalNode(no)) throw new ErroDeEntrada(`Não consegui ler a função por partes. ${formato}`);
  let condicao: MathNode = no.condition;
  while (isParenthesisNode(condicao)) condicao = condicao.content;
  if (!isOperatorNode(condicao) || condicao.args.length !== 2) throw new ErroDeEntrada(`A condição precisa comparar ${x} com um número. ${formato}`);
  const [esq, dir] = condicao.args as [MathNode, MathNode];
  const inverso: Record<string, string> = { smaller: 'larger', smallerEq: 'largerEq', larger: 'smaller', largerEq: 'smallerEq' };
  let operador: string = condicao.fn;
  let numero: MathNode;
  if (isSymbolNode(esq) && esq.name === x) numero = dir;
  else if (isSymbolNode(dir) && dir.name === x) {
    numero = esq;
    operador = inverso[operador] ?? operador;
  } else throw new ErroDeEntrada(`A condição precisa comparar ${x} com um número. ${formato}`);
  if (!(operador in inverso)) throw new ErroDeEntrada(`Use <, <=, > ou >= na condição. ${formato}`);
  let textoCorte: Expr;
  try {
    textoCorte = lerExpressao(numero.toString(), x);
  } catch {
    throw new ErroDeEntrada(`A condição precisa comparar ${x} com um número. ${formato}`);
  }
  const corte = avaliar(textoCorte);
  if (contem(textoCorte, x) || !Number.isFinite(corte)) throw new ErroDeEntrada(`O corte da função por partes precisa ser um número. ${formato}`);
  const verdadeira = lerExpressao(no.trueExpr.toString(), x);
  const falsa = lerExpressao(no.falseExpr.toString(), x);
  const menor = operador === 'smaller' || operador === 'smallerEq';
  return {
    tipo: 'partes',
    corte,
    textoCorte,
    esquerda: menor ? verdadeira : falsa,
    direita: menor ? falsa : verdadeira,
    corteNaEsquerda: operador === 'smallerEq' || operador === 'larger',
  };
}

/** Valor de f em t, escolhendo a fórmula certa quando f é por partes. */
export function avaliarFuncao(f: FuncaoDoLimite, t: number, x = 'x'): number {
  if (f.tipo === 'expressao') return avaliar(f.e, { [x]: t });
  const naEsquerda = t < f.corte || (t === f.corte && f.corteNaEsquerda);
  return avaliar(naEsquerda ? f.esquerda : f.direita, { [x]: t });
}

// ─── Valores com infinito ──────────────────────────────────────────────────────

type Lado = 1 | -1;
/** Para onde x vai: um ponto a, por um dos lados, ou o infinito. */
type Alvo = { a: number; lado: Lado } | { infinito: Lado };

type Valor =
  | { tipo: 'finito'; v: number; exato?: Expr }
  | { tipo: 'infinito'; sinal: Lado }
  | { tipo: 'oscila'; limitada: boolean }
  | { tipo: 'sem valor' }
  | { tipo: 'indeterminada'; forma: string; limitada?: boolean };

interface Contexto {
  x: string;
  passos: PassoLimite[];
  profundidade: number;
  /** O ponto como foi escrito, para mostrar x − π em vez de x − 3.14159. */
  ponto: Expr | null;
  /** Quantas contas ainda cabem: a recursão reabre subexpressões que crescem a cada derivada. */
  orcamento: { restante: number };
  /** Quantas vezes seguidas a regra de L'Hôpital já foi usada. */
  derivadas?: number;
}

const finito = (v: number, exato?: Expr): Valor => (Number.isFinite(v) ? { tipo: 'finito', v: Math.abs(v) < 1e-12 ? 0 : v, exato } : { tipo: 'sem valor' });
const infinito = (sinal: number): Valor => ({ tipo: 'infinito', sinal: sinal > 0 ? 1 : -1 });
const indeterminada = (forma: string): Valor => ({ tipo: 'indeterminada', forma });
const ehZero = (v: Valor): boolean => v.tipo === 'finito' && v.v === 0;
const textoInfinito = (sinal: number): string => (sinal > 0 ? '+∞' : '−∞');
const bonito = numeroParaLer;

/** sem valor ou indeterminada em algum dos dois: isso decide o resultado. */
const problema = (...valores: Valor[]): Valor | null => valores.find((v) => v.tipo === 'sem valor' || v.tipo === 'indeterminada') ?? null;

function textoDoValor(v: Valor): string {
  switch (v.tipo) {
    case 'finito':
      return v.exato ? paraTexto(v.exato) : bonito(v.v);
    case 'infinito':
      return textoInfinito(v.sinal);
    case 'oscila':
      return 'oscila';
    case 'sem valor':
      return 'sem valor';
    case 'indeterminada':
      return v.forma;
  }
}

const textoDoLado = (alvo: Alvo): string => ('a' in alvo ? (alvo.lado < 0 ? 'Pela esquerda' : 'Pela direita') : 'No infinito');

function registrar(ctx: Contexto, tecnica: TecnicaLimite, texto: string, contas?: Expr[]): void {
  if (ctx.passos.some((p) => p.tecnica === tecnica && p.texto === texto)) return;
  ctx.passos.push(contas ? { tecnica, texto, contas } : { tecnica, texto });
}

/** Mesmo contexto, mas sem guardar passos: para contas auxiliares (o u de um limite fundamental vai a 0?). */
const silencioso = (ctx: Contexto): Contexto => ({ ...ctx, passos: [] });

// ─── Estudo do sinal ───────────────────────────────────────────────────────────

/** Sinal de g perto do alvo (1, −1), ou 0 se não der para dizer (troca de sinal sem parar, ou g sem valor). */
function sinalPerto(g: Expr, alvo: Alvo, x: string): -1 | 0 | 1 {
  const pontos =
    'a' in alvo ? [1e-3, 1e-4, 1e-5].map((h) => alvo.a + alvo.lado * h * Math.max(1, Math.abs(alvo.a))) : [1e3, 1e4, 1e5].map((t) => alvo.infinito * t);
  const sinais = pontos.map((t) => Math.sign(avaliar(g, { [x]: t })));
  if (sinais.every((s) => s === 1)) return 1;
  if (sinais.every((s) => s === -1)) return -1;
  return 0;
}

/**
 * Algum pedaço de e fica sem valor em t, olhando a estrutura e não o tamanho do número:
 * em ponto flutuante tg(π/2) dá ~1,6·10¹⁶, e não infinito, porque cos(π/2) dá 6·10⁻¹⁷.
 */
function singularEm(e: Expr, t: number, x: string): boolean {
  const zera = (u: Expr): boolean => Math.abs(avaliar(u, { [x]: t })) < 1e-12;
  switch (e.tipo) {
    case 'div':
      return zera(e.b) || singularEm(e.a, t, x) || singularEm(e.b, t, x);
    case 'pot':
      return (!contem(e.exp, x) && avaliar(e.exp) < 0 && zera(e.base)) || singularEm(e.base, t, x) || singularEm(e.exp, t, x);
    case 'func':
      if ((e.nome === 'tg' || e.nome === 'sec') && zera(func('cos', e.arg))) return true;
      if ((e.nome === 'cotg' || e.nome === 'csc') && zera(func('sen', e.arg))) return true;
      if (e.nome === 'ln' && zera(e.arg)) return true;
      return singularEm(e.arg, t, x);
    case 'log':
      return zera(e.arg) || singularEm(e.arg, t, x);
    case 'soma':
    case 'sub':
    case 'mul':
      return singularEm(e.a, t, x) || singularEm(e.b, t, x);
    case 'neg':
      return singularEm(e.a, t, x);
    default:
      return false;
  }
}

/** f é contínua no ponto, desse lado: existe em a e logo ao lado. Aí o limite é f(a). */
function substituicao(e: Expr, alvo: { a: number; lado: Lado }, x: string): Valor | null {
  const v = avaliar(e, { [x]: alvo.a });
  if (!Number.isFinite(v) || singularEm(e, alvo.a, x)) return null;
  const h = 1e-6 * Math.max(1, Math.abs(alvo.a));
  return Number.isFinite(avaliar(e, { [x]: alvo.a + alvo.lado * h })) ? finito(v) : null;
}

// ─── O limite, regra por regra ─────────────────────────────────────────────────

function limite(e: Expr, alvo: Alvo, ctx: Contexto): Valor {
  if (--ctx.orcamento.restante < 0) return indeterminada('uma conta comprida demais');
  const v = limiteDireto(e, alvo, ctx);
  if (v.tipo !== 'indeterminada' || ctx.profundidade > 60) return v;
  const dentro: Contexto = { ...ctx, profundidade: ctx.profundidade + 1 };
  if ((e.tipo === 'soma' || e.tipo === 'sub') && v.forma === '∞ − ∞') {
    const l = diferencaDeLogs(e, alvo, dentro);
    if (l) return l;
  }
  // ∞ − ∞ com raiz: o conjugado; e, no infinito, a ordem de crescimento
  if (e.tipo === 'sub' && v.forma === '∞ − ∞') {
    const c = conjugadoNoInfinito(e.a, e.b, alvo, dentro);
    if (c) return c;
  }
  if ('infinito' in alvo) {
    const c = porCrescimento(e, alvo.infinito, dentro);
    if (c) return c;
  }
  return pelaDerivada(e, v.forma, alvo, dentro) ?? v;
}

// ─── Último recurso: a regra de L'Hôpital ──────────────────────────────────────

/**
 * Formas que as técnicas da Aula 2 não desfazem: 0/0 e ∞/∞ vão para L'Hôpital; 0·∞ vira ∞/∞
 * (x·ln x = ln x / (1/x)); e potências com x na base e no expoente, como xˣ, viram e^(x·ln x).
 */
function pelaDerivada(e: Expr, forma: string, alvo: Alvo, ctx: Contexto): Valor | null {
  if (ctx.profundidade > 40 || ctx.orcamento.restante <= 0) return null;
  const serve = (v: Valor | null): v is Valor => v !== null && v.tipo !== 'indeterminada';
  if (e.tipo === 'div') {
    if (forma === '0/0' || forma === '∞/∞') {
      const r = lHopital(e.a, e.b, forma, alvo, ctx);
      if (r) return r;
    }
    // a soma em cima dividida termo a termo: (x + sen x)/x = 1 + sen x/x
    const [N, D] = [e.a, e.b];
    if (N.tipo === 'soma' || N.tipo === 'sub') {
      const [p, q] = [limite(div(N.a, D), alvo, ctx), limite(div(N.b, D), alvo, ctx)];
      const total = somar(p, N.tipo === 'soma' ? q : oposto(q));
      if (serve(total) && total.tipo !== 'oscila') return total;
    }
    // e a soma embaixo, pelo inverso: x/(x + sen x) é 1 sobre (1 + sen x/x)
    if (D.tipo === 'soma' || D.tipo === 'sub') {
      const [p, q] = [limite(div(D.a, N), alvo, ctx), limite(div(D.b, N), alvo, ctx)];
      const inverso = somar(p, D.tipo === 'soma' ? q : oposto(q));
      if (inverso.tipo === 'finito' && inverso.v !== 0) return finito(1 / inverso.v);
      if (inverso.tipo === 'infinito') return finito(0);
    }
    const simples = simplificar(e);
    if (!iguais(simples, e)) {
      const r = limite(simples, alvo, ctx);
      if (serve(r)) return r;
    }
    return null;
  }
  if (e.tipo === 'mul' && forma === '0 · ∞') {
    const la = limiteDireto(e.a, alvo, ctx);
    const [vaiAZero, vaiAoInfinito] = la.tipo === 'finito' && la.v === 0 ? [e.a, e.b] : [e.b, e.a];
    // duas escritas: ∞/(1/0) e 0/(1/∞); x·ln x pede a primeira, x·cotg x = x/tg x pede a segunda
    return (
      lHopital(vaiAoInfinito, div(num(1), vaiAZero), '∞/∞', alvo, ctx) ??
      lHopital(vaiAZero, simplificar(div(num(1), vaiAoInfinito)), '0/0', alvo, ctx)
    );
  }
  if (e.tipo === 'pot' && contem(e.base, ctx.x) && contem(e.exp, ctx.x)) {
    // base negativa perto do ponto: a potência não tem valor real ali
    if ('a' in alvo && sinalPerto(e.base, alvo, ctx.x) < 0) return { tipo: 'sem valor' };
    const expoente = simplificar(mul(e.exp, func('ln', e.base)));
    const antes = ctx.passos.length;
    registrar(ctx, 'L’Hôpital', `Com ${ctx.x} na base e no expoente, escreve-se ${paraTexto(e)} = e^(${paraTexto(expoente)}) e calcula-se o limite do expoente.`);
    const L = limite(expoente, alvo, ctx);
    if (L.tipo === 'finito') return finito(Math.exp(L.v));
    if (L.tipo === 'infinito') return L.sinal > 0 ? infinito(1) : finito(0);
    if (L.tipo === 'sem valor') return L;
    ctx.passos.length = antes;
    return null;
  }
  return null;
}

/** k·ln(u), com k constante: o que pode se juntar num logaritmo só. */
function comoLog(t: Expr, x: string): { c: number; u: Expr } | null {
  if (t.tipo === 'func' && t.nome === 'ln') return { c: 1, u: t.arg };
  if (t.tipo === 'neg') {
    const l = comoLog(t.a, x);
    return l ? { c: -l.c, u: l.u } : null;
  }
  if (t.tipo === 'mul') {
    const [k, resto] = !contem(t.a, x) ? [t.a, t.b] : !contem(t.b, x) ? [t.b, t.a] : [null, null];
    const l = k && resto ? comoLog(resto, x) : null;
    return l && k ? { c: l.c * avaliar(k), u: l.u } : null;
  }
  if (t.tipo === 'div' && !contem(t.b, x)) {
    const l = comoLog(t.a, x);
    return l ? { c: l.c / avaliar(t.b), u: l.u } : null;
  }
  return null;
}

/**
 * ∞ − ∞ entre logaritmos: ln|x − 1|/2 − ln|x + 1|/2 = (1/2)·ln|(x − 1)/(x + 1)|. Juntam-se os
 * logaritmos num só e calcula-se o limite do que fica dentro; o que não é logaritmo entra à parte.
 */
function diferencaDeLogs(e: Expr, alvo: Alvo, ctx: Contexto): Valor | null {
  const logs: { c: number; u: Expr }[] = [];
  const outros: Expr[] = [];
  const visitar = (t: Expr, sinal: 1 | -1): void => {
    if (t.tipo === 'soma' || t.tipo === 'sub') {
      visitar(t.a, sinal);
      visitar(t.b, t.tipo === 'soma' ? sinal : sinal === 1 ? -1 : 1);
      return;
    }
    const l = comoLog(t, ctx.x);
    if (l && Number.isFinite(l.c) && l.c !== 0) logs.push({ c: sinal * l.c, u: l.u });
    else outros.push(sinal > 0 ? t : neg(t));
  };
  visitar(e, 1);
  if (logs.length < 2) return null;
  const k = Math.min(...logs.map((l) => Math.abs(l.c)));
  const expoentes = logs.map((l) => l.c / k);
  if (!expoentes.every((n) => Math.abs(n - Math.round(n)) < 1e-9 && Math.abs(n) <= 12)) return null;
  let [cima, baixo]: [Expr, Expr] = [num(1), num(1)];
  logs.forEach((l, i) => {
    const n = Math.round(expoentes[i]!);
    const u = l.u.tipo === 'func' && l.u.nome === 'abs' ? l.u.arg : l.u;
    const fator = Math.abs(n) === 1 ? u : pot(u, num(Math.abs(n)));
    if (n > 0) cima = mul(cima, fator);
    else baixo = mul(baixo, fator);
  });
  const dentro = simplificar(div(cima, baixo));
  const L = limite(dentro, alvo, ctx);
  let valor: Valor;
  if (L.tipo === 'finito') valor = L.v === 0 ? infinito(-1) : finito(k * Math.log(Math.abs(L.v)));
  else if (L.tipo === 'infinito') valor = infinito(1);
  else return null;
  registrar(
    ctx,
    'forma indeterminada',
    `∞ − ∞ entre logaritmos: eles se juntam num só, ${bonito(k)}·ln|${paraTexto(dentro)}|, e o que fica dentro vai a ${textoDoValor(L)}.`,
  );
  if (outros.length === 0) return valor;
  const total = somar(valor, limite(outros.reduce((p, q) => soma(p, q)), alvo, ctx));
  return total.tipo === 'indeterminada' ? null : total;
}

/** lim N/D = lim N′/D′ quando N/D é 0/0 ou ∞/∞ (e o novo limite existe). */
function lHopital(N: Expr, D: Expr, forma: string, alvo: Alvo, ctx: Contexto): Valor | null {
  if ((ctx.derivadas ?? 0) >= 3 || ctx.orcamento.restante <= 0) return null;
  let dN: Expr;
  let dD: Expr;
  try {
    dN = derivar(N, ctx.x).resultado;
    dD = derivar(D, ctx.x).resultado;
  } catch {
    return null;
  }
  const nova = simplificar(div(dN, dD));
  if (iguais(nova, simplificar(div(N, D)))) return null;
  const antes = ctx.passos.length;
  registrar(
    ctx,
    'L’Hôpital',
    `Regra de L'Hôpital: a forma é ${forma}, então o limite é o mesmo do quociente das derivadas, ${paraTexto(dN)} sobre ${paraTexto(dD)}.`,
    [div(N, D), div(dN, dD), nova],
  );
  const r = limite(nova, alvo, { ...ctx, derivadas: (ctx.derivadas ?? 0) + 1 });
  // a regra só conclui quando o limite das derivadas existe: se ele oscila, nada se sabe do original
  if (r.tipo === 'indeterminada' || r.tipo === 'oscila') {
    ctx.passos.length = antes;
    return null;
  }
  return r;
}

function limiteDireto(e: Expr, alvo: Alvo, ctx: Contexto): Valor {
  if (ctx.profundidade > 60) return indeterminada('uma conta comprida demais');
  const dentro: Contexto = { ...ctx, profundidade: ctx.profundidade + 1 };
  if ('a' in alvo) {
    const direto = substituicao(e, alvo, ctx.x);
    if (direto) return direto;
  } else if (e.tipo !== 'var') {
    const p = comoPolinomio(e, ctx.x);
    if (p && grau(p) > 0) return polinomioNoInfinito(e, p, alvo.infinito, dentro);
  }
  switch (e.tipo) {
    case 'num':
      return finito(e.valor);
    case 'const':
      return finito(avaliar(e));
    case 'var':
      if (e.nome !== ctx.x) return { tipo: 'sem valor' };
      return 'a' in alvo ? finito(alvo.a) : infinito(alvo.infinito);
    case 'soma':
      return somar(limite(e.a, alvo, dentro), limite(e.b, alvo, dentro));
    case 'sub':
      return somar(limite(e.a, alvo, dentro), oposto(limite(e.b, alvo, dentro)));
    case 'neg':
      return oposto(limite(e.a, alvo, dentro));
    case 'mul':
      return multiplicar(limite(e.a, alvo, dentro), limite(e.b, alvo, dentro), alvo, dentro);
    case 'div':
      return quociente(e.a, e.b, alvo, dentro);
    case 'pot':
      return potencia(e.base, e.exp, alvo, dentro);
    case 'func':
      return funcao(e.nome, e.arg, alvo, dentro);
    case 'log':
      return quociente(func('ln', e.arg), func('ln', e.base), alvo, dentro);
    case 'derivada':
    case 'integral':
      throw new Error('Marcador do passo a passo não pode aparecer na entrada.');
  }
}

function oposto(v: Valor): Valor {
  if (v.tipo === 'finito') return finito(-v.v, v.exato ? simplificar(neg(v.exato)) : undefined);
  if (v.tipo === 'infinito') return infinito(-v.sinal);
  return v;
}

/** Soma (quadro 4, propriedade 1): ∞ − ∞ é indeterminada. */
function somar(p: Valor, q: Valor): Valor {
  const ruim = problema(p, q);
  if (ruim) return ruim;
  if (p.tipo === 'finito' && q.tipo === 'finito') return finito(p.v + q.v);
  if (p.tipo === 'infinito' && q.tipo === 'infinito') return p.sinal === q.sinal ? p : indeterminada('∞ − ∞');
  if (p.tipo === 'infinito') return q.tipo === 'oscila' && !q.limitada ? indeterminada('∞ + oscilação') : p;
  if (q.tipo === 'infinito') return p.tipo === 'oscila' && !p.limitada ? indeterminada('∞ + oscilação') : q;
  if (p.tipo === 'oscila' && q.tipo === 'oscila') return { tipo: 'indeterminada', forma: 'oscilação + oscilação', limitada: p.limitada && q.limitada };
  const oscila = p.tipo === 'oscila' ? p : q;
  return oscila;
}

/** Produto (propriedade 4): 0 · ∞ é indeterminada; limitado vezes algo que vai a 0 vai a 0 (confronto). */
function multiplicar(p: Valor, q: Valor, alvo: Alvo, ctx: Contexto): Valor {
  // soma de duas oscilações limitadas (sen x + cos x) vezes algo que vai a 0: confronto
  const limitada = (v: Valor): boolean => v.tipo === 'indeterminada' && v.limitada === true;
  if ((ehZero(p) && limitada(q)) || (ehZero(q) && limitada(p))) {
    registrar(ctx, 'confronto', `${textoDoLado(alvo)}, um fator fica entre dois números e o outro vai a 0: pelo teorema do confronto, o produto vai a 0 (quadro 10).`);
    return finito(0);
  }
  const ruim = problema(p, q);
  if (ruim) return ruim;
  if (p.tipo === 'finito' && q.tipo === 'finito') return finito(p.v * q.v);
  if (p.tipo === 'infinito' && q.tipo === 'infinito') return infinito(p.sinal * q.sinal);
  if (p.tipo === 'infinito' || q.tipo === 'infinito') {
    const [inf, outro] = p.tipo === 'infinito' ? [p, q] : [q as Extract<Valor, { tipo: 'infinito' }>, p];
    if (outro.tipo === 'finito') return outro.v === 0 ? indeterminada('0 · ∞') : infinito(inf.sinal * Math.sign(outro.v));
    return indeterminada('∞ · oscilação');
  }
  const [osc, outro] = p.tipo === 'oscila' ? [p, q] : [q as Extract<Valor, { tipo: 'oscila' }>, p];
  if (outro.tipo === 'finito' && outro.v === 0 && osc.limitada) {
    registrar(
      ctx,
      'confronto',
      `${textoDoLado(alvo)}, um fator fica entre dois números (oscila, mas limitado) e o outro vai a 0: pelo teorema do confronto, o produto vai a 0 (quadro 10).`,
    );
    return finito(0);
  }
  if (outro.tipo === 'finito') return { tipo: 'oscila', limitada: osc.limitada };
  return osc.limitada && outro.tipo === 'oscila' && outro.limitada ? { tipo: 'oscila', limitada: true } : indeterminada('oscilação · oscilação');
}

/** Quociente (propriedade 5) e o que acontece quando o denominador vai a 0 ou ao infinito. */
function quociente(N: Expr, D: Expr, alvo: Alvo, ctx: Contexto): Valor {
  if ('infinito' in alvo) {
    const p = comoPolinomio(N, ctx.x);
    const q = comoPolinomio(D, ctx.x);
    if (p && q && grau(q) > 0) return razaoDePolinomios(p, q, alvo.infinito, ctx);
  }
  const ln = limite(N, alvo, ctx);
  const ld = limite(D, alvo, ctx);
  const ruim = problema(ln, ld);
  if (ruim) return ruim;

  if (ld.tipo === 'finito' && ld.v !== 0) {
    if (ln.tipo === 'finito') return finito(ln.v / ld.v, ln.exato && ld.v === 1 ? ln.exato : undefined);
    if (ln.tipo === 'infinito') return infinito(ln.sinal * Math.sign(ld.v));
    return ln;
  }
  if (ld.tipo === 'finito') {
    // denominador → 0
    if (ln.tipo === 'finito' && ln.v === 0) return zeroSobreZero(N, D, alvo, ctx);
    if (ln.tipo === 'finito' || ln.tipo === 'infinito') {
      const s = sinalPerto(D, alvo, ctx.x);
      if (s === 0) return indeterminada('um denominador que vai a 0 trocando de sinal');
      const sinalDeCima = ln.tipo === 'finito' ? Math.sign(ln.v) : ln.sinal;
      const resultado = sinalDeCima * s;
      const cima = ln.tipo === 'finito' ? bonito(ln.v) : textoInfinito(ln.sinal);
      registrar(
        ctx,
        'limite infinito',
        `${textoDoLado(alvo)}, o numerador vai a ${cima} e o denominador ${paraTexto(D)} vai a 0 por valores ${s > 0 ? 'positivos' : 'negativos'}: o quociente vai a ${textoInfinito(resultado)}.`,
      );
      return infinito(resultado);
    }
    return indeterminada('oscilação / 0');
  }
  if (ld.tipo === 'infinito') {
    if (ln.tipo === 'finito') return finito(0);
    if (ln.tipo === 'oscila' && ln.limitada) {
      registrar(
        ctx,
        'confronto',
        `${textoDoLado(alvo)}, o numerador ${paraTexto(N)} fica limitado e o denominador cresce sem limite: pelo teorema do confronto, o quociente vai a 0 (quadro 10).`,
      );
      return finito(0);
    }
    if (ln.tipo === 'infinito') return indeterminada('∞/∞');
    return indeterminada('oscilação / ∞');
  }
  // denominador oscila
  if (ln.tipo === 'finito' && ln.v !== 0) return { tipo: 'oscila', limitada: false };
  return indeterminada('quociente com oscilação');
}

/** Potência (propriedade 6), exponencial (base constante) e raiz. */
function potencia(base: Expr, exp: Expr, alvo: Alvo, ctx: Contexto): Valor {
  const { x } = ctx;
  if (!contem(exp, x)) {
    const n = avaliar(exp);
    const b = limite(base, alvo, ctx);
    if (problema(b)) return b;
    if (b.tipo === 'finito') {
      if (b.v === 0 && n < 0) return quociente(num(1), pot(base, num(-n)), alvo, ctx);
      // raiz de índice par (√, x^0,3…) não existe à esquerda de 0; a de índice ímpar (∛) existe
      const impar = fracaoDeIndiceImpar(n);
      if (b.v === 0 && !impar && sinalPerto(base, alvo, x) < 0) return { tipo: 'sem valor' };
      return finito(potenciaReal(b.v, n));
    }
    if (b.tipo === 'infinito') {
      if (n === 0) return finito(1);
      if (n < 0) return finito(0);
      if (b.sinal > 0) return infinito(1);
      const impar = fracaoDeIndiceImpar(n);
      if (impar) return infinito(impar.p % 2 === 0 ? 1 : -1);
      return { tipo: 'sem valor' };
    }
    return n > 0 ? { tipo: 'oscila', limitada: b.tipo === 'oscila' && b.limitada } : indeterminada('oscilação com expoente negativo');
  }
  if (!contem(base, x)) {
    const c = avaliar(base);
    if (!(c > 0)) return { tipo: 'sem valor' };
    const L = limite(exp, alvo, ctx);
    if (problema(L)) return L;
    if (L.tipo === 'finito') return finito(c ** L.v);
    if (L.tipo === 'infinito') {
      if (c === 1) return finito(1);
      return (c > 1) === L.sinal > 0 ? infinito(1) : finito(0);
    }
    return { tipo: 'oscila', limitada: L.tipo === 'oscila' && L.limitada };
  }
  const b = limite(base, alvo, ctx);
  const L = limite(exp, alvo, ctx);
  if (b.tipo === 'finito' && b.v > 0 && L.tipo === 'finito') return finito(b.v ** L.v);
  if (b.tipo === 'finito' && Math.abs(b.v - 1) < 1e-12 && L.tipo === 'infinito') return umElevadoAoInfinito(base, exp, alvo, ctx) ?? indeterminada('1^∞');
  return indeterminada('base e expoente variando juntos (como 1^∞)');
}

/** Composição (quadro 10): lim f(g(x)) = f(lim g(x)) quando f é contínua lá; e o que acontece no infinito. */
function funcao(nome: NomeFuncao, arg: Expr, alvo: Alvo, ctx: Contexto): Valor {
  switch (nome) {
    case 'tg':
      return quociente(func('sen', arg), func('cos', arg), alvo, ctx);
    case 'cotg':
      return quociente(func('cos', arg), func('sen', arg), alvo, ctx);
    case 'sec':
      return quociente(num(1), func('cos', arg), alvo, ctx);
    case 'csc':
      return quociente(num(1), func('sen', arg), alvo, ctx);
    default:
      break;
  }
  const L = limite(arg, alvo, ctx);
  if (problema(L)) return L;
  switch (nome) {
    case 'sen':
    case 'cos':
      if (L.tipo === 'finito') return finito(nome === 'sen' ? Math.sin(L.v) : Math.cos(L.v));
      if (L.tipo === 'infinito') {
        registrar(
          ctx,
          'oscilação',
          `${textoDoLado(alvo)}, ${paraTexto(arg)} vai a ${textoInfinito(L.sinal)}, e ${nome} oscila entre −1 e 1 sem se aproximar de nenhum valor.`,
        );
      }
      return { tipo: 'oscila', limitada: true };
    case 'abs':
      if (L.tipo === 'finito') return finito(Math.abs(L.v));
      if (L.tipo === 'infinito') return infinito(1);
      return { tipo: 'oscila', limitada: L.tipo === 'oscila' && L.limitada };
    case 'ln':
      if (L.tipo === 'finito') {
        if (L.v > 0) return finito(Math.log(L.v));
        if (L.v === 0 && sinalPerto(arg, alvo, ctx.x) > 0) return infinito(-1);
        return { tipo: 'sem valor' };
      }
      if (L.tipo === 'infinito') return L.sinal > 0 ? infinito(1) : { tipo: 'sem valor' };
      return indeterminada('ln de uma oscilação');
    case 'raiz':
      if (L.tipo === 'finito') {
        if (L.v > 0) return finito(Math.sqrt(L.v));
        if (L.v === 0 && sinalPerto(arg, alvo, ctx.x) >= 0) return finito(0);
        return { tipo: 'sem valor' };
      }
      if (L.tipo === 'infinito') return L.sinal > 0 ? infinito(1) : { tipo: 'sem valor' };
      return indeterminada('raiz de uma oscilação');
    case 'arctg':
      if (L.tipo === 'finito') return finito(Math.atan(L.v));
      if (L.tipo === 'infinito') return finito((L.sinal * Math.PI) / 2, simplificar(L.sinal > 0 ? div(PI, num(2)) : neg(div(PI, num(2)))));
      return { tipo: 'oscila', limitada: true };
    default:
      return indeterminada(`${nome} de um limite`);
  }
}

// ─── Infinito (quadro 6) ───────────────────────────────────────────────────────

function polinomioNoInfinito(e: Expr, p: Polinomio, sinal: Lado, ctx: Contexto): Valor {
  const n = grau(p);
  const resultado = Math.sign(lider(p)) * (n % 2 === 1 ? sinal : 1);
  const termo = paraExpr([...new Array(n).fill(0), lider(p)], ctx.x);
  registrar(
    ctx,
    'limite no infinito',
    `No infinito, o polinômio ${paraTexto(e)} segue o termo de maior grau, ${paraTexto(termo)}, que vai a ${textoInfinito(resultado)} (quadro 6).`,
  );
  return infinito(resultado);
}

/** Quociente de polinômios no infinito: a regra dos graus (quadro 6.2). */
function razaoDePolinomios(p: Polinomio, q: Polinomio, sinal: Lado, ctx: Contexto): Valor {
  const [dp, dq, lp, lq] = [grau(p), grau(q), lider(p), lider(q)];
  if (dp < dq) {
    registrar(ctx, 'limite no infinito', `O grau de baixo (${dq}) é maior que o de cima (${dp}): o quociente vai a 0 (quadro 6).`);
    return finito(0);
  }
  if (dp === dq) {
    const exato = simplificar(div(num(lp), num(lq)));
    registrar(
      ctx,
      'limite no infinito',
      `Graus iguais (${dp}): o limite é a razão dos coeficientes líderes, ${bonito(lp)}/${bonito(lq)} = ${bonito(lp / lq)} (quadro 6).`,
    );
    return finito(lp / lq, exato);
  }
  const resultado = Math.sign(lp / lq) * ((dp - dq) % 2 === 1 ? sinal : 1);
  registrar(
    ctx,
    'limite no infinito',
    `O grau de cima (${dp}) é maior que o de baixo (${dq}): o quociente cresce sem limite e vai a ${textoInfinito(resultado)} (quadro 6).`,
  );
  return infinito(resultado);
}

// ─── 0/0: as técnicas do quadro 5 e os limites fundamentais do quadro 7 ────────

function zeroSobreZero(N: Expr, D: Expr, alvo: Alvo, ctx: Contexto): Valor {
  return (
    limiteFundamental(N, D, alvo, ctx) ??
    fatoracao(N, D, alvo, ctx) ??
    racionalizacao(N, D, alvo, ctx) ??
    mudancaDeVariavel(N, D, alvo, ctx) ??
    porEquivalentes(N, D, alvo, ctx) ??
    semModulo(div(N, D), alvo, ctx) ??
    indeterminada('0/0')
  );
}

/** O fator (x − a), ou (x − a)ⁿ, escrito com o ponto como o aluno digitou. */
function fatorDoPonto(a: number, ctx: Contexto, vezes: number): Expr {
  const x = variavel(ctx.x);
  const ponto = ctx.ponto && Math.abs(avaliar(ctx.ponto) - a) < 1e-12 ? ctx.ponto : num(a);
  const base = a === 0 ? x : a > 0 ? sub(x, ponto) : soma(x, simplificar(neg(ponto)));
  return vezes > 1 ? pot(base, num(vezes)) : base;
}

/** Divide os dois polinômios por (x − a) enquanto os dois zeram em a. */
function cancelarRaiz(p0: Polinomio, q0: Polinomio, a: number): { p: Polinomio; q: Polinomio; vezes: number } {
  let [p, q, vezes] = [p0, q0, 0];
  while (zeraEm(p, a) && zeraEm(q, a) && grau(p) > 0 && grau(q) > 0) {
    p = dividirPorRaiz(p, a);
    q = dividirPorRaiz(q, a);
    vezes++;
  }
  return { p, q, vezes };
}

const ehUm = (e: Expr): boolean => e.tipo === 'num' && e.valor === 1;

/** Fatoração (quadro 5): (x² − 4)/(x − 2) = (x − 2)(x + 2)/(x − 2) = x + 2. */
function fatoracao(N: Expr, D: Expr, alvo: Alvo, ctx: Contexto): Valor | null {
  if (!('a' in alvo)) return null;
  const p0 = comoPolinomio(N, ctx.x);
  const q0 = comoPolinomio(D, ctx.x);
  if (!p0 || !q0) return null;
  const { p, q, vezes } = cancelarRaiz(p0, q0, alvo.a);
  if (vezes === 0) return null;
  const fator = fatorDoPonto(alvo.a, ctx, vezes);
  const [P, Q] = [paraExpr(p, ctx.x), paraExpr(q, ctx.x)];
  const reduzida = ehUm(Q) ? P : div(P, Q);
  registrar(ctx, 'fatoração', `Fatoração (quadro 5): ${paraTexto(fator)} aparece em cima e embaixo e se cancela.`, [
    div(N, D),
    div(ehUm(P) ? fator : mul(fator, P), ehUm(Q) ? fator : mul(fator, Q)),
    reduzida,
  ]);
  return limite(reduzida, alvo, ctx);
}

const temRaiz = (t: Expr): boolean => (t.tipo === 'func' && t.nome === 'raiz') || (t.tipo === 'mul' && (temRaiz(t.a) || temRaiz(t.b)));

/** t², com (√u)² = u. */
function quadrado(t: Expr): Expr {
  if (t.tipo === 'func' && t.nome === 'raiz') return t.arg;
  if (t.tipo === 'mul') return mul(quadrado(t.a), quadrado(t.b));
  if (t.tipo === 'neg') return quadrado(t.a);
  return pot(t, num(2));
}

/** Racionalização (quadro 5): multiplica em cima e embaixo pelo conjugado para tirar a raiz de onde ela zera. */
function racionalizacao(N: Expr, D: Expr, alvo: Alvo, ctx: Contexto): Valor | null {
  if (!('a' in alvo)) return null;
  const tentativas: [Expr, Expr, boolean][] = [
    [N, D, true],
    [D, N, false],
  ];
  for (const [radical, outro, emCima] of tentativas) {
    if ((radical.tipo !== 'soma' && radical.tipo !== 'sub') || !(temRaiz(radical.a) || temRaiz(radical.b))) continue;
    const conjugado = radical.tipo === 'soma' ? sub(radical.a, radical.b) : soma(radical.a, radical.b);
    const produto = sub(quadrado(radical.a), quadrado(radical.b)); // (A ± B)(A ∓ B) = A² − B²
    const p0 = comoPolinomio(produto, ctx.x);
    const q0 = comoPolinomio(outro, ctx.x);
    if (!p0 || !q0) continue;
    const { p, q, vezes } = cancelarRaiz(p0, q0, alvo.a);
    if (vezes === 0) continue;
    const [P, Q] = [paraExpr(p, ctx.x), paraExpr(q, ctx.x)];
    const produtoSimples = paraExpr(p0, ctx.x);
    const intermediaria = emCima ? div(produtoSimples, mul(outro, conjugado)) : div(mul(outro, conjugado), produtoSimples);
    const reduzida = simplificar(emCima ? div(P, ehUm(Q) ? conjugado : mul(Q, conjugado)) : div(ehUm(P) ? conjugado : mul(P, conjugado), Q));
    registrar(
      ctx,
      'racionalização',
      `Racionalização (quadro 5): multiplicando em cima e embaixo pelo conjugado ${paraTexto(conjugado)}, a raiz sai ${emCima ? 'do numerador' : 'do denominador'}, porque ${paraTexto(radical)} vezes ${paraTexto(conjugado)} dá ${paraTexto(produtoSimples)}. Depois, o fator que zera em x = ${bonito(alvo.a)} se cancela.`,
      [div(N, D), intermediaria, reduzida],
    );
    return limite(reduzida, alvo, ctx);
  }
  return null;
}

// ─── 0/0 com raiz de índice qualquer: mudança de variável ──────────────────────

/** p/q de um expoente escrito como fração de inteiros (1/3, 2/3) ou como decimal exato (0.5); null para o resto. */
function expoenteRacional(e: Expr): [number, number] | null {
  if (e.tipo === 'div' && e.a.tipo === 'num' && e.b.tipo === 'num' && Number.isInteger(e.a.valor) && Number.isInteger(e.b.valor) && e.b.valor > 0) {
    return [e.a.valor, e.b.valor];
  }
  if (e.tipo === 'num') {
    for (let q = 1; q <= 12; q++) if (Number.isInteger(e.valor * q)) return [e.valor * q, q];
  }
  return null;
}

const mdcInteiro = (a: number, b: number): number => (b === 0 ? Math.abs(a) : mdcInteiro(b, a % b));

/** Os índices das raízes de x na expressão: 3 em x^(1/3), 2 em √x. Null se x aparece dentro de outra raiz. */
function indicesDasRaizes(e: Expr, x: string, achados: number[] = []): number[] | null {
  const ehX = (t: Expr): boolean => t.tipo === 'var' && t.nome === x;
  if (e.tipo === 'pot' && ehX(e.base) && !contem(e.exp, x)) {
    const f = expoenteRacional(e.exp);
    if (!f) return null;
    achados.push(f[1] / mdcInteiro(f[0], f[1]));
    return achados;
  }
  if (e.tipo === 'func' && e.nome === 'raiz') {
    if (!ehX(e.arg)) return contem(e.arg, x) ? null : achados;
    achados.push(2);
    return achados;
  }
  if (e.tipo === 'pot' && contem(e.base, x) && !contem(e.exp, x) && !Number.isInteger(avaliar(e.exp))) return null; // (x + 1)^(1/3)
  let certo = true;
  mapearFilhos(e, (t) => {
    if (indicesDasRaizes(t, x, achados) === null) certo = false;
    return t;
  });
  return certo ? achados : null;
}

/** Troca x por uᵐ: x^(p/q) vira u^(pm/q), √x vira u^(m/2). */
function trocarPorPotencia(e: Expr, x: string, u: Expr, m: number): Expr {
  const ehX = (t: Expr): boolean => t.tipo === 'var' && t.nome === x;
  if (ehX(e)) return pot(u, num(m));
  if (e.tipo === 'pot' && ehX(e.base)) {
    const f = expoenteRacional(e.exp);
    if (f) return pot(u, num(Math.round((f[0] * m) / f[1])));
  }
  if (e.tipo === 'func' && e.nome === 'raiz' && ehX(e.arg)) return pot(u, num(m / 2));
  return mapearFilhos(e, (t) => trocarPorPotencia(t, x, u, m));
}

/**
 * Mudança de variável: com u = x^(1/m), as raízes somem e sobra uma razão de polinômios em u,
 * que a fatoração resolve. (x − 8)/(∛x − 2), com u = ∛x, vira (u³ − 8)/(u − 2).
 */
function mudancaDeVariavel(N: Expr, D: Expr, alvo: Alvo, ctx: Contexto): Valor | null {
  if (!('a' in alvo)) return null;
  const { x } = ctx;
  const indices = indicesDasRaizes(div(N, D), x);
  if (!indices || indices.every((q) => q === 1)) return null;
  const m = indices.reduce((acc, q) => (acc * q) / mdcInteiro(acc, q), 1);
  if (m > 12) return null;
  // raiz de índice par só existe para x ≥ 0
  if (m % 2 === 0 && (alvo.a < 0 || (alvo.a === 0 && alvo.lado < 0))) return null;
  const nome = x === 'u' ? 'w' : 'u';
  const u = variavel(nome);
  const bruto = potenciaReal(alvo.a, 1 / m);
  const b = Math.abs(bruto - Math.round(bruto)) < 1e-9 ? Math.round(bruto) : bruto;
  const [N2, D2] = [simplificar(trocarPorPotencia(N, x, u, m)), simplificar(trocarPorPotencia(D, x, u, m))];
  if (!comoPolinomio(N2, nome) || !comoPolinomio(D2, nome)) return null;
  const raiz = m === 2 ? `√${x}` : `${x}^(1/${m})`;
  registrar(
    ctx,
    'mudança de variável',
    `Mudança de variável: com ${nome} = ${raiz}, ${x} = ${nome}^${m} e as raízes somem. Quando ${x} → ${bonito(alvo.a)}, ${nome} → ${bonito(b)}.`,
    [div(N, D), div(N2, D2)],
  );
  // ponto sem raiz exata (x → 2 com ∛x): o fator aparece como u − 2^(1/3), e não u − 1,2599…
  const ponto = Number.isInteger(b) ? null : pot(ctx.ponto ?? num(alvo.a), div(num(1), num(m)));
  return limite(div(N2, D2), { a: b, lado: alvo.lado }, { ...ctx, x: nome, ponto });
}

/** Módulo: de cada lado, |u| com u → 0 vira u ou −u, conforme o sinal de u desse lado. */
function semModulo(e: Expr, alvo: Alvo, ctx: Contexto): Valor | null {
  const trocas: string[] = [];
  const trocar = (t: Expr): Expr => {
    if (t.tipo === 'func' && t.nome === 'abs') {
      const L = limite(t.arg, alvo, silencioso(ctx));
      const s = sinalPerto(t.arg, alvo, ctx.x);
      if (ehZero(L) && s !== 0) {
        const dentro = trocar(t.arg);
        trocas.push(`${paraTexto(dentro)} ${s > 0 ? '> 0, então' : '< 0, então'} |${paraTexto(dentro)}| = ${s > 0 ? paraTexto(dentro) : paraTexto(simplificar(neg(dentro)))}`);
        return s > 0 ? dentro : neg(dentro);
      }
    }
    return mapearFilhos(t, trocar);
  };
  const sem = trocar(e);
  if (trocas.length === 0) return null;
  const simples = simplificar(sem);
  registrar(ctx, 'módulo', `${textoDoLado(alvo)}, ${trocas.join('; ')}.`, [e, simples]);
  return limite(simples, alvo, ctx);
}

function mapearFilhos(e: Expr, f: (t: Expr) => Expr): Expr {
  switch (e.tipo) {
    case 'soma':
    case 'sub':
    case 'mul':
    case 'div':
      return { ...e, a: f(e.a), b: f(e.b) };
    case 'pot':
      return { ...e, base: f(e.base), exp: f(e.exp) };
    case 'neg':
      return { ...e, a: f(e.a) };
    case 'func':
      return { ...e, arg: f(e.arg) };
    case 'log':
      return { ...e, arg: f(e.arg), base: f(e.base) };
    default:
      return e;
  }
}

// ─── Limites fundamentais (quadro 7) ───────────────────────────────────────────

interface Molde {
  u: Expr;
  /** O denominador é u² (no (1 − cos u)/u²) em vez de u. */
  quadrado: boolean;
  valor: number;
  exato?: Expr;
  regra: string;
}

/** Os moldes do quadro 7 que o numerador F pode ser. */
function moldes(F: Expr, x: string): Molde[] {
  const lista: Molde[] = [];
  if (F.tipo === 'func' && F.nome === 'sen') lista.push({ u: F.arg, quadrado: false, valor: 1, regra: 'sen(u)/u → 1' });
  if (F.tipo === 'sub' && ehUm(F.a) && F.b.tipo === 'func' && F.b.nome === 'cos') {
    lista.push({ u: F.b.arg, quadrado: true, valor: 0.5, regra: '(1 − cos u)/u² → 1/2' });
    lista.push({ u: F.b.arg, quadrado: false, valor: 0, regra: '(1 − cos u)/u → 0' });
  }
  if (F.tipo === 'sub' && ehUm(F.b) && F.a.tipo === 'pot') {
    const { base, exp } = F.a;
    if (iguais(base, E)) lista.push({ u: exp, quadrado: false, valor: 1, regra: '(eᵘ − 1)/u → 1' });
    else if (base.tipo === 'num' && base.valor > 0 && base.valor !== 1) {
      lista.push({ u: exp, quadrado: false, valor: Math.log(base.valor), exato: func('ln', base), regra: '(aᵘ − 1)/u → ln a' });
    } else if (base.tipo === 'soma' && !contem(exp, x) && (ehUm(base.a) || ehUm(base.b))) {
      const alfa = avaliar(exp);
      lista.push({ u: ehUm(base.a) ? base.b : base.a, quadrado: false, valor: alfa, regra: '((1 + u)^α − 1)/u → α' });
    }
  }
  if (F.tipo === 'func' && F.nome === 'ln' && F.arg.tipo === 'soma' && (ehUm(F.arg.a) || ehUm(F.arg.b))) {
    lista.push({ u: ehUm(F.arg.a) ? F.arg.b : F.arg.a, quadrado: false, valor: 1, regra: 'ln(1 + u)/u → 1' });
  }
  return lista;
}

/** Separa a constante de um produto: 3·sen(2x)/5 = (3/5) · sen(2x). */
function constanteVezes(e: Expr, x: string): { k: number; resto: Expr } {
  let k = 1;
  const cima: Expr[] = [];
  const baixo: Expr[] = [];
  const visitar = (f: Expr, emCima: boolean): void => {
    if (f.tipo === 'neg') {
      k = -k;
      visitar(f.a, emCima);
    } else if (f.tipo === 'mul') {
      visitar(f.a, emCima);
      visitar(f.b, emCima);
    } else if (f.tipo === 'div') {
      visitar(f.a, emCima);
      visitar(f.b, !emCima);
    } else if (!contem(f, x)) {
      const v = avaliar(f);
      k = emCima ? k * v : k / v;
    } else (emCima ? cima : baixo).push(f);
  };
  visitar(e, true);
  const produto = (l: Expr[]): Expr => (l.length === 0 ? num(1) : l.reduce((p, q) => mul(p, q)));
  return { k, resto: baixo.length === 0 ? produto(cima) : div(produto(cima), produto(baixo)) };
}

function limiteFundamental(N: Expr, D: Expr, alvo: Alvo, ctx: Contexto): Valor | null {
  if (!('a' in alvo)) return null;
  return tentarMolde(N, D, false, alvo, ctx) ?? tentarMolde(D, N, true, alvo, ctx);
}

/** F/G casa com um molde (ou G/F, invertido): F = k·molde(u), G = k'·u (ou u²), com u → 0. */
function tentarMolde(F: Expr, G: Expr, invertido: boolean, alvo: Alvo, ctx: Contexto): Valor | null {
  const { x } = ctx;
  const cima = constanteVezes(F, x);
  const baixo = constanteVezes(G, x);
  for (const m of moldes(cima.resto, x)) {
    if (invertido && m.valor === 0) continue;
    if (!ehZero(limite(m.u, alvo, silencioso(ctx)))) continue;
    const razao = simplificar(div(baixo.resto, m.quadrado ? pot(m.u, num(2)) : m.u));
    if (contem(razao, x)) continue;
    const r = avaliar(razao);
    if (!Number.isFinite(r) || r === 0) continue;
    const fator = cima.k / (baixo.k * r);
    const doMolde = fator * m.valor;
    const v = invertido ? 1 / doMolde : doMolde;
    let exato: Expr | undefined;
    if (m.exato) {
      const comFator = fator === 1 ? m.exato : simplificar(mul(num(fator), m.exato));
      exato = invertido ? simplificar(div(num(1), comFator)) : comFator;
    }
    const comU = m.u.tipo === 'var' ? '' : `, com u = ${paraTexto(m.u)}`;
    const ajuste = fator !== 1 || invertido ? ` As constantes e a posição do molde levam o resultado a ${exato ? paraTexto(exato) : bonito(v)}.` : '';
    registrar(ctx, 'limite fundamental', `Limite fundamental (quadro 7): ${m.regra} quando u → 0${comU}.${ajuste}`, [
      invertido ? div(G, F) : div(F, G),
      exato ?? simplificar(num(v)),
    ]);
    return finito(v, exato);
  }
  return null;
}

// ─── Fatores equivalentes perto do ponto (quadro 7) ────────────────────────────

/**
 * Fator que, perto do ponto, vale quase o mesmo que algo mais simples, porque o quociente dos
 * dois vai a 1 (os limites fundamentais): sen u ≈ u e tg u ≈ u com u → 0 (e, com u → kπ,
 * sen u ≈ ±(u − kπ)); 1 − cos u ≈ u²/2; eᵘ − 1 ≈ u; aᵘ − 1 ≈ u·ln a; ln(1 + u) ≈ u.
 */
function equivalente(f: Expr, alvo: Alvo, ctx: Contexto): Expr | null {
  const vaiA = (u: Expr): Valor => limite(u, alvo, silencioso(ctx));
  if (f.tipo === 'func' && (f.nome === 'sen' || f.nome === 'tg')) {
    const L = vaiA(f.arg);
    if (L.tipo !== 'finito') return null;
    const k = Math.round(L.v / Math.PI);
    if (Math.abs(L.v - k * Math.PI) > 1e-12) return null;
    const u = k === 0 ? f.arg : simplificar(sub(f.arg, mul(num(k), PI)));
    return f.nome === 'sen' && k % 2 !== 0 ? neg(u) : u;
  }
  if (f.tipo === 'sub' && ehUm(f.a) && f.b.tipo === 'func' && f.b.nome === 'cos' && ehZero(vaiA(f.b.arg))) {
    return div(pot(f.b.arg, num(2)), num(2));
  }
  if (f.tipo === 'sub' && ehUm(f.b) && f.a.tipo === 'pot' && !contem(f.a.base, ctx.x) && ehZero(vaiA(f.a.exp))) {
    if (iguais(f.a.base, E)) return f.a.exp;
    const a = avaliar(f.a.base);
    return a > 0 && a !== 1 ? mul(f.a.exp, func('ln', f.a.base)) : null;
  }
  if (f.tipo === 'func' && f.nome === 'ln' && f.arg.tipo === 'soma' && (ehUm(f.arg.a) || ehUm(f.arg.b))) {
    const u = ehUm(f.arg.a) ? f.arg.b : f.arg.a;
    return ehZero(vaiA(u)) ? u : null;
  }
  return null;
}

/** sen(5x)/sen(3x) ≈ 5x/3x: troca cada fator pelo equivalente e calcula o limite do que sobra. */
function porEquivalentes(N: Expr, D: Expr, alvo: Alvo, ctx: Contexto): Valor | null {
  if (!('a' in alvo)) return null;
  const trocas: string[] = [];
  const trocar = (e: Expr): Expr => {
    if (e.tipo === 'mul') return mul(trocar(e.a), trocar(e.b));
    if (e.tipo === 'div') return div(trocar(e.a), trocar(e.b));
    if (e.tipo === 'neg') return neg(trocar(e.a));
    const q = equivalente(e, alvo, ctx);
    if (!q) return e;
    trocas.push(`${paraTexto(e)} ≈ ${paraTexto(simplificar(q))}`);
    return q;
  };
  const nova = simplificar(div(trocar(N), trocar(D)));
  if (trocas.length === 0) return null;
  const v = limite(nova, alvo, silencioso(ctx));
  if (problema(v)) return null;
  registrar(
    ctx,
    'limite fundamental',
    `Limite fundamental (quadro 7): perto de x = ${bonito(alvo.a)}, cada fator abaixo vale quase o mesmo que uma expressão mais simples, porque o quociente dos dois vai a 1: ${trocas.join('; ')}. Trocando, sobra ${paraTexto(nova)}.`,
    [div(N, D), nova],
  );
  return limite(nova, alvo, ctx);
}

// ─── 1^∞: o limite fundamental do número e ─────────────────────────────────────

/** base − 1, escrita sem o 1: (1 + f) − 1 = f e (1 − f) − 1 = −f. */
function menosUm(base: Expr): Expr {
  if (base.tipo === 'soma' && ehUm(base.a)) return base.b;
  if (base.tipo === 'soma' && ehUm(base.b)) return base.a;
  if (base.tipo === 'sub' && ehUm(base.a)) return neg(base.b);
  return sub(base, num(1));
}

/** (1 + f)^g com f → 0 e g → ∞: o limite é e elevado ao limite de f·g, como em (1 + 1/x)^x → e. */
function umElevadoAoInfinito(base: Expr, exp: Expr, alvo: Alvo, ctx: Contexto): Valor | null {
  const produto = simplificar(mul(menosUm(base), exp));
  const M = limite(produto, alvo, silencioso(ctx));
  if (M.tipo !== 'finito' && M.tipo !== 'infinito') return null;
  const texto = `Limite fundamental (quadro 7): (1 + 1/u)^u → e. A base vai a 1 e o expoente ao infinito (forma 1^∞); o limite é e elevado ao limite de (base − 1)·expoente = ${paraTexto(produto)}`;
  if (M.tipo === 'infinito') {
    registrar(ctx, 'limite fundamental', `${texto}, que vai a ${textoInfinito(M.sinal)}.`);
    return M.sinal > 0 ? infinito(1) : finito(0);
  }
  const exato = M.v === 0 ? num(1) : M.v === 1 ? E : pot(E, simplificar(num(M.v)));
  registrar(ctx, 'limite fundamental', `${texto}, que vai a ${bonito(M.v)}. Então o limite é ${paraTexto(exato)}.`, [pot(base, exp), exato]);
  return finito(Math.exp(M.v), exato);
}

// ─── No infinito: ordem de crescimento ─────────────────────────────────────────

/** Comportamento no infinito: A·|x|^p·e^(r·|x|)·(ln|x|)^m, com o sinal de x já dentro de A e de r. */
interface Dominante {
  A: number;
  p: number;
  r: number;
  m: number;
}

const mesmaOrdem = (a: Dominante, b: Dominante): boolean => Math.abs(a.p - b.p) < 1e-12 && Math.abs(a.r - b.r) < 1e-12 && Math.abs(a.m - b.m) < 1e-12;
const maior = (a: Dominante, b: Dominante): boolean => a.r > b.r + 1e-12 || (Math.abs(a.r - b.r) <= 1e-12 && (a.p > b.p + 1e-12 || (Math.abs(a.p - b.p) <= 1e-12 && a.m > b.m)));

/** O termo que manda no infinito; null quando não dá para dizer (seno, cancelamento). */
function dominante(e: Expr, s: Lado, x: string): Dominante | null {
  if (!contem(e, x)) {
    const v = avaliar(e);
    return Number.isFinite(v) && v !== 0 ? { A: v, p: 0, r: 0, m: 0 } : null;
  }
  const p = comoPolinomio(e, x);
  if (p && grau(p) > 0) {
    const d = grau(p);
    return { A: lider(p) * s ** d, p: d, r: 0, m: 0 };
  }
  const junta = (a: Dominante | null, b: Dominante | null, k: 1 | -1): Dominante | null =>
    a && b ? { A: k > 0 ? a.A * b.A : a.A / b.A, p: a.p + k * b.p, r: a.r + k * b.r, m: a.m + k * b.m } : null;
  switch (e.tipo) {
    case 'mul':
      return junta(dominante(e.a, s, x), dominante(e.b, s, x), 1);
    case 'div':
      return junta(dominante(e.a, s, x), dominante(e.b, s, x), -1);
    case 'neg': {
      const a = dominante(e.a, s, x);
      return a ? { ...a, A: -a.A } : null;
    }
    case 'soma':
    case 'sub': {
      const a = dominante(e.a, s, x);
      const b0 = dominante(e.b, s, x);
      if (!a || !b0) return null;
      const b = e.tipo === 'sub' ? { ...b0, A: -b0.A } : b0;
      if (!mesmaOrdem(a, b)) return maior(a, b) ? a : b;
      const A = a.A + b.A;
      return Math.abs(A) > 1e-12 * Math.max(Math.abs(a.A), Math.abs(b.A)) ? { ...a, A } : null; // cancelou: não dá para dizer
    }
    case 'pot': {
      if (!contem(e.exp, x)) {
        const n = avaliar(e.exp);
        const b = dominante(e.base, s, x);
        if (!b || (b.A < 0 && !Number.isInteger(n))) return null;
        return { A: b.A ** n, p: b.p * n, r: b.r * n, m: b.m * n };
      }
      if (contem(e.base, x)) return null;
      const c = avaliar(e.base);
      const q = comoPolinomio(e.exp, x);
      if (!(c > 0) || c === 1 || !q || grau(q) !== 1) return null;
      // c^(kx + b) = c^b·e^(k·ln c·x); com x → −∞, x = −|x|
      return { A: c ** (q[0] ?? 0), p: 0, r: (q[1] ?? 0) * Math.log(c) * s, m: 0 };
    }
    case 'func': {
      const a = dominante(e.arg, s, x);
      if (!a) return null;
      if (e.nome === 'raiz') return a.A > 0 ? { A: Math.sqrt(a.A), p: a.p / 2, r: a.r / 2, m: a.m / 2 } : null;
      if (e.nome === 'abs') return { ...a, A: Math.abs(a.A) };
      if (e.nome === 'ln' && a.A > 0) {
        if (a.r > 0) return { A: a.r, p: 1, r: 0, m: 0 }; // ln(e^(r|x|)) ≈ r|x|
        if (a.r === 0 && a.p > 0) return { A: a.p, p: 0, r: 0, m: 1 }; // ln|x|^p ≈ p·ln|x|
      }
      return null;
    }
    default:
      return null;
  }
}

/** e^x/x, ln x/x, x·e^(−x), √(x² + 1)/x: no infinito, cada parte segue o termo que manda. */
function porCrescimento(e: Expr, s: Lado, ctx: Contexto): Valor | null {
  const d = dominante(e, s, ctx.x);
  if (!d || (d.p === 0 && d.r === 0 && d.m === 0 && !contem(e, ctx.x))) return null;
  let v: Valor;
  if (d.r !== 0) v = d.r > 0 ? infinito(Math.sign(d.A)) : finito(0);
  else if (d.p !== 0) v = d.p > 0 ? infinito(Math.sign(d.A)) : finito(0);
  else if (d.m !== 0) v = d.m > 0 ? infinito(Math.sign(d.A)) : finito(0);
  else v = finito(d.A);
  registrar(
    ctx,
    'ordem de crescimento',
    `No infinito, cada parte segue o termo que manda: exponencial cresce mais que qualquer potência de x, e potência cresce mais que ln x; uma raiz segue a raiz do termo de maior grau. Em ${paraTexto(e)}, o que manda leva a ${textoDoValor(v)}.`,
  );
  return v;
}

/** ∞ − ∞ com raiz: multiplica e divide pelo conjugado, (A − B)(A + B) = A² − B². */
function conjugadoNoInfinito(A: Expr, B: Expr, alvo: Alvo, ctx: Contexto): Valor | null {
  if (!(temRaiz(A) || temRaiz(B))) return null;
  const nova = div(simplificar(sub(quadrado(A), quadrado(B))), soma(A, B));
  const v = limite(nova, alvo, silencioso(ctx));
  if (problema(v)) return null;
  registrar(ctx, 'racionalização', `Racionalização (quadro 5): multiplicando e dividindo por ${paraTexto(soma(A, B))}, o conjugado, a forma ∞ − ∞ vira ${paraTexto(nova)}.`, [
    sub(A, B),
    nova,
  ]);
  return limite(nova, alvo, ctx);
}

// ─── O roteiro do quadro 11 ────────────────────────────────────────────────────

/** Converte para o valor público; forma indeterminada sem técnica vira aviso. */
function publico(v: Valor): ValorLimite {
  switch (v.tipo) {
    case 'finito':
      return v.v;
    case 'infinito':
      return v.sinal > 0 ? '+∞' : '-∞';
    case 'oscila':
      return 'oscila';
    case 'sem valor':
      return 'sem valor';
    case 'indeterminada':
      throw new ErroDeEntrada(
        `Esse limite cai na forma indeterminada ${v.forma}, e o motor ainda não tem técnica para ela. Ele usa substituição direta, fatoração, racionalização, limites fundamentais, módulo, confronto, as regras do infinito e a regra de L'Hôpital.`,
      );
  }
}

const textoPublico = (v: ValorLimite | 'não existe'): string => (typeof v === 'number' ? bonito(v) : v === '-∞' ? '−∞' : v);
const mesmoNumero = (p: number, q: number): boolean => Math.abs(p - q) <= 1e-9 * Math.max(1, Math.abs(p), Math.abs(q));

export function calcularLimite(entrada: string | Expr, ponto: number | string, x = 'x'): ResultadoLimite {
  const funcaoLida: FuncaoDoLimite = typeof entrada === 'string' ? lerFuncaoDoLimite(entrada, x) : { tipo: 'expressao', e: entrada };
  const { a, expr } = lerPonto(ponto, x);
  const ctx: Contexto = { x, passos: [], profundidade: 0, ponto: expr, orcamento: { restante: 4000 } };
  if (!Number.isFinite(a)) return noInfinito(funcaoLida, a > 0 ? 1 : -1, ctx);
  return noPonto(funcaoLida, a, ctx);
}

function noInfinito(f: FuncaoDoLimite, sinal: Lado, ctx: Contexto): ResultadoLimite {
  const e = f.tipo === 'partes' ? (sinal > 0 ? f.direita : f.esquerda) : f.e;
  if (f.tipo === 'partes') {
    registrar(ctx, 'por partes', `Para x ${sinal > 0 ? 'muito grande' : 'muito negativo'}, vale a fórmula ${paraTexto(e)}.`);
  }
  const v = limite(e, { infinito: sinal }, ctx);
  const resultado = publico(v);
  if (resultado === 'sem valor') {
    throw new ErroDeEntrada(`f não existe para x ${sinal > 0 ? 'muito grande' : 'muito negativo'} (por exemplo, ln x e √x só existem para x > 0).`);
  }
  if (!ctx.passos.some((p) => p.tecnica !== 'por partes')) {
    registrar(ctx, 'limite no infinito', `Pelas propriedades dos limites no infinito (quadros 4 e 6), ${paraTexto(e)} vai a ${textoPublico(resultado)}.`);
  }
  const exato = v.tipo === 'finito' ? v.exato : undefined;
  const r: ResultadoLimite = { funcao: f, a: sinal * Number.POSITIVE_INFINITY, ponto: null, limite: resultado, valorEmA: null, passos: ctx.passos, interpretacao: '' };
  if (exato) r.exato = exato;
  r.interpretacao = interpretar(r);
  return r;
}

function noPonto(f: FuncaoDoLimite, a: number, ctx: Contexto): ResultadoLimite {
  const { x } = ctx;
  const pontoExpr = ctx.ponto ?? num(a);
  const textoPonto = paraTexto(pontoExpr);

  if (f.tipo === 'partes' && f.corte === a) {
    registrar(
      ctx,
      'por partes',
      `f muda de fórmula em x = ${textoPonto}: à esquerda vale ${paraTexto(f.esquerda)} e à direita vale ${paraTexto(f.direita)}. Cada lado usa a sua fórmula.`,
    );
    const lado = (e: Expr, sinal: Lado): Valor => {
      const direto = substituicao(e, { a, lado: sinal }, x);
      if (!direto) return limite(e, { a, lado: sinal }, ctx);
      registrar(ctx, 'substituição direta', `${sinal < 0 ? 'Pela esquerda' : 'Pela direita'}, ${paraTexto(e)} é contínua em x = ${textoPonto}: basta substituir.`, [
        trocar(e, variavel(x), pontoExpr),
        simplificar(num(direto.tipo === 'finito' ? direto.v : Number.NaN)),
      ]);
      return direto;
    };
    const esq = lado(f.esquerda, -1);
    const dir = lado(f.direita, 1);
    const valorEmA = avaliarFuncao(f, a, x);
    const formulaEmA = f.corteNaEsquerda ? f.esquerda : f.direita;
    return concluir(f, a, ctx, esq, dir, Number.isFinite(valorEmA) && !singularEm(formulaEmA, a, x) ? valorEmA : null, false);
  }

  const e = f.tipo === 'partes' ? (a < f.corte ? f.esquerda : f.direita) : f.e;
  if (f.tipo === 'partes') {
    registrar(ctx, 'por partes', `Perto de x = ${textoPonto}, longe do corte em x = ${paraTexto(f.textoCorte)}, f vale ${paraTexto(e)}.`);
  }
  const fa = avaliar(e, { [x]: a });
  // tg(π/2) em ponto flutuante dá ~1,6·10¹⁶, não NaN: a estrutura decide se f(a) existe
  const valorEmA = Number.isFinite(fa) && !singularEm(e, a, x) ? fa : null;
  const esqDireta = substituicao(e, { a, lado: -1 }, x);
  const dirDireta = substituicao(e, { a, lado: 1 }, x);
  if (esqDireta && dirDireta) {
    registrar(ctx, 'substituição direta', `f é contínua em x = ${textoPonto} (quadro 8), então basta substituir (quadro 5).`, [
      trocar(e, variavel(x), pontoExpr),
      simplificar(num(fa)),
    ]);
    return concluir(f, a, ctx, esqDireta, dirDireta, valorEmA, true);
  }
  descreverForma(e, a, pontoExpr, ctx);
  const esq = limite(e, { a, lado: -1 }, ctx);
  const dir = limite(e, { a, lado: 1 }, ctx);
  return concluir(f, a, ctx, esq, dir, valorEmA, false);
}

/** O que a substituição direta dá quando não serve: 0/0, k/0 ou f sem valor em a. */
function descreverForma(e: Expr, a: number, pontoExpr: Expr, ctx: Contexto): void {
  const { x } = ctx;
  const trocado = trocar(e, variavel(x), pontoExpr);
  const textoPonto = paraTexto(pontoExpr);
  if (e.tipo === 'div') {
    const n = avaliar(e.a, { [x]: a });
    const d = avaliar(e.b, { [x]: a });
    if (Number.isFinite(n) && Number.isFinite(d) && Math.abs(d) < 1e-12) {
      if (Math.abs(n) < 1e-12) {
        registrar(ctx, 'forma indeterminada', `Substituindo x = ${textoPonto}, aparece 0/0: uma forma indeterminada. É preciso outra técnica (quadro 11).`, [
          trocado,
          div(num(0), num(0)),
        ]);
      } else {
        registrar(
          ctx,
          'forma indeterminada',
          `Substituindo x = ${textoPonto}, aparece ${bonito(n)}/0: o limite é infinito ou não existe, e o sinal de cada lado decide.`,
          [trocado, div(simplificar(num(n)), num(0))],
        );
      }
      return;
    }
  }
  registrar(ctx, 'forma indeterminada', `f não existe em x = ${textoPonto}: é preciso olhar como ela se comporta de cada lado (quadro 3).`);
}

function concluir(f: FuncaoDoLimite, a: number, ctx: Contexto, esqV: Valor, dirV: Valor, valorEmA: number | null, direta: boolean): ResultadoLimite {
  const esquerda = publico(esqV);
  const direita = publico(dirV);
  let resultado: ValorLimite | 'não existe';
  if (typeof esquerda === 'number' && typeof direita === 'number') resultado = mesmoNumero(esquerda, direita) ? esquerda : 'não existe';
  else if (esquerda === direita && (esquerda === '+∞' || esquerda === '-∞')) resultado = esquerda;
  else resultado = 'não existe';

  const descontinuidade = classificar(esquerda, direita, valorEmA);
  const textoPonto = paraTexto(ctx.ponto ?? num(a));
  if (!direta) {
    const iguais = resultado !== 'não existe';
    const fim =
      resultado === 'não existe'
        ? esquerda === 'sem valor' || direita === 'sem valor'
          ? 'f só existe de um lado, então o limite (dos dois lados) não existe.'
          : 'São diferentes: o limite não existe (quadro 3).'
        : `São iguais: o limite é ${textoPublico(resultado)}${typeof resultado === 'string' ? ' (cresce sem limite; não é um número real)' : ''}.`;
    registrar(ctx, 'limites laterais', `Pela esquerda: ${textoPublico(esquerda)}. Pela direita: ${textoPublico(direita)}. ${iguais ? fim : fim}`);
  }
  const fa = valorEmA === null ? `f(${textoPonto}) não existe` : `f(${textoPonto}) = ${bonito(valorEmA)}`;
  const continuidade: Record<Descontinuidade, string> = {
    removível: `${fa}, mas o limite é ${textoPublico(resultado)}: descontinuidade removível (quadro 9).`,
    salto: `Os limites laterais existem e são diferentes: descontinuidade de salto (quadro 9).`,
    infinita: `f vai ao infinito perto de x = ${textoPonto}: descontinuidade infinita (quadro 9).`,
    essencial: `f oscila sem parar perto de x = ${textoPonto}: descontinuidade essencial (quadro 9).`,
  };
  if (descontinuidade) registrar(ctx, 'continuidade', continuidade[descontinuidade]);
  else if (typeof resultado === 'number' && valorEmA !== null) {
    registrar(ctx, 'continuidade', `${fa}, igual ao limite: f é contínua em x = ${textoPonto} (quadro 8).`);
  }

  const r: ResultadoLimite = { funcao: f, a, ponto: ctx.ponto ?? num(a), esquerda, direita, limite: resultado, valorEmA, passos: ctx.passos, interpretacao: '' };
  const exato = esqV.tipo === 'finito' && dirV.tipo === 'finito' ? (dirV.exato ?? esqV.exato) : undefined;
  if (exato && typeof resultado === 'number') r.exato = exato;
  if (descontinuidade) r.descontinuidade = descontinuidade;
  r.interpretacao = interpretar(r);
  return r;
}

/** Quadro 9: o tipo de descontinuidade no ponto; undefined quando f é contínua (ou só existe de um lado). */
function classificar(esq: ValorLimite, dir: ValorLimite, valorEmA: number | null): Descontinuidade | undefined {
  if (esq === 'oscila' || dir === 'oscila') return 'essencial';
  if (esq === '+∞' || esq === '-∞' || dir === '+∞' || dir === '-∞') return 'infinita';
  if (typeof esq === 'number' && typeof dir === 'number') {
    if (!mesmoNumero(esq, dir)) return 'salto';
    return valorEmA !== null && mesmoNumero(valorEmA, esq) ? undefined : 'removível';
  }
  return undefined;
}

/** O que o resultado diz, em palavras (quadro 11, passo 5: interpretar). */
function interpretar(r: ResultadoLimite): string {
  const L = textoPublico(r.limite);
  if (!Number.isFinite(r.a)) {
    const sentido = r.a > 0 ? 'cresce' : 'decresce';
    if (typeof r.limite === 'number') return `Quando x ${sentido} sem parar, f(x) se aproxima de ${L}: a reta y = ${L} é uma assíntota horizontal do gráfico.`;
    if (r.limite === 'oscila') return `Quando x ${sentido} sem parar, f(x) continua oscilando e não se aproxima de nenhum valor.`;
    return `Quando x ${sentido} sem parar, f(x) ${r.limite === '+∞' ? 'cresce' : 'decresce'} sem limite: não há assíntota horizontal.`;
  }
  const a = paraTexto(r.ponto ?? num(r.a));
  const [esq, dir] = [textoPublico(r.esquerda ?? 'sem valor'), textoPublico(r.direita ?? 'sem valor')];
  switch (r.descontinuidade) {
    case 'removível':
      return `Perto de x = ${a}, f(x) fica tão perto de ${L} quanto se queira, ${r.valorEmA === null ? `mesmo f(${a}) não existindo` : `mesmo com f(${a}) = ${bonito(r.valorEmA)}`}: o gráfico tem um "buraco" em (${a}, ${L}), que daria para tapar.`;
    case 'salto':
      return `Chegando pela esquerda, f(x) vai para ${esq}; pela direita, para ${dir}. Como os valores são diferentes, o limite não existe: o gráfico dá um salto em x = ${a}.`;
    case 'infinita':
      return `Perto de x = ${a}, f(x) ${esq === dir ? (esq === '+∞' ? 'cresce' : 'decresce') + ' sem limite dos dois lados' : `vai a ${esq} pela esquerda e a ${dir} pela direita`}: a reta x = ${a} é uma assíntota vertical.`;
    case 'essencial':
      return `Perto de x = ${a}, f(x) oscila cada vez mais rápido e não se aproxima de nenhum valor: o limite não existe.`;
    default:
      if (typeof r.limite === 'number') return `Perto de x = ${a}, f(x) se aproxima de ${L}, e f(${a}) = ${L}: f é contínua aí, sem salto nem buraco no gráfico.`;
      return `f só existe de um lado de x = ${a}: pela esquerda, ${esq}; pela direita, ${dir}.`;
  }
}
