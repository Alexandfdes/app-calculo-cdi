/**
 * Funções da Aula 1. O motor reconhece o tipo da função (constante, linear, afim, quadrática,
 * modular, exponencial, logarítmica ou trigonométrica), confere as condições de existência de
 * cada tipo (a ≠ 0 na afim e na quadrática; base positiva e diferente de 1 na exponencial e no
 * logaritmo) e tira domínio, imagem, raízes, vértice, assíntotas e período, com o passo a passo
 * da aula e uma tabela de entradas e saídas.
 *
 * Além das formas puras (x², |x|, 2ˣ, ln x, sen x), valem as versões com coeficientes e
 * deslocamentos: k·|mx + n| + d, k·a^(mx + n) + d, k·logₐ(mx + n) + d e A·sen(Bx + C) + D.
 */
import { E, ErroDeEntrada, avaliar, contem, func, lerExpressao, logBase, mul, neg, num, paraLeitura, pot, soma, sub, trocar, variavel } from './expressao';
import type { Expr } from './expressao';
import { numeroBonito, numeroParaLer } from './numeros';
import { comoPolinomio, grau } from './polinomios';
import type { Polinomio } from './polinomios';

export type TipoFuncao = 'constante' | 'linear' | 'afim' | 'quadrática' | 'modular' | 'exponencial' | 'logarítmica' | 'trigonométrica';

/** O que cada passo identifica, como nos slides da Aula 1. */
export type AspectoFuncao =
  | 'tipo'
  | 'domínio'
  | 'imagem'
  | 'raízes'
  | 'vértice'
  | 'concavidade'
  | 'crescimento'
  | 'assíntota'
  | 'período'
  | 'paridade'
  | 'corte no eixo y';

/** Intervalo da reta; `de` pode ser −∞ e `ate`, +∞. Um ponto só é [k, k]. */
export interface Intervalo {
  de: number;
  ate: number;
  fechadoDe: boolean;
  fechadoAte: boolean;
}

/** Os números inicio + k·passo, com k inteiro: as raízes de sen x, os furos do domínio de tg x. */
export interface Familia {
  inicio: number;
  passo: number;
}

/** Domínio ou imagem: a união dos intervalos, menos os furos, quando há. */
export interface Conjunto {
  /** Como na aula: ℝ, [−9, +∞), (0, +∞), {5}, {x ∈ ℝ | x ≠ π/2 + kπ}. */
  texto: string;
  intervalos: Intervalo[];
  furos?: Familia;
}

export interface PontoNotavel {
  x: number;
  y: number;
  /** raiz, vértice, corte no eixo y, máximo ou mínimo. */
  nome: string;
}

export interface PassoFuncao {
  aspecto: AspectoFuncao;
  texto: string;
}

export interface AnaliseFuncao {
  /** A função como foi digitada. */
  entrada: Expr;
  variavel: string;
  tipo: TipoFuncao;
  /** Para o título: "Função quadrática", "Função trigonométrica (seno)". */
  nome: string;
  /** A forma geral da aula: "f(x) = ax² + bx + c". */
  formaGeral: string;
  /** Os números da forma geral: a = 1, b = −4, c = −5. */
  parametros: { nome: string; valor: number }[];
  /** A função escrita na forma geral; difere da entrada quando ela foi digitada de outro jeito. */
  forma: Expr;
  dominio: Conjunto;
  imagem: Conjunto;
  /** Raízes (zeros de f). `valores`: todas, ou as da janela do gráfico quando são infinitas. */
  raizes: { texto: string; valores: number[] };
  /** Vértice, raízes, corte no eixo y, máximo e mínimo, para marcar no gráfico. */
  pontos: PontoNotavel[];
  /** Assíntotas: as verticais (as da janela, quando são infinitas) e a horizontal. */
  assintotas: { verticais: number[]; horizontal: number | null };
  periodo: number | null;
  /** Trecho de x que enquadra bem o gráfico. */
  janela: [number, number];
  /** Entradas boas para a tabela de valores (na trigonométrica, os ângulos notáveis). */
  entradas: number[];
  /** Resumo para a tela, além do domínio e da imagem: "Vértice: (2, −9)". */
  caracteristicas: { nome: string; valor: string }[];
  passos: PassoFuncao[];
  /** Quando a função digitada não é do tipo que parece (casos V01 e V02). */
  avisos: string[];
  interpretacao: string;
  /** Só na quadrática: os números dos slides. */
  quadratica?: { a: number; b: number; c: number; delta: number; raizes: number[]; vertice: [number, number] };
  /** Os parâmetros por extenso: "a = 1, b = −4 e c = −5". */
  parametrosTexto: string;
  /** A entrada tinha decimais (0.3): os números saem em decimal, e não em fração. */
  decimais: boolean;
}

/** O que cada tipo monta; analisarFuncao completa o resto. */
type Analise = Omit<AnaliseFuncao, 'parametrosTexto' | 'decimais'>;

const INF = Number.POSITIVE_INFINITY;

/** Quem digita 0.3 lê 0.6, não 3/5: com decimais na entrada, as frações curtas saem em decimal. */
let preferirDecimais = false;

function ler(v: number, decimais = preferirDecimais): string {
  if (decimais) {
    const curto = Number(v.toFixed(4));
    if (Math.abs(v - curto) < 1e-12 && !Number.isInteger(curto)) return String(curto).replace('-', '−');
  }
  return numeroParaLer(v);
}

/** Um número escrito como os da análise: 0.6 se a entrada tinha decimais; senão 3/5, √3/2, π/6. */
export const numeroDaAnalise = (a: AnaliseFuncao, v: number): string => ler(v, a.decimais);

/** "= 2" quando o número é exato e "≈ 1.585" quando não, escrito como os da análise. */
export const igualdadeDaAnalise = (a: AnaliseFuncao, v: number): string => `${exato(v) ? '=' : '≈'} ${ler(v, a.decimais)}`;

function temDecimal(e: Expr): boolean {
  switch (e.tipo) {
    case 'num':
      return !Number.isInteger(e.valor);
    case 'soma':
    case 'sub':
    case 'mul':
    case 'div':
      return temDecimal(e.a) || temDecimal(e.b);
    case 'pot':
      return temDecimal(e.base) || temDecimal(e.exp);
    case 'neg':
      return temDecimal(e.a);
    case 'func':
      return temDecimal(e.arg);
    case 'log':
      return temDecimal(e.arg) || temDecimal(e.base);
    default:
      return false;
  }
}

const TIPOS_DA_AULA =
  'O modo Função reconhece os tipos da Aula 1: constante (5), linear (3x), afim (2x + 1), quadrática (x² − 4x − 5), modular (|x − 2|), exponencial (2ˣ), logarítmica (ln x, log(x, 10)) e trigonométrica (sen x, cos x, tg x), também com coeficientes e deslocamentos, como 3·2^(x + 1) − 4 ou 2 cos(3x) + 1.';

// ─── Números ───────────────────────────────────────────────────────────────────

/** O número tem escrita exata (inteiro, fração, múltiplo de π, raiz, e)? */
function exato(v: number): boolean {
  if (!Number.isFinite(v)) return false;
  return Math.abs(avaliar(lerExpressao(numeroBonito(v))) - v) <= 1e-9 * Math.max(1, Math.abs(v));
}

/** "= 2" quando o número sai exato; "≈ 1.585" quando não. */
const igual = (v: number): string => `${exato(v) ? '=' : '≈'} ${ler(v)}`;

/** Entre parênteses quando negativo, para as contas: (−4)². */
const par = (v: number): string => (v < 0 ? `(${ler(v)})` : ler(v));

/** Tira o ruído de ponto flutuante das contas que deveriam dar inteiro. */
function limpo(v: number): number {
  const r = Math.round(v);
  return Math.abs(v - r) < 1e-9 * Math.max(1, Math.abs(v)) ? r + 0 : v;
}

/** Coeficiente como expressão: 0.3 continua 0.3 (como se digita), 1/3 vira fração, π vira π. */
function coeficiente(c: number): Expr {
  const curto = Number(c.toFixed(4));
  if (Math.abs(c - curto) < 1e-12) return num(curto);
  return exato(c) ? lerExpressao(numeroBonito(c)) : num(c);
}

/** O polinômio na forma da aula, do maior grau para o menor (−x² + 4x, não 4x − x²), com coeficientes exatos. */
function polinomioExato(p: Polinomio, x: string): Expr {
  let resultado: Expr | null = null;
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i]!;
    if (c === 0) continue;
    const potencia = i === 0 ? null : i === 1 ? variavel(x) : pot(variavel(x), num(i));
    const termo = (k: number): Expr => (!potencia ? coeficiente(k) : k === 1 ? potencia : k === -1 ? neg(potencia) : mul(coeficiente(k), potencia));
    if (resultado === null) resultado = termo(c);
    else resultado = c < 0 ? sub(resultado, termo(-c)) : soma(resultado, termo(c));
  }
  return resultado ?? num(0);
}

/** A forma geral só com os parâmetros que aparecem: k·aˣ, a^(mx), A·cos(Bx) + D. */
function formaGeralCom(nucleo: string, k: number, d: number, [letraK, letraD]: [string, string]): string {
  return `f(x) = ${k === 1 ? '' : `${letraK}·`}${nucleo}${d === 0 ? '' : ` + ${letraD}`}`;
}

/** O argumento geral só com o que aparece: x, mx, x + n, mx + n. */
const argumentoGeral = (m: number, n: number, [letraM, letraN]: [string, string]): string =>
  `${m === 1 ? 'x' : `${letraM}x`}${n === 0 ? '' : ` + ${letraN}`}`;

/** Os parâmetros diferentes do neutro (1 para quem multiplica, 0 para quem soma). */
function parametrosUsados(lista: [string, number, number][]): { nome: string; valor: number }[] {
  return lista.filter(([, valor, neutro]) => valor !== neutro).map(([nome, valor]) => ({ nome, valor }));
}

/** a = 2, k = 3 e d = −4. */
function listaDeParametros(ps: { nome: string; valor: number }[]): string {
  const itens = ps.map((p) => `${p.nome} = ${ler(p.valor)}`);
  return itens.length <= 1 ? (itens[0] ?? '') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)!}`;
}

/** "…, na forma f(x) = k·aˣ com a = 0.85 e k = 80." */
const naForma = (formaGeral: string, ps: { nome: string; valor: number }[]): string =>
  `na forma ${formaGeral}${ps.length > 0 ? ` com ${listaDeParametros(ps)}` : ''}`;

/** A expressão é mx + n com m ≠ 0? */
function primeiroGrauEm(u: Expr, x: string): { m: number; n: number } | null {
  const p = comoPolinomio(u, x);
  return p && grau(p) === 1 ? { m: limpo(p[1]!), n: limpo(p[0]!) } : null;
}

// ─── Conjuntos ─────────────────────────────────────────────────────────────────

function intervalo(de: number, ate: number, fechadoDe: boolean, fechadoAte: boolean): Intervalo {
  return { de, ate, fechadoDe: fechadoDe && Number.isFinite(de), fechadoAte: fechadoAte && Number.isFinite(ate) };
}

const TODOS = intervalo(-INF, INF, false, false);

export function textoDoIntervalo(i: Intervalo): string {
  if (i.de === i.ate) return `{${ler(i.de)}}`;
  if (i.de === -INF && i.ate === INF) return 'ℝ';
  const de = i.de === -INF ? '−∞' : ler(i.de);
  const ate = i.ate === INF ? '+∞' : ler(i.ate);
  return `${i.fechadoDe ? '[' : '('}${de}, ${ate}${i.fechadoAte ? ']' : ')'}`;
}

const conjunto = (i: Intervalo): Conjunto => ({ texto: textoDoIntervalo(i), intervalos: [i] });
const reais = (): Conjunto => conjunto(TODOS);

/**
 * v está no conjunto? Com `folga`, aceita um erro relativo desse tamanho nas pontas (para
 * conferir valores calculados em ponto flutuante).
 */
export function pertence(c: Conjunto, v: number, folga = 0): boolean {
  if (!Number.isFinite(v)) return false;
  const f = folga * Math.max(1, Math.abs(v));
  const dentro = c.intervalos.some(
    (i) => (i.fechadoDe ? v >= i.de - f : v > i.de - f) && (i.fechadoAte ? v <= i.ate + f : v < i.ate + f),
  );
  if (!dentro || !c.furos) return dentro;
  const k = (v - c.furos.inicio) / c.furos.passo;
  return Math.abs(k - Math.round(k)) > 1e-9;
}

// ─── Famílias (trigonométricas) ────────────────────────────────────────────────

/** O resto de v por passo, em [0, passo). */
function normalizar(v: number, passo: number): number {
  const r = ((v % passo) + passo) % passo;
  return Math.abs(r) < 1e-12 * passo || Math.abs(r - passo) < 1e-12 * passo ? 0 : r;
}

/** x = π/2 + kπ, x = 2kπ, x = kπ/3, x = 0.5 + k·1.2. */
function textoDaFamilia(f: Familia): string {
  const passo = ler(f.passo);
  const termo =
    passo === 'π' ? 'kπ' : /^\d+π$/.test(passo) ? `${passo.slice(0, -1)}kπ` : /^π\/\d+$/.test(passo) ? `kπ${passo.slice(1)}` : `k·${passo}`;
  return f.inicio === 0 ? termo : `${ler(f.inicio)} + ${termo}`;
}

function naJanela(f: Familia, [lo, hi]: [number, number]): number[] {
  const valores: number[] = [];
  for (let k = Math.ceil((lo - f.inicio) / f.passo); f.inicio + k * f.passo <= hi && valores.length < 60; k++) {
    valores.push(f.inicio + k * f.passo);
  }
  return valores;
}

/** As soluções de T(Bx + C) = r, como famílias x = inicio + k·passo. */
function solucoes(nome: 'sen' | 'cos' | 'tg', r: number, B: number, C: number): Familia[] {
  let angulos: number[];
  let passo: number;
  if (nome === 'tg') {
    angulos = [Math.atan(r)];
    passo = Math.PI;
  } else {
    if (Math.abs(r) > 1 + 1e-12) return [];
    const s = Math.max(-1, Math.min(1, r));
    angulos = nome === 'sen' ? [Math.asin(s), Math.PI - Math.asin(s)] : [Math.acos(s), -Math.acos(s)];
    passo = 2 * Math.PI;
  }
  const ordenados = angulos.map((u) => normalizar(u, passo)).sort((p, q) => p - q);
  let inicios = ordenados.filter((u, i) => i === 0 || Math.abs(u - ordenados[i - 1]!) > 1e-12);
  // u = 0 e u = π, de 2π em 2π, são u = 0 de π em π (sen u = 0, cos u = 0)
  if (inicios.length === 2 && Math.abs(inicios[1]! - inicios[0]! - passo / 2) < 1e-12) {
    inicios = [inicios[0]!];
    passo /= 2;
  }
  const passoX = passo / Math.abs(B);
  return inicios.map((u) => ({ inicio: normalizar((u - C) / B, passoX), passo: passoX }));
}

// ─── Ajudantes da análise ──────────────────────────────────────────────────────

/** Uma janela de x que mostra todos esses pontos, o eixo y e uma folga em volta. */
function janelaEm(xs: number[]): [number, number] {
  const finitos = xs.filter(Number.isFinite);
  const lo = Math.min(0, ...finitos);
  const hi = Math.max(0, ...finitos);
  const largura = Math.max(hi - lo, 6);
  const centro = (lo + hi) / 2;
  return [centro - largura * 0.7, centro + largura * 0.7];
}

function inteirosEmVolta(centro: number, de = -3, ate = 3): number[] {
  const c = Number.isFinite(centro) && Math.abs(centro) < 1e6 ? Math.round(centro) : 0;
  return Array.from({ length: ate - de + 1 }, (_, i) => c + de + i + 0);
}

function semRepetir(pontos: PontoNotavel[]): PontoNotavel[] {
  const perto = (p: number, q: number): boolean => Math.abs(p - q) <= 1e-9 * Math.max(1, Math.abs(p));
  return pontos.filter((p, i) => Number.isFinite(p.y) && !pontos.slice(0, i).some((q) => perto(p.x, q.x) && perto(p.y, q.y)));
}

/** Valor de f em x, sem ruído de ponto flutuante; NaN fora do domínio. */
const valorEm = (e: Expr, x: string, t: number): number => limpo(avaliar(e, { [x]: t }));

// ─── Entrada ───────────────────────────────────────────────────────────────────

/** Separa e = k·núcleo + d, tirando as constantes que somam, subtraem, multiplicam e dividem. */
function descascar(e: Expr, x: string): { k: number; d: number; nucleo: Expr } {
  switch (e.tipo) {
    case 'soma':
      if (!contem(e.a, x)) {
        const r = descascar(e.b, x);
        return { ...r, d: r.d + avaliar(e.a) };
      }
      if (!contem(e.b, x)) {
        const r = descascar(e.a, x);
        return { ...r, d: r.d + avaliar(e.b) };
      }
      break;
    case 'sub':
      if (!contem(e.b, x)) {
        const r = descascar(e.a, x);
        return { ...r, d: r.d - avaliar(e.b) };
      }
      if (!contem(e.a, x)) {
        const r = descascar(e.b, x);
        return { nucleo: r.nucleo, k: -r.k, d: avaliar(e.a) - r.d };
      }
      break;
    case 'neg': {
      const r = descascar(e.a, x);
      return { nucleo: r.nucleo, k: -r.k, d: -r.d };
    }
    case 'mul': {
      const [constante, resto] = !contem(e.a, x) ? [e.a, e.b] : !contem(e.b, x) ? [e.b, e.a] : [null, null];
      if (constante && resto) {
        const c = avaliar(constante);
        const r = descascar(resto, x);
        return { nucleo: r.nucleo, k: c * r.k, d: c * r.d };
      }
      break;
    }
    case 'div':
      if (!contem(e.b, x)) {
        const c = avaliar(e.b);
        const r = descascar(e.a, x);
        return { nucleo: r.nucleo, k: r.k / c, d: r.d / c };
      }
      break;
    default:
      break;
  }
  return { k: 1, d: 0, nucleo: e };
}

/** Exponencial e logaritmo exigem base positiva e diferente de 1 (Aula 1). */
function exigirBase(base: number, onde: 'exponencial' | 'logaritmo', textoBase: string): void {
  if (!Number.isFinite(base)) throw new ErroDeEntrada('A base não tem valor real.');
  if (base > 0 && base !== 1) return;
  const regra =
    onde === 'exponencial'
      ? 'Na função exponencial, a base precisa ser positiva e diferente de 1 (Aula 1).'
      : 'No logaritmo, a base precisa ser positiva e diferente de 1 (Aula 1).';
  let porque: string;
  if (onde === 'exponencial') {
    if (base === 1) porque = 'Com base 1, 1ˣ vale 1 para todo x: isso é a função constante f(x) = 1, não uma exponencial.';
    else if (base === 0) porque = 'Com base 0, 0ˣ vale 0 para x > 0 e não existe para x ≤ 0 (0⁰ e 0⁻¹ não têm valor).';
    else porque = `Com base ${textoBase}, (${textoBase})ˣ não tem valor real em x = 1/2, por exemplo: seria √(${textoBase}).`;
  } else if (base === 1) {
    porque = 'Com base 1 não há logaritmo: 1 elevado a qualquer expoente dá 1, então nenhum expoente leva a base 1 até 2, por exemplo.';
  } else if (base === 0) {
    porque = 'Com base 0 não há logaritmo: as potências de 0 só dão 0.';
  } else {
    porque = `Com base ${textoBase}, as potências (${textoBase})ʸ trocam de sinal e nem sempre existem, então o logaritmo não fica definido.`;
  }
  throw new ErroDeEntrada(`${regra} ${porque}`);
}

/**
 * Analisa uma função da Aula 1: tipo, parâmetros, domínio, imagem, raízes, vértice,
 * assíntotas, período, passo a passo e interpretação. Entradas fora dos tipos da aula, ou que
 * ferem as condições de existência (base 1 ou negativa), dão ErroDeEntrada com o motivo.
 */
export function analisarFuncao(entrada: string | Expr, x = 'x'): AnaliseFuncao {
  const e = typeof entrada === 'string' ? lerExpressao(entrada, x) : entrada;
  preferirDecimais = temDecimal(e);
  const r = analisar(e, x);
  return { ...r, parametrosTexto: listaDeParametros(r.parametros), decimais: preferirDecimais };
}

function analisar(e: Expr, x: string): Analise {
  const p = comoPolinomio(e, x);
  if (p) return polinomial(e, p, x);
  const { k, d, nucleo } = descascar(e, x);
  if (!Number.isFinite(k) || !Number.isFinite(d)) {
    throw new ErroDeEntrada('Uma das constantes da função não tem valor real (uma divisão por zero, por exemplo).');
  }
  if (k === 0) throw new ErroDeEntrada(`O termo com ${x} está multiplicado por 0: sem ele, a função é a constante ${ler(d)}.`);
  const naoReconhecida = (): never => {
    throw new ErroDeEntrada(`Não reconheci o tipo de f(${x}) = ${paraLeitura(e)}. ${TIPOS_DA_AULA}`);
  };
  switch (nucleo.tipo) {
    case 'pot':
      return contem(nucleo.base, x) ? naoReconhecida() : exponencial(e, k, d, nucleo.base, nucleo.exp, x);
    case 'log':
      return logaritmica(e, k, d, nucleo.arg, nucleo.base, x);
    case 'func':
      switch (nucleo.nome) {
        case 'abs':
          return modular(e, k, d, nucleo.arg, x);
        case 'ln':
          return logaritmica(e, k, d, nucleo.arg, null, x);
        case 'sen':
        case 'cos':
        case 'tg':
          return trigonometrica(e, k, d, nucleo.nome, nucleo.arg, x);
        case 'cotg':
        case 'sec':
        case 'csc':
          throw new ErroDeEntrada(`No modo Função, as trigonométricas são sen, cos e tg, como na Aula 1. A ${nucleo.nome} aparece nos modos Derivada e Integral.`);
        default:
          return naoReconhecida();
      }
    default:
      return naoReconhecida();
  }
}

// ─── Polinômios: constante, linear, afim e quadrática ──────────────────────────

/** O grau como está escrito, antes de os termos se cancelarem: 0·x² + 2x + 1 está escrito com grau 2. */
function grauEscrito(e: Expr, x: string): number {
  switch (e.tipo) {
    case 'var':
      return e.nome === x ? 1 : 0;
    case 'soma':
    case 'sub':
      return Math.max(grauEscrito(e.a, x), grauEscrito(e.b, x));
    case 'mul':
      return grauEscrito(e.a, x) + grauEscrito(e.b, x);
    case 'div':
    case 'neg':
      return grauEscrito(e.a, x);
    case 'pot':
      return contem(e.exp, x) ? 0 : grauEscrito(e.base, x) * avaliar(e.exp);
    default:
      return 0;
  }
}

function avisoDeGrau(escrito: number, tipo: TipoFuncao): string {
  if (escrito === 2) {
    const some = tipo === 'constante' ? 'os termos em x² e em x somem' : 'o termo em x² some: o coeficiente dele é a = 0';
    return `Escrita assim, parece quadrática, mas ${some}. A quadrática exige a ≠ 0 (Aula 1), então a função é tratada como ${tipo}.`;
  }
  if (escrito === 1) {
    return `Escrita assim, parece afim, mas o termo em x some: o coeficiente dele é a = 0. A afim exige a ≠ 0 (Aula 1), então a função é tratada como ${tipo}.`;
  }
  return `Escrita assim, parece de grau ${escrito}, mas os termos de grau mais alto se cancelam: a função é tratada como ${tipo}.`;
}

function polinomial(e: Expr, p: Polinomio, x: string): Analise {
  const g = grau(p);
  if (g >= 3) {
    throw new ErroDeEntrada(
      `f(${x}) = ${paraLeitura(polinomioExato(p, x))} é um polinômio de grau ${g}. A Aula 1 trata os de grau 0 (constante), 1 (linear e afim) e 2 (quadrática).`,
    );
  }
  const c = (i: number): number => limpo(p[i] ?? 0);
  const r = g === 0 ? constante(e, c(0), x) : g === 1 ? primeiroGrau(e, c(1), c(0), x) : quadratica(e, c(2), c(1), c(0), x);
  const escrito = grauEscrito(e, x);
  if (escrito > g) r.avisos.push(avisoDeGrau(escrito, r.tipo));
  return r;
}

function constante(e: Expr, k: number, x: string): Analise {
  const kk = ler(k);
  return {
    entrada: e,
    variavel: x,
    tipo: 'constante',
    nome: 'Função constante',
    formaGeral: 'f(x) = k',
    parametros: [{ nome: 'k', valor: k }],
    forma: coeficiente(k),
    dominio: reais(),
    imagem: conjunto(intervalo(k, k, true, true)),
    raizes: k === 0 ? { texto: 'todo x real: a função é nula', valores: [] } : { texto: `não tem: f(x) vale ${kk} para todo x`, valores: [] },
    pontos: [{ x: 0, y: k, nome: 'corte no eixo y' }],
    assintotas: { verticais: [], horizontal: null },
    periodo: null,
    janela: [-4, 4],
    entradas: inteirosEmVolta(0),
    caracteristicas: [
      { nome: 'Gráfico', valor: `reta horizontal y = ${kk}` },
      { nome: 'Raízes', valor: k === 0 ? 'todo x real' : 'não tem' },
      { nome: 'Corte no eixo y', valor: `(0, ${kk})` },
    ],
    passos: [
      { aspecto: 'tipo', texto: `Não há x na fórmula: qualquer que seja a entrada, a saída é ${kk}. É uma função constante, f(x) = k com k = ${kk}.` },
      { aspecto: 'domínio', texto: 'Qualquer número real serve de entrada: D(f) = ℝ.' },
      { aspecto: 'imagem', texto: `A única saída possível é ${kk}: Im(f) = {${kk}}.` },
      { aspecto: 'corte no eixo y', texto: `O gráfico é a reta horizontal y = ${kk}, que corta o eixo y em (0, ${kk}).` },
    ],
    avisos: [],
    interpretacao: `A saída não depende da entrada: mude x à vontade e f(x) continua ${kk}. A taxa de variação é zero.`,
  };
}

function primeiroGrau(e: Expr, a: number, b: number, x: string): Analise {
  const linear = b === 0;
  const raiz = limpo(-b / a);
  const forma = polinomioExato([b, a], x);
  const [aa, bb] = [ler(a), ler(b)];
  const cresce = a > 0;
  const ritmo = `${cresce ? 'aumenta' : 'diminui'} ${ler(Math.abs(a))}`;
  const passos: PassoFuncao[] = [
    {
      aspecto: 'tipo',
      texto: linear
        ? `Na forma f(x) = ax, com a = ${aa} ≠ 0: é uma função linear, a afim sem o termo independente (b = 0).${a === 1 ? ' Com a = 1, é a função identidade: a saída é a própria entrada.' : ''}`
        : `Na forma f(x) = ax + b, com a = ${aa} ≠ 0 e b = ${bb}: é uma função afim (polinomial do 1º grau), e o gráfico é uma reta.`,
    },
    { aspecto: 'domínio', texto: 'É um polinômio: dá para calcular f(x) para qualquer x real. D(f) = ℝ.' },
    {
      aspecto: 'imagem',
      texto: `Com a ≠ 0, a reta é inclinada e passa por todas as alturas: cada y é a saída de x = ${linear ? 'y/a' : '(y − b)/a'}. Im(f) = ℝ.`,
    },
    {
      aspecto: 'raízes',
      texto: linear
        ? `f(x) = 0 ⇔ ${paraLeitura(forma)} = 0 ⇔ x = 0: a reta passa pela origem.`
        : `f(x) = 0 ⇔ ${paraLeitura(forma)} = 0 ⇔ x = −b/a ${igual(raiz)}. A reta corta o eixo x em (${ler(raiz)}, 0).`,
    },
  ];
  if (!linear) passos.push({ aspecto: 'corte no eixo y', texto: `f(0) = b = ${bb}: a reta corta o eixo y em (0, ${bb}).` });
  passos.push({
    aspecto: 'crescimento',
    texto: `a = ${aa} ${cresce ? '> 0: função crescente (x aumenta, f(x) aumenta)' : '< 0: função decrescente (x aumenta, f(x) diminui)'}.`,
  });
  return {
    entrada: e,
    variavel: x,
    tipo: linear ? 'linear' : 'afim',
    nome: linear ? 'Função linear' : 'Função afim',
    formaGeral: linear ? 'f(x) = ax' : 'f(x) = ax + b',
    parametros: linear ? [{ nome: 'a', valor: a }] : [{ nome: 'a', valor: a }, { nome: 'b', valor: b }],
    forma,
    dominio: reais(),
    imagem: reais(),
    raizes: { texto: `x ${igual(raiz)}`, valores: [raiz] },
    pontos: semRepetir([
      { x: raiz, y: 0, nome: 'raiz' },
      { x: 0, y: b, nome: 'corte no eixo y' },
    ]),
    assintotas: { verticais: [], horizontal: null },
    periodo: null,
    janela: janelaEm([raiz]),
    entradas: inteirosEmVolta(Math.abs(raiz) < 10 ? raiz : 0),
    caracteristicas: [
      { nome: 'Raiz', valor: `x ${igual(raiz)}` },
      ...(linear ? [] : [{ nome: 'Corte no eixo y', valor: `(0, ${bb})` }]),
      { nome: 'Taxa de variação', valor: `a = ${aa}` },
      { nome: 'Crescimento', valor: cresce ? 'crescente (a > 0)' : 'decrescente (a < 0)' },
    ],
    passos,
    avisos: [],
    interpretacao: linear
      ? `A saída é proporcional à entrada: dobrando x, f(x) dobra. A cada 1 que x aumenta, f(x) ${ritmo}.`
      : `A cada 1 que x aumenta, f(x) ${ritmo}: essa taxa de variação constante é o a. Já b = ${bb} é o valor inicial, a saída quando x = 0.`,
  };
}

/** As raízes como na aula: exatas (−1, 1/2, √2) ou p ± q√r; senão, aproximadas. Cada texto já traz o = ou o ≈. */
function textoDasRaizes(a: number, b: number, delta: number, raizes: number[]): string[] {
  if (raizes.every(exato)) return raizes.map((r) => `= ${ler(r)}`);
  const p = -b / (2 * a);
  const q = Math.sqrt(delta) / (2 * Math.abs(a));
  if (exato(p) && exato(q)) return [`= ${ler(p)} − ${ler(q)} ≈ ${ler(p - q)}`, `= ${ler(p)} + ${ler(q)} ≈ ${ler(p + q)}`];
  return raizes.map((r) => `≈ ${ler(r)}`);
}

function quadratica(e: Expr, a: number, b: number, c: number, x: string): Analise {
  const delta = limpo(b * b - 4 * a * c);
  const xv = limpo(-b / (2 * a));
  const yv = limpo(-delta / (4 * a));
  const raizes =
    delta > 0
      ? [(-b - Math.sqrt(delta)) / (2 * a), (-b + Math.sqrt(delta)) / (2 * a)].map(limpo).sort((p, q) => p - q)
      : delta === 0
        ? [xv]
        : [];
  const textos = textoDasRaizes(a, b, delta, raizes);
  const [aa, bb, cc] = [ler(a), ler(b), ler(c)];
  const cima = a > 0;
  const V = `(${ler(xv)}, ${ler(yv)})`;
  const imagem = conjunto(cima ? intervalo(yv, INF, true, false) : intervalo(-INF, yv, false, true));
  const textoRaizes =
    delta > 0 ? `x₁ ${textos[0]} e x₂ ${textos[1]}` : delta === 0 ? `x ${textos[0]} (raiz dupla)` : 'não tem raiz real (Δ < 0)';
  const conta = `Δ = b² − 4ac = ${par(b)}² − 4·${par(a)}·${par(c)} = ${ler(delta)}.`;
  const sobreAsRaizes =
    delta > 0
      ? `Δ > 0: duas raízes reais distintas, x = (−b ± √Δ)/2a = (${ler(-b)} ± √${ler(delta)})/${par(2 * a)}, que dão x₁ ${textos[0]} e x₂ ${textos[1]}.`
      : delta === 0
        ? `Δ = 0: uma raiz real dupla, x = −b/2a = ${ler(xv)}. A parábola só encosta no eixo x, no vértice.`
        : 'Δ < 0: não há raiz real, e a parábola não corta o eixo x.';
  const extremo = cima ? 'mais baixo' : 'mais alto';
  return {
    entrada: e,
    variavel: x,
    tipo: 'quadrática',
    nome: 'Função quadrática',
    formaGeral: 'f(x) = ax² + bx + c',
    parametros: [
      { nome: 'a', valor: a },
      { nome: 'b', valor: b },
      { nome: 'c', valor: c },
    ],
    forma: polinomioExato([c, b, a], x),
    dominio: reais(),
    imagem,
    raizes: { texto: textoRaizes, valores: raizes },
    pontos: semRepetir([
      { x: xv, y: yv, nome: 'vértice' },
      ...raizes.map((r) => ({ x: r, y: 0, nome: 'raiz' })),
      { x: 0, y: c, nome: 'corte no eixo y' },
    ]),
    assintotas: { verticais: [], horizontal: null },
    periodo: null,
    janela: janelaEm([xv, ...raizes]),
    entradas: inteirosEmVolta(xv),
    caracteristicas: [
      { nome: 'Concavidade', valor: cima ? 'para cima (a > 0)' : 'para baixo (a < 0)' },
      { nome: 'Discriminante', valor: `Δ = ${ler(delta)}` },
      { nome: 'Raízes', valor: textoRaizes },
      { nome: 'Vértice', valor: V },
      { nome: 'Eixo de simetria', valor: `x = ${ler(xv)}` },
      { nome: 'Corte no eixo y', valor: `(0, ${cc})` },
    ],
    passos: [
      {
        aspecto: 'tipo',
        texto: `Na forma f(x) = ax² + bx + c, com a = ${aa}, b = ${bb} e c = ${cc}. Como a ≠ 0, é uma função quadrática (polinomial do 2º grau), e o gráfico é uma parábola.`,
      },
      { aspecto: 'domínio', texto: 'É um polinômio: dá para calcular f(x) para qualquer x real. D(f) = ℝ.' },
      { aspecto: 'concavidade', texto: `a = ${aa} ${cima ? '> 0: a concavidade é voltada para cima' : '< 0: a concavidade é voltada para baixo'}.` },
      { aspecto: 'raízes', texto: `${conta} ${sobreAsRaizes}` },
      {
        aspecto: 'vértice',
        texto: `xᵥ = −b/2a = ${ler(-b)}/${par(2 * a)} = ${ler(xv)} e yᵥ = −Δ/4a = ${ler(-delta)}/${par(4 * a)} = ${ler(yv)}: o vértice é V = ${V}.`,
      },
      {
        aspecto: 'imagem',
        texto: `Com a ${cima ? '> 0' : '< 0'}, o vértice é o ponto ${extremo} da parábola: f(x) ${cima ? '≥' : '≤'} ${ler(yv)} para todo x, e f(${ler(xv)}) = ${ler(yv)}. Im(f) = ${imagem.texto}.`,
      },
      { aspecto: 'corte no eixo y', texto: `f(0) = c = ${cc}: a parábola corta o eixo y em (0, ${cc}).` },
      {
        aspecto: 'crescimento',
        texto: `${cima ? 'Decrescente' : 'Crescente'} para x ≤ ${ler(xv)} e ${cima ? 'crescente' : 'decrescente'} para x ≥ ${ler(xv)}: o eixo de simetria, x = ${ler(xv)}, separa os dois trechos.`,
      },
    ],
    avisos: [],
    interpretacao: `O vértice é o ponto ${extremo}: o ${cima ? 'menor' : 'maior'} valor de f é ${ler(yv)}, em x = ${ler(xv)}. Antes dele a função ${cima ? 'desce' : 'sobe'}; depois, ${cima ? 'sobe' : 'desce'}.`,
    quadratica: { a, b, c, delta, raizes, vertice: [xv, yv] },
  };
}

// ─── Modular ───────────────────────────────────────────────────────────────────

function modular(e: Expr, k: number, d: number, arg: Expr, x: string): Analise {
  const lin = primeiroGrauEm(arg, x);
  if (!lin) throw new ErroDeEntrada('No modo Função, o módulo é de uma expressão do 1º grau, como |x|, |x − 2| ou 2|x + 1| − 3.');
  const { m, n } = lin;
  const xv = limpo(-n / m);
  const r = -d / k; // f(x) = 0 ⇔ |mx + n| = r
  const raizes = r > 0 ? [(r - n) / m, (-r - n) / m].map(limpo).sort((p, q) => p - q) : r === 0 ? [xv] : [];
  const cima = k > 0;
  const pura = k === 1 && d === 0 && m === 1 && n === 0;
  const imagem = conjunto(cima ? intervalo(d, INF, true, false) : intervalo(-INF, d, false, true));
  // |u| = u quando u ≥ 0 e −u quando u < 0; com m > 0, u ≥ 0 é o lado direito do bico
  const positivo = polinomioExato([k * n + d, k * m], x);
  const negativo = polinomioExato([-k * n + d, -k * m], x);
  const [esquerda, direita] = m > 0 ? [negativo, positivo] : [positivo, negativo];
  const u = paraLeitura(arg);
  const bico = `(${ler(xv)}, ${ler(d)})`;
  const partes = `f(x) = ${paraLeitura(esquerda)} para x < ${ler(xv)} e f(x) = ${paraLeitura(direita)} para x ≥ ${ler(xv)}`;
  const y0 = valorEm(e, x, 0);
  const cadaRaiz = raizes.map((z) => `x ${igual(z)}`);
  const textoRaizes = cadaRaiz.length > 0 ? cadaRaiz.join(' e ') : 'não tem';
  const formaGeral = formaGeralCom(`|${argumentoGeral(m, n, ['m', 'n'])}|`, k, d, ['k', 'd']);
  const parametros = parametrosUsados([
    ['k', k, 1],
    ['m', m, 1],
    ['n', n, 0],
    ['d', d, 0],
  ]);
  const sobreAsRaizes =
    r > 0
      ? m === 1 && n === 0
        ? `f(x) = 0 ⇔ |x| = ${ler(r)} ⇔ ${cadaRaiz.join(' ou ')}.`
        : `f(x) = 0 ⇔ |${u}| = ${ler(r)} ⇔ ${u} = ${ler(r)} ou ${u} = ${ler(-r)}, ou seja, ${cadaRaiz.join(' ou ')}.`
      : r === 0
        ? `f(x) = 0 só no bico, onde ${u} = 0: x = ${ler(xv)}.`
        : `f(x) = 0 pediria |${u}| = ${ler(r)}, um número negativo, e módulo nunca é negativo: não há raiz.`;
  const sobreAImagem = pura
    ? `|x| ≥ 0 para todo x, e |0| = 0: Im(f) = ${imagem.texto}.`
    : k === 1
      ? `|${u}| ≥ 0, então f(x) ≥ ${ler(d)}, com igualdade no bico. Im(f) = ${imagem.texto}.`
      : `|${u}| ≥ 0, e com k = ${ler(k)} ${cima ? '> 0' : '< 0'} isso dá f(x) ${cima ? '≥' : '≤'} ${ler(d)}, com igualdade no bico. Im(f) = ${imagem.texto}.`;
  return {
    entrada: e,
    variavel: x,
    tipo: 'modular',
    nome: 'Função modular',
    formaGeral,
    parametros,
    forma: e,
    dominio: reais(),
    imagem,
    raizes: { texto: textoRaizes, valores: raizes },
    pontos: semRepetir([
      { x: xv, y: d, nome: 'vértice' },
      ...raizes.map((z) => ({ x: z, y: 0, nome: 'raiz' })),
      { x: 0, y: y0, nome: 'corte no eixo y' },
    ]),
    assintotas: { verticais: [], horizontal: null },
    periodo: null,
    janela: janelaEm([xv, ...raizes]),
    entradas: inteirosEmVolta(xv),
    caracteristicas: [
      { nome: 'Vértice (bico)', valor: bico },
      { nome: 'Por partes', valor: `${paraLeitura(esquerda)} se x < ${ler(xv)}; ${paraLeitura(direita)} se x ≥ ${ler(xv)}` },
      { nome: 'Raízes', valor: textoRaizes },
      { nome: 'Corte no eixo y', valor: `(0, ${ler(y0)})` },
    ],
    passos: [
      {
        aspecto: 'tipo',
        texto: pura
          ? 'f(x) = |x|, o módulo (valor absoluto) de x: é a função modular.'
          : `A variável está dentro de um módulo, |${u}|: é uma função modular, ${naForma(formaGeral, parametros)}.`,
      },
      { aspecto: 'domínio', texto: 'Todo número real tem módulo: D(f) = ℝ.' },
      {
        aspecto: 'vértice',
        texto: `Pela definição, |u| = u quando u ≥ 0 e |u| = −u quando u < 0. ${pura ? '' : `Aqui u = ${u}, que zera em x = ${ler(xv)}. `}Então ${partes}: duas semirretas que se encontram no bico ${bico}.`,
      },
      { aspecto: 'imagem', texto: sobreAImagem },
      { aspecto: 'raízes', texto: sobreAsRaizes },
      {
        aspecto: 'crescimento',
        texto: `${cima ? 'Decrescente' : 'Crescente'} para x ≤ ${ler(xv)} e ${cima ? 'crescente' : 'decrescente'} para x ≥ ${ler(xv)}: o gráfico é um V${cima ? '' : ' de cabeça para baixo'}.`,
      },
    ],
    avisos: [],
    interpretacao: pura
      ? '|x| é a distância de x até 0 na reta: por isso nunca é negativo, e só vale 0 em x = 0.'
      : `|${u}| mede uma distância, por isso nunca é negativo. O bico do gráfico, em x = ${ler(xv)}, é onde essa distância vale zero e f chega ao ${cima ? 'menor' : 'maior'} valor, ${ler(d)}.`,
  };
}

// ─── Exponencial ───────────────────────────────────────────────────────────────

function exponencial(e: Expr, k: number, d: number, baseExpr: Expr, expoente: Expr, x: string): Analise {
  const a = avaliar(baseExpr);
  exigirBase(a, 'exponencial', paraLeitura(baseExpr));
  const lin = primeiroGrauEm(expoente, x);
  if (!lin) throw new ErroDeEntrada('No modo Função, o expoente da exponencial é do 1º grau, como em 2^x, e^(-x) ou 3^(2*x + 1).');
  const { m, n } = lin;
  const aa = ler(a);
  const pura = k === 1 && d === 0 && m === 1 && n === 0;
  const acima = k > 0;
  const cresce = k * m * Math.log(a) > 0;
  const fator = limpo(a ** m);
  const y0 = limpo(k * a ** n + d);
  const r = -d / k; // f(x) = 0 ⇔ a^(mx + n) = r
  const raiz = r > 0 ? limpo((Math.log(r) / Math.log(a) - n) / m) : null;
  const imagem = conjunto(acima ? intervalo(d, INF, false, false) : intervalo(-INF, d, false, false));
  const potencia = paraLeitura(pot(baseExpr, expoente));
  const vaiAZero = m * Math.log(a) > 0 ? '−∞' : '+∞';
  const argumento = argumentoGeral(m, n, ['m', 'n']);
  const formaGeral = formaGeralCom(argumento === 'x' ? 'aˣ' : `a^(${argumento})`, k, d, ['k', 'd']);
  const outros = parametrosUsados([
    ['k', k, 1],
    ['m', m, 1],
    ['n', n, 0],
    ['d', d, 0],
  ]);
  const porUnidade = m === 1 ? aa : `${paraLeitura(pot(baseExpr, coeficiente(m)))} ${igual(fator)}`;
  const porcento = (p: number): string => `${Number(p.toFixed(1))}%`;
  const mudanca =
    fator === 2
      ? 'dobra a cada passo'
      : fator === 0.5
        ? 'cai pela metade a cada passo'
        : fator < 1
          ? `perde ${porcento((1 - fator) * 100)} a cada passo`
          : `ganha ${porcento((fator - 1) * 100)} a cada passo`;
  const etapas: string[] = [];
  if (k !== 1) etapas.push(`vezes k = ${ler(k)}, fica sempre ${acima ? 'positivo' : 'negativo'}`);
  if (d !== 0) etapas.push(`somando d = ${ler(d)}, fica sempre ${acima ? 'acima' : 'abaixo'} de ${ler(d)}`);
  return {
    entrada: e,
    variavel: x,
    tipo: 'exponencial',
    nome: 'Função exponencial',
    formaGeral,
    parametros: [{ nome: 'a', valor: a }, ...outros],
    forma: e,
    dominio: reais(),
    imagem,
    raizes: { texto: raiz === null ? 'não tem' : `x ${igual(raiz)}`, valores: raiz === null ? [] : [raiz] },
    pontos: semRepetir([{ x: 0, y: y0, nome: 'corte no eixo y' }, ...(raiz === null ? [] : [{ x: raiz, y: 0, nome: 'raiz' }])]),
    assintotas: { verticais: [], horizontal: d },
    periodo: null,
    janela: janelaEm([raiz ?? 0, -n / m]),
    entradas: inteirosEmVolta(-n / m, -2, 3),
    caracteristicas: [
      { nome: 'Assíntota horizontal', valor: `y = ${ler(d)}` },
      { nome: 'Corte no eixo y', valor: `(0, ${ler(y0)})` },
      { nome: 'Raiz', valor: raiz === null ? 'não tem' : `x ${igual(raiz)}` },
      { nome: 'Crescimento', valor: cresce ? 'crescente' : 'decrescente' },
    ],
    passos: [
      {
        aspecto: 'tipo',
        texto: `A variável está no expoente, e a base a = ${aa} é positiva e diferente de 1 (Aula 1): é uma função exponencial, ${naForma(formaGeral, outros)}.`,
      },
      { aspecto: 'domínio', texto: `Dá para elevar ${aa} a qualquer expoente real: D(f) = ℝ.` },
      {
        aspecto: 'imagem',
        texto: `${potencia} é sempre positivo e chega tão perto de 0 quanto se queira, sem nunca chegar${etapas.length > 0 ? `; ${etapas.join('; ')}` : ''}. Im(f) = ${imagem.texto}.`,
      },
      {
        aspecto: 'assíntota',
        texto: `Quando x → ${vaiAZero}, ${potencia} → 0 e f(x) → ${ler(d)}: a reta y = ${ler(d)} é assíntota horizontal, e o gráfico nunca a toca.`,
      },
      {
        aspecto: 'corte no eixo y',
        texto: pura
          ? `${paraLeitura(pot(baseExpr, num(0)))} = 1: como todo gráfico de aˣ, este passa por (0, 1).`
          : `f(0) ${igual(y0)}: o gráfico corta o eixo y em (0, ${ler(y0)}).`,
      },
      {
        aspecto: 'crescimento',
        texto: pura
          ? a > 1
            ? `a = ${aa} > 1: função crescente.`
            : `0 < a = ${aa} < 1: função decrescente.`
          : `A cada 1 que x aumenta, ${potencia} é multiplicado por ${porUnidade}${k < 0 ? `, e o k = ${ler(k)}, negativo, inverte o sentido` : ''}: função ${cresce ? 'crescente' : 'decrescente'}.`,
      },
      {
        aspecto: 'raízes',
        texto:
          raiz === null
            ? pura
              ? `${potencia} nunca vale 0: não há raiz.`
              : `f(x) = 0 pediria ${potencia} = ${ler(r)}, e a exponencial é sempre positiva: não há raiz.`
            : `f(x) = 0 ⇔ ${potencia} = ${ler(r)} ⇔ x ${igual(raiz)}.`,
      },
    ],
    avisos: [],
    interpretacao: `A cada 1 que x aumenta, ${pura ? 'f(x)' : 'a parte exponencial'} é multiplicada por ${ler(fator)}: ${mudanca}. A reta y = ${ler(d)} é ${acima ? 'um piso' : 'um teto'} que o gráfico nunca atravessa.`,
  };
}

// ─── Logarítmica ───────────────────────────────────────────────────────────────

function logaritmica(e: Expr, k: number, d: number, arg: Expr, baseExpr: Expr | null, x: string): Analise {
  const a = baseExpr ? avaliar(baseExpr) : Math.E;
  exigirBase(a, 'logaritmo', baseExpr ? paraLeitura(baseExpr) : 'e');
  const lin = primeiroGrauEm(arg, x);
  if (!lin) throw new ErroDeEntrada('No modo Função, o logaritmando é do 1º grau, como em ln(x), log(x, 10) ou log(2*x - 4, 3).');
  const { m, n } = lin;
  const x0 = limpo(-n / m);
  const pura = k === 1 && d === 0 && m === 1 && n === 0;
  const aa = baseExpr ? ler(a) : 'e';
  const dominio = conjunto(m > 0 ? intervalo(x0, INF, false, false) : intervalo(-INF, x0, false, false));
  const raiz = limpo((a ** (-d / k) - n) / m);
  const cresce = k * m * Math.log(a) > 0;
  const log = paraLeitura(baseExpr ? logBase(arg, baseExpr) : func('ln', arg));
  // perto da assíntota o logaritmando vai a 0⁺: logₐ vai a −∞ (a > 1) ou +∞ (a < 1), e o k pode virar o sinal
  const naAssintota = (a > 1 ? -1 : 1) * Math.sign(k) > 0 ? '+∞' : '−∞';
  const y0 = pertence(dominio, 0) ? valorEm(e, x, 0) : null;
  const largura = Math.max(6, Math.abs(raiz - x0) * 1.6);
  const janela: [number, number] = m > 0 ? [x0 - largura * 0.2, x0 + largura] : [x0 - largura, x0 + largura * 0.2];
  const entradas = [-1, 0, 1, 2].map((j) => limpo((a ** j - n) / m)).sort((p, q) => p - q);
  const nomeLog = baseExpr ? 'logₐ' : 'ln';
  const argumento = argumentoGeral(m, n, ['m', 'n']);
  const formaGeral = formaGeralCom(argumento === 'x' ? `${nomeLog} x` : `${nomeLog}(${argumento})`, k, d, ['k', 'd']);
  const outros = parametrosUsados([
    ['k', k, 1],
    ['m', m, 1],
    ['n', n, 0],
    ['d', d, 0],
  ]);
  const exemplo = baseExpr
    ? `${paraLeitura(logBase(coeficiente(limpo(a * a)), baseExpr))} = 2, porque ${paraLeitura(pot(baseExpr, num(2)))} = ${ler(limpo(a * a))}`
    : 'ln e = 1 e ln 1 = 0, porque e¹ = e e e⁰ = 1';
  const motivos = [a > 1 ? `a base ${aa} é maior que 1` : `a base ${aa} está entre 0 e 1`];
  if (m < 0) motivos.push(`m = ${ler(m)}, negativo, inverte o sentido`);
  if (k < 0) motivos.push(`k = ${ler(k)}, negativo, inverte o sentido`);
  const passos: PassoFuncao[] = [
    {
      aspecto: 'tipo',
      texto: baseExpr
        ? `A variável está no logaritmando, e a base a = ${aa} é positiva e diferente de 1 (Aula 1): é uma função logarítmica, ${naForma(formaGeral, outros)}.`
        : `ln é o logaritmo na base e (≈ 2.718), que é positiva e diferente de 1, e a variável está no logaritmando: é uma função logarítmica, ${naForma(formaGeral, outros)}.`,
    },
    {
      aspecto: 'domínio',
      texto: pura
        ? `Só existe logaritmo de número positivo: D(f) = ${dominio.texto}.`
        : `Só existe logaritmo de número positivo: ${paraLeitura(arg)} > 0 ⇔ x ${m > 0 ? '>' : '<'} ${ler(x0)}. D(f) = ${dominio.texto}.`,
    },
    { aspecto: 'imagem', texto: 'O logaritmo assume todos os valores reais (ele é a inversa da exponencial, cujo domínio é ℝ): Im(f) = ℝ.' },
    {
      aspecto: 'assíntota',
      texto: `Quando x se aproxima de ${ler(x0)} por dentro do domínio, ${paraLeitura(arg)} → 0 e f(x) → ${naAssintota}: a reta x = ${ler(x0)} é assíntota vertical.`,
    },
    {
      aspecto: 'raízes',
      texto: pura
        ? `${baseExpr ? 'logₐ 1 = 0, porque a⁰ = 1' : 'ln 1 = 0, porque e⁰ = 1'}: o gráfico passa por (1, 0), e essa é a única raiz.`
        : `f(x) = 0 ⇔ ${log} = ${ler(-d / k)} ⇔ ${paraLeitura(arg)} = ${paraLeitura(pot(baseExpr ?? E, coeficiente(-d / k)))} ${igual(a ** (-d / k))} ⇔ x ${igual(raiz)}.`,
    },
    {
      aspecto: 'crescimento',
      texto: pura
        ? a > 1
          ? `a = ${aa} > 1: função crescente, mas cada vez mais devagar.`
          : `0 < a = ${aa} < 1: função decrescente.`
        : `${cresce ? 'Crescente' : 'Decrescente'} em todo o domínio: ${motivos.join('; ')}.`,
    },
  ];
  if (y0 !== null) passos.push({ aspecto: 'corte no eixo y', texto: `f(0) ${igual(y0)}: o gráfico corta o eixo y em (0, ${ler(y0)}).` });
  return {
    entrada: e,
    variavel: x,
    tipo: 'logarítmica',
    nome: 'Função logarítmica',
    formaGeral,
    parametros: [...(baseExpr ? [{ nome: 'a', valor: a }] : []), ...outros],
    forma: e,
    dominio,
    imagem: reais(),
    raizes: { texto: `x ${igual(raiz)}`, valores: [raiz] },
    pontos: semRepetir([{ x: raiz, y: 0, nome: 'raiz' }, ...(y0 === null ? [] : [{ x: 0, y: y0, nome: 'corte no eixo y' }])]),
    assintotas: { verticais: [x0], horizontal: null },
    periodo: null,
    janela,
    entradas,
    caracteristicas: [
      { nome: 'Assíntota vertical', valor: `x = ${ler(x0)}` },
      { nome: 'Raiz', valor: `x ${igual(raiz)}` },
      { nome: 'Crescimento', valor: cresce ? 'crescente' : 'decrescente' },
      { nome: 'Corte no eixo y', valor: y0 === null ? 'não corta (0 está fora do domínio)' : `(0, ${ler(y0)})` },
    ],
    passos,
    avisos: [],
    interpretacao: pura
      ? `${log} responde "a que expoente elevar ${aa} para chegar a x?": ${exemplo}. É a inversa da exponencial ${aa}ˣ, e ${a > 1 ? 'cresce' : 'decresce'} sem limite, mas cada vez mais devagar.`
      : `É a inversa de uma exponencial: responde a que expoente elevar a base ${aa} para chegar ao valor de dentro do logaritmo. ${cresce ? 'Cresce' : 'Decresce'} sem limite, mas cada vez mais devagar.`,
  };
}

// ─── Trigonométrica ────────────────────────────────────────────────────────────

const NOME_TRIG = { sen: ['seno', 'do seno'], cos: ['cosseno', 'do cosseno'], tg: ['tangente', 'da tangente'] } as const;

/** Ângulos notáveis para a tabela, de 0 a 2π. */
const ANGULOS = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 2 * Math.PI];

function trigonometrica(e: Expr, A: number, D: number, nome: 'sen' | 'cos' | 'tg', arg: Expr, x: string): Analise {
  const lin = primeiroGrauEm(arg, x);
  if (!lin) throw new ErroDeEntrada('No modo Função, o argumento da trigonométrica é do 1º grau, como em sen(x), cos(3*x) ou tg(x - pi/4).');
  const { m: B, n: C } = lin;
  const pura = A === 1 && D === 0 && B === 1 && C === 0;
  const tangente = nome === 'tg';
  const [nomeLongo, doNome] = NOME_TRIG[nome];
  const ciclo = tangente ? 'π' : '2π';
  const P = (tangente ? Math.PI : 2 * Math.PI) / Math.abs(B);
  const u = paraLeitura(arg);
  const T = paraLeitura(func(nome, arg));
  const furos: Familia | undefined = tangente ? { inicio: normalizar((Math.PI / 2 - C) / B, P), passo: P } : undefined;
  const dominio: Conjunto = furos ? { texto: `{x ∈ ℝ | x ≠ ${textoDaFamilia(furos)}}`, intervalos: [TODOS], furos } : reais();
  const [lo, hi] = [limpo(D - Math.abs(A)), limpo(D + Math.abs(A))];
  const imagem = tangente ? reais() : conjunto(intervalo(lo, hi, true, true));
  const r = -D / A; // f(x) = 0 ⇔ T(u) = r
  const zeros = solucoes(nome, r, B, C);
  const janela: [number, number] = [(-2 * Math.PI) / Math.abs(B), (2 * Math.PI) / Math.abs(B)];
  const raizes = zeros.flatMap((f) => naJanela(f, janela)).sort((p, q) => p - q);
  const textoRaizes = zeros.length === 0 ? 'não tem' : `x = ${zeros.map(textoDaFamilia).join(' ou x = ')}, com k inteiro`;
  const argumento = argumentoGeral(B, C, ['B', 'C']);
  const formaGeral = formaGeralCom(argumento === 'x' ? `${nome} x` : `${nome}(${argumento})`, A, D, ['A', 'D']);
  const parametros = parametrosUsados([
    ['A', A, 1],
    ['B', B, 1],
    ['C', C, 0],
    ['D', D, 0],
  ]);
  const pontos: PontoNotavel[] = [];
  if (!tangente) {
    const uMaximo = nome === 'sen' ? (A > 0 ? Math.PI / 2 : (3 * Math.PI) / 2) : A > 0 ? 0 : Math.PI;
    pontos.push(
      { x: normalizar((uMaximo - C) / B, P), y: hi, nome: 'máximo' },
      { x: normalizar((uMaximo + Math.PI - C) / B, P), y: lo, nome: 'mínimo' },
    );
  }
  pontos.push(...raizes.map((z) => ({ x: z, y: 0, nome: 'raiz' })));
  if (pertence(dominio, 0)) pontos.push({ x: 0, y: valorEm(e, x, 0), nome: 'corte no eixo y' });
  const paridade = C === 0 && D === 0 ? (nome === 'cos' ? 'par' : 'ímpar') : null;
  const etapas = [`${T} fica entre −1 e 1`];
  if (A !== 1) etapas.push(`vezes A = ${ler(A)}, entre ${ler(-Math.abs(A))} e ${ler(Math.abs(A))}`);
  if (D !== 0) etapas.push(`somando D = ${ler(D)}, entre ${ler(lo)} e ${ler(hi)}`);
  const passos: PassoFuncao[] = [
    {
      aspecto: 'tipo',
      texto: pura
        ? `A variável é o ângulo ${doNome}: é uma função trigonométrica, f(x) = ${nome} x, com o ângulo x em radianos.`
        : `A variável está dentro ${doNome}: é uma função trigonométrica, ${naForma(formaGeral, parametros)}. O ângulo é medido em radianos.`,
    },
    {
      aspecto: 'domínio',
      texto: furos
        ? `tg u = sen u/cos u não existe onde cos u = 0, isto é, em u = π/2 + kπ.${pura ? '' : ` Com u = ${u}, isso tira x = ${textoDaFamilia(furos)}.`} D(f) = ${dominio.texto}.`
        : `Todo ângulo tem ${nomeLongo}: D(f) = ℝ.`,
    },
    {
      aspecto: 'imagem',
      texto: tangente
        ? 'Entre duas assíntotas, a tangente vai de −∞ a +∞: ela assume todos os valores reais. Im(f) = ℝ.'
        : pura
          ? `O ${nomeLongo} é uma coordenada de um ponto do ciclo trigonométrico, que tem raio 1: fica sempre entre −1 e 1. Im(f) = [−1, 1].`
          : `${etapas.join('; ')}. Im(f) = ${imagem.texto}.`,
    },
    {
      aspecto: 'período',
      texto: pura
        ? `${nome} x se repete a cada ${ciclo}: f(x + ${ciclo}) = f(x) para todo x. O período é ${ciclo}.`
        : B === 1
          ? `${nome} u se repete a cada ${ciclo}; com B = 1, o período em x também é ${ciclo} (A, C e D não mexem nele).`
          : `${nome} u se repete a cada ${ciclo} em u; com B = ${ler(B)}, o período em x é ${ciclo}/|B| ${igual(P)}.`,
    },
    {
      aspecto: 'raízes',
      texto: zeros.length === 0 ? `f(x) = 0 pediria ${T} = ${ler(r)}, fora de [−1, 1]: não há raiz.` : `f(x) = 0 ⇔ ${T} = ${ler(r)} ⇔ ${textoRaizes}.`,
    },
  ];
  if (furos) {
    passos.push({
      aspecto: 'assíntota',
      texto: `Nas retas x = ${textoDaFamilia(furos)}, o cosseno do ângulo zera e a tangente explode: são as assíntotas verticais.`,
    });
  }
  if (paridade) {
    passos.push({
      aspecto: 'paridade',
      texto:
        paridade === 'par'
          ? 'cos(−u) = cos u, então f(−x) = f(x): função par, com o gráfico simétrico em relação ao eixo y.'
          : `${nome}(−u) = −${nome} u, então f(−x) = −f(x): função ímpar, com o gráfico simétrico em relação à origem.`,
    });
  }
  return {
    entrada: e,
    variavel: x,
    tipo: 'trigonométrica',
    nome: `Função trigonométrica (${nomeLongo})`,
    formaGeral,
    parametros,
    forma: e,
    dominio,
    imagem,
    raizes: { texto: textoRaizes, valores: raizes },
    pontos: semRepetir(pontos),
    assintotas: { verticais: furos ? naJanela(furos, janela) : [], horizontal: null },
    periodo: P,
    janela,
    entradas: ANGULOS.map((t) => (t - C) / B),
    caracteristicas: [
      { nome: 'Período', valor: ler(P) },
      ...(tangente ? [] : [{ nome: 'Amplitude', valor: ler(Math.abs(A)) }]),
      ...(tangente ? [] : [{ nome: 'Máximo e mínimo', valor: `${ler(hi)} e ${ler(lo)}` }]),
      { nome: 'Raízes', valor: textoRaizes },
      ...(furos ? [{ nome: 'Assíntotas', valor: `x = ${textoDaFamilia(furos)}` }] : []),
      ...(paridade ? [{ nome: 'Paridade', valor: paridade === 'par' ? 'par: f(−x) = f(x)' : 'ímpar: f(−x) = −f(x)' }] : []),
    ],
    passos,
    avisos: [],
    interpretacao: tangente
      ? `A tangente se repete a cada ${ler(P)} e não tem limite: perto das assíntotas ela cresce sem parar. No ciclo trigonométrico, é a inclinação do raio.`
      : `O valor se repete a cada ${ler(P)}, oscilando entre ${ler(lo)} e ${ler(hi)}: é o modelo de tudo o que é periódico, como uma roda que gira ou uma onda.`,
  };
}

// ─── Entradas e saídas ─────────────────────────────────────────────────────────

export interface ValorCalculado {
  x: number;
  /** f com o x trocado pelo número digitado: a conta que se faz à mão. */
  conta: Expr;
  /** A saída; null quando x está fora do domínio. */
  y: number | null;
}

/** A saída para uma entrada digitada pelo aluno ("3", "-1/2", "pi/6"). */
export function calcularEm(analise: AnaliseFuncao, textoX: string): ValorCalculado {
  const x = analise.variavel;
  const valor = lerExpressao(textoX, x);
  if (contem(valor, x)) throw new ErroDeEntrada(`Digite um número para ${x}, como 3, -1.5 ou pi/6.`);
  const v = avaliar(valor);
  if (!Number.isFinite(v)) throw new ErroDeEntrada(`${textoX.trim()} não é um número real.`);
  const conta = trocar(analise.entrada, variavel(x), valor);
  if (!pertence(analise.dominio, v)) return { x: v, conta, y: null };
  const y = valorEm(analise.entrada, x, v);
  return { x: v, conta, y: Number.isFinite(y) ? y : null };
}

/** A tabela de entradas e saídas; a saída é null onde a entrada está fora do domínio. */
export function tabelaDeValores(analise: AnaliseFuncao, entradas = analise.entradas): { x: number; y: number | null }[] {
  return entradas.map((t) => {
    if (!pertence(analise.dominio, t)) return { x: t, y: null };
    const y = valorEm(analise.entrada, analise.variavel, t);
    return { x: t, y: Number.isFinite(y) ? y : null };
  });
}

/** Valores notáveis do slide das trigonométricas, na escrita do leitor: 'pi/6', 'sqrt(3)/2', 'indefinida'. */
export function valoresNotaveis(graus: number): { rad: string; sen: string; cos: string; tg: string } {
  const t = (graus * Math.PI) / 180;
  const [s, c] = [Math.sin(t), Math.cos(t)];
  return {
    rad: numeroBonito(t),
    sen: numeroBonito(s),
    cos: numeroBonito(c),
    // tg = sen/cos não existe onde cos = 0; olhar o tamanho de Math.tan não serve (tan(π/2) ≈ 1,6·10¹⁶)
    tg: Math.abs(c) < 1e-12 ? 'indefinida' : numeroBonito(s / c),
  };
}
