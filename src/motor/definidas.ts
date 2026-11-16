/**
 * Integral definida pelo Teorema Fundamental do Cálculo (Aula 4, quadro 10):
 * ∫ de a a b de f(x) dx = F(b) − F(a), com F primitiva de f.
 *
 * O slide omite uma hipótese do TFC: f contínua em [a, b]. Aqui ela é conferida. Onde f não
 * existe dentro do intervalo, a integral é imprópria: converge se a primitiva tem valor ali
 * e diverge se a primitiva também explode. É o caso de ∫ de −1 a 1 de 1/x², em que a conta
 * ingênua F(1) − F(−1) dá −2.
 *
 * Com |f| (área geométrica, ou distância percorrida), o intervalo é cortado onde f troca de
 * sinal e cada trecho entra com o seu módulo.
 *
 * Onde procurar os pontos sem valor vem da estrutura da expressão: denominadores, cos(u) em
 * tg e sec, sen(u) em cotg e csc, argumento do ln. Os pontos em si são achados numericamente.
 */
import { ErroDeEntrada, avaliar, contem, func, lerExpressao, num, paraTexto, potenciaReal } from './expressao';
import type { Expr } from './expressao';
import { integrar } from './integrais';
import type { ResultadoIntegral } from './integrais';
import { calcularLimite, lerPonto } from './limites';
import type { ValorLimite } from './limites';
import { numeroBonito } from './numeros';

export interface ResultadoIntegralDefinida {
  entrada: Expr;
  a: Expr;
  b: Expr;
  /** A primitiva usada no TFC, com o passo a passo. Com |f|, é a primitiva de f. */
  primitiva: ResultadoIntegral;
  /** Pontos de [a, b] onde o integrando não existe; vazio quando o TFC vale direto. */
  descontinuidades: number[];
  /** Só com |f|: onde f troca de sinal e o intervalo foi cortado. */
  cortes: number[];
  valor: number | 'diverge';
  /**
   * Só com limite de integração infinito: o limite de F em cada ponta (a, b), ou null na ponta finita.
   * A integral converge quando os dois são números.
   */
  noInfinito?: [ValorLimite | 'não existe' | null, ValorLimite | 'não existe' | null];
  /**
   * Só quando F não existe em alguma descontinuidade de f, mas o limite lateral de F aí é um
   * número: o TFC em pedaços, com o limite no lugar de F na ponta marcada (integral imprópria).
   */
  parcelas?: ParcelaImpropria[];
}

/** Um pedaço de [a, b] do TFC em pedaços: Fa e Fb são F na ponta, ou o limite lateral de F. */
export interface ParcelaImpropria {
  a: number;
  b: number;
  Fa: number;
  Fb: number;
  /** F não existe na ponta: Fa (ou Fb) é o limite lateral de F, e não F no ponto. */
  limiteEmA: boolean;
  limiteEmB: boolean;
}

/** Distância abaixo da qual dois pontos são o mesmo; também a vizinhança de um ponto sem valor. */
const FOLGA = 1e-6;
/** Em quantas partes o intervalo é dividido na busca de zeros. */
const DIVISOES = 4000;

/** Até onde, a partir da ponta finita, o motor procura descontinuidades num intervalo sem fim. */
const ALCANCE = [40.37, 400.11];
/** Além do ALCANCE, faixas cada vez mais largas, para achar um polo longe (1/(x − 500)²). */
const ALCANCE_LONGE = [4000.13, 40000.17, 1000000.19];

/** Limites como número (0, Math.PI) ou como texto ("0", "pi", "2*pi", "e", "inf", "-inf"). */
export function integralDefinida(
  entrada: string | Expr,
  a: number | string,
  b: number | string,
  x = 'x',
): ResultadoIntegralDefinida {
  const f = typeof entrada === 'string' ? lerExpressao(entrada, x) : entrada;
  const [exprA, va] = limiteDeIntegracao(a, x);
  const [exprB, vb] = limiteDeIntegracao(b, x);
  const [lo, hi] = va <= vb ? [va, vb] : [vb, va];
  const comModulo = f.tipo === 'func' && f.nome === 'abs';
  const g = f.tipo === 'func' && f.nome === 'abs' ? f.arg : f;
  const primitiva = integrar(g, x);
  const F = (t: number): number => avaliar(primitiva.resultado, { [x]: t });
  const semFim = !Number.isFinite(lo) || !Number.isFinite(hi);
  if (semFim && comModulo) throw new ErroDeEntrada('Com módulo, o motor só calcula a área num intervalo finito.');
  const descontinuidades = unicos(janelas(lo, hi).flatMap(([p, q, pontas]) => pontosSemValor(g, x, p, q, pontas)));
  for (const [p, q] of janelas(lo, hi)) exigirValor(g, x, p, q, descontinuidades);
  const comum = { entrada: f, a: exprA, b: exprB, primitiva, descontinuidades: semFim ? descontinuidades.slice(0, 6) : descontinuidades };

  if (comModulo) {
    if (descontinuidades.length > 0) {
      throw new ErroDeEntrada(`Com módulo, o motor só calcula a área quando ${paraTexto(g)} existe em todo o intervalo.`);
    }
    const cortes = zeros((t) => avaliar(g, { [x]: t }), lo, hi).filter((c) => c - lo > FOLGA && hi - c > FOLGA);
    const pontos = [lo, ...cortes, hi];
    const area = pontos.slice(1).reduce((total, t, i) => total + Math.abs(F(t) - F(pontos[i]!)), 0);
    return { ...comum, cortes, valor: va <= vb ? area : -area };
  }

  const singulares = descontinuidades.filter((c) => pontosSemValor(primitiva.resultado, x, c - FOLGA, c + FOLGA).length > 0);
  if (singulares.length > 0) {
    // F também explode na descontinuidade: vale o limite lateral de F, quando ele é um número
    if (semFim) return { ...comum, cortes: [], valor: 'diverge' };
    const parcelas = parcelasComLimites(primitiva.resultado, lo, hi, singulares, x);
    if (!parcelas) return { ...comum, cortes: [], valor: 'diverge' };
    const soma = parcelas.reduce((t, q) => t + (q.Fb - q.Fa), 0);
    return { ...comum, cortes: [], parcelas, valor: va <= vb ? soma : -soma };
  }
  if (semFim) {
    // integral imprópria: F(±∞) é o limite de F
    const naPonta = (v: number): ValorLimite | 'não existe' | null => (Number.isFinite(v) ? null : limiteDaPrimitiva(primitiva.resultado, v, x));
    const noInfinito: [ValorLimite | 'não existe' | null, ValorLimite | 'não existe' | null] = [naPonta(va), naPonta(vb)];
    const [Fa, Fb] = [noInfinito[0] ?? F(va), noInfinito[1] ?? F(vb)];
    const converge = typeof Fa === 'number' && typeof Fb === 'number';
    return { ...comum, cortes: [], noInfinito, valor: converge ? Fb - Fa : 'diverge' };
  }
  const valor = F(vb) - F(va);
  if (Number.isNaN(valor)) {
    throw new ErroDeEntrada(`Não consegui calcular F(b) − F(a) com F(${x}) = ${paraTexto(primitiva.resultado)}.`);
  }
  return { ...comum, cortes: [], valor };
}

/** O cálculo em texto, uma linha por etapa: a primitiva, a descontinuidade ou os cortes, e o TFC. */
export function descreverIntegralDefinida(r: ResultadoIntegralDefinida): string[] {
  const x = r.primitiva.passos[0]?.variavel ?? 'x';
  const [va, vb] = [avaliar(r.a), avaliar(r.b)];
  const intervalo = `[${numeroBonito(Math.min(va, vb))}, ${numeroBonito(Math.max(va, vb))}]`;
  const f = paraTexto(r.entrada);
  const g = paraTexto(r.primitiva.entrada);
  const F = (t: number): number => avaliar(r.primitiva.resultado, { [x]: t });
  const linhas = [`Primitiva de ${g}: F(${x}) = ${paraTexto(r.primitiva.resultado)}`];
  const pontos = (lista: number[]): string => lista.map(numeroBonito).join(', ');

  if (r.parcelas) {
    linhas.push(`${f} e F não existem em ${x} = ${pontos(r.descontinuidades)}: no lugar de F aí, entra o limite lateral de F (integral imprópria).`);
    const lado = (t: number, deLimite: boolean, seta: '−' | '+'): string => (deLimite ? `lim de F com ${x} → ${numeroBonito(t)}${seta === '−' ? '⁻' : '⁺'}` : `F(${numeroBonito(t)})`);
    const trechos = r.parcelas.map((q) => `[${lado(q.b, q.limiteEmB, '−')}] − [${lado(q.a, q.limiteEmA, '+')}] = ${numeroBonito(q.Fb)} − ${q.Fa < 0 ? `(${numeroBonito(q.Fa)})` : numeroBonito(q.Fa)}`);
    linhas.push(`TFC com limites: ${trechos.join('; ')}`);
    linhas.push(`Total = ${numeroBonito(r.valor as number)}${va <= vb ? '' : ' (limites trocados: o sinal inverte)'}`);
    return linhas;
  }

  if (r.noInfinito) {
    const [lo, hi] = va <= vb ? [va, vb] : [vb, va];
    const intervaloAberto = `${Number.isFinite(lo) ? '[' : '('}${ponta(lo)}, ${ponta(hi)}${Number.isFinite(hi) ? ']' : ')'}`;
    const limites = [va, vb]
      .map((v, i) => [v, r.noInfinito![i]] as const)
      .filter(([v]) => !Number.isFinite(v))
      .map(([v, L]) => `F(${ponta(v)}) quer dizer o limite de F(${x}) com ${x} → ${ponta(v)}, que ${typeof L === 'number' || L === '+∞' || L === '-∞' ? `é ${valorNoInfinito(L)}` : 'não existe'}`);
    linhas.push(`O intervalo ${intervaloAberto} não tem fim: ${limites.join('; ')}.`);
    if (r.descontinuidades.length > 0 && r.valor !== 'diverge') {
      linhas.push(`${f} não existe em ${x} = ${pontos(r.descontinuidades)}, mas F tem valor aí: essa parte converge.`);
    }
    if (r.valor === 'diverge') {
      linhas.push('Esse limite não é um número: a integral imprópria diverge.');
      return linhas;
    }
    const valorEm = (v: number, i: 0 | 1): number => (Number.isFinite(v) ? F(v) : (r.noInfinito![i] as number));
    const [Fa, Fb] = [valorEm(va, 0), valorEm(vb, 1)];
    const subtraendo = Fa < 0 ? `(${numeroBonito(Fa)})` : numeroBonito(Fa);
    linhas.push(`TFC: F(${ponta(vb)}) - F(${ponta(va)}) = ${numeroBonito(Fb)} - ${subtraendo} = ${numeroBonito(r.valor)}`);
    return linhas;
  }

  if (r.valor === 'diverge') {
    linhas.push(`${f} não existe em ${x} = ${pontos(r.descontinuidades)}, dentro de ${intervalo}: o TFC pede f contínua em [a, b].`);
    linhas.push(`F também não tem valor em ${x} = ${pontos(r.descontinuidades)}: a integral imprópria diverge.`);
    return linhas;
  }

  if (r.entrada.tipo === 'func' && r.entrada.nome === 'abs') {
    if (r.cortes.length > 0) linhas.push(`${g} troca de sinal em ${x} = ${pontos(r.cortes)}: o intervalo é cortado aí.`);
    const marcos = [Math.min(va, vb), ...r.cortes, Math.max(va, vb)];
    const trechos = marcos.slice(1).map((t, i) => `|F(${numeroBonito(t)}) - F(${numeroBonito(marcos[i]!)})|`);
    linhas.push(`Área = ${trechos.join(' + ')} = ${numeroBonito(Math.abs(r.valor))}`);
    if (va > vb) linhas.push(`Com os limites trocados, o sinal inverte: ${numeroBonito(r.valor)}`);
    return linhas;
  }

  if (r.descontinuidades.length > 0) {
    linhas.push(`${f} não existe em ${x} = ${pontos(r.descontinuidades)}, mas F tem valor aí: a integral imprópria converge.`);
  }
  const [Fa, Fb] = [F(va), F(vb)];
  const subtraendo = Fa < 0 ? `(${numeroBonito(Fa)})` : numeroBonito(Fa);
  linhas.push(`TFC: F(${textoDoLimite(r.b)}) - F(${textoDoLimite(r.a)}) = ${numeroBonito(Fb)} - ${subtraendo} = ${numeroBonito(r.valor)}`);
  return linhas;
}

// ─── Limites, continuidade e zeros ─────────────────────────────────────────────

function limiteDeIntegracao(limite: number | string, x: string): [Expr, number] {
  if (typeof limite === 'string' && limite.trim() !== '') {
    const { a } = lerPonto(limite, x);
    if (!Number.isFinite(a)) return [num(a), a];
  }
  const expr = typeof limite === 'number' ? num(limite) : lerExpressao(limite, x);
  if (contem(expr, x)) throw new ErroDeEntrada(`O limite de integração não pode depender de ${x}.`);
  const valor = avaliar(expr);
  if (Number.isNaN(valor)) throw new ErroDeEntrada('O limite de integração precisa ser um número real, inf ou -inf.');
  return [expr, valor];
}

/**
 * O TFC em pedaços entre as singularidades de F: em cada ponta onde F não existe entra o limite
 * lateral de F (calculado pelo motor de limites). Null quando algum desses limites não é um
 * número (a integral imprópria diverge) ou o motor de limites não o resolve.
 */
function parcelasComLimites(F: Expr, lo: number, hi: number, singulares: number[], x: string): ParcelaImpropria[] | null {
  const laterais = new Map<number, { esquerda: number | null; direita: number | null }>();
  for (const c of singulares) {
    try {
      const r = calcularLimite(F, c, x);
      laterais.set(c, {
        esquerda: typeof r.esquerda === 'number' ? r.esquerda : null,
        direita: typeof r.direita === 'number' ? r.direita : null,
      });
    } catch {
      return null;
    }
  }
  const singularEm = (t: number): number | undefined => singulares.find((c) => Math.abs(c - t) <= FOLGA);
  const marcos = [lo, ...singulares.filter((c) => c - lo > FOLGA && hi - c > FOLGA), hi];
  const parcelas: ParcelaImpropria[] = [];
  for (let i = 0; i + 1 < marcos.length; i++) {
    const [p, q] = [marcos[i]!, marcos[i + 1]!];
    const sp = singularEm(p);
    const sq = singularEm(q);
    const Fa = sp === undefined ? avaliar(F, { [x]: p }) : laterais.get(sp)!.direita;
    const Fb = sq === undefined ? avaliar(F, { [x]: q }) : laterais.get(sq)!.esquerda;
    if (Fa === null || Fb === null || !Number.isFinite(Fa) || !Number.isFinite(Fb)) return null;
    parcelas.push({ a: p, b: q, Fa, Fb, limiteEmA: sp !== undefined, limiteEmB: sq !== undefined });
  }
  return parcelas;
}

/**
 * Os trechos onde procurar descontinuidades. Num intervalo sem fim, a busca vai até ALCANCE da
 * ponta finita (ou de 0). O terceiro item diz quais pontas são do intervalo de verdade: só nelas
 * um valor minúsculo conta como zero (e^x em −40 é pequeno, mas não é zero).
 */
function janelas(lo: number, hi: number): [number, number, [boolean, boolean]][] {
  if (Number.isFinite(lo) && Number.isFinite(hi)) return [[lo, hi, [true, true]]];
  const [perto, longe] = [ALCANCE[0]!, ALCANCE[1]!];
  // faixas além do alcance: [400, 4000], [4000, 40000], [40000, 10⁶], sem as pontas
  const alem = (centro: number, sentido: 1 | -1): [number, number, [boolean, boolean]][] =>
    [longe, ...ALCANCE_LONGE].slice(0, -1).map((d, i) => {
      const [p, q] = [centro + sentido * d, centro + sentido * ALCANCE_LONGE[i]!];
      return [Math.min(p, q), Math.max(p, q), [false, false]];
    });
  if (Number.isFinite(lo)) return [[lo, lo + perto, [true, false]], [lo + perto, lo + longe, [false, false]], ...alem(lo, 1)];
  if (Number.isFinite(hi)) return [...alem(hi, -1), [hi - longe, hi - perto, [false, false]], [hi - perto, hi, [false, true]]];
  return [...alem(0, -1), [-longe, -perto, [false, false]], [-perto, perto, [false, false]], [perto, longe, [false, false]], ...alem(0, 1)];
}

/** O limite de F no infinito; recusa quando o motor de limites não resolve. */
function limiteDaPrimitiva(F: Expr, infinito: number, x: string): ValorLimite | 'não existe' {
  try {
    return calcularLimite(F, infinito, x).limite;
  } catch {
    throw new ErroDeEntrada(`Não consegui calcular o limite de F(${x}) = ${paraTexto(F)} com ${x} → ${ponta(infinito)}, que a integral imprópria pede.`);
  }
}

/** Pontos de [lo, hi] onde e não existe: zeros de denominadores, de cos(u) em tg e sec, de sen(u) em cotg e csc, do argumento do ln. */
function pontosSemValor(e: Expr, v: string, lo: number, hi: number, pontas: [boolean, boolean] = [true, true]): number[] {
  const pontos: number[] = [];
  const zerosDe = (h: Expr): void => {
    if (contem(h, v)) pontos.push(...zeros((t) => avaliar(h, { [v]: t }), lo, hi, pontas));
  };
  const visitar = (n: Expr): void => {
    switch (n.tipo) {
      case 'div':
        zerosDe(n.b);
        visitar(n.a);
        visitar(n.b);
        return;
      case 'pot':
        if (!contem(n.exp, v) && avaliar(n.exp) < 0) zerosDe(n.base);
        visitar(n.base);
        visitar(n.exp);
        return;
      case 'func':
        if (n.nome === 'ln') zerosDe(n.arg);
        if (n.nome === 'tg' || n.nome === 'sec') zerosDe(func('cos', n.arg));
        if (n.nome === 'cotg' || n.nome === 'csc') zerosDe(func('sen', n.arg));
        visitar(n.arg);
        return;
      case 'log':
        zerosDe(n.arg);
        visitar(n.arg);
        return;
      case 'soma':
      case 'sub':
      case 'mul':
        visitar(n.a);
        visitar(n.b);
        return;
      case 'neg':
        visitar(n.a);
        return;
      default:
        return;
    }
  };
  visitar(e);
  return unicos(pontos);
}

/** O NaN veio de um número grande demais no meio da conta (e^(x²) em x = −400), e não de falta de valor real? */
function transbordou(e: Expr, valores: Record<string, number>): boolean {
  const filhos = Object.values(e).filter((c): c is Expr => typeof c === 'object' && c !== null && 'tipo' in c);
  if (filhos.some((c) => transbordou(c, valores))) return true;
  // o avaliador troca infinito por NaN; aqui a conta crua diz se foi estouro (base maior que 1)
  // ou um produto de dois números finitos grandes demais, e não um polo como 0⁻¹
  const [p, q] = filhos.map((c) => avaliar(c, valores));
  if (p === undefined || q === undefined || !Number.isFinite(p) || !Number.isFinite(q)) return false;
  if (e.tipo === 'pot') return Math.abs(p) > 1 && !Number.isFinite(potenciaReal(p, q));
  if (e.tipo === 'mul') return p !== 0 && q !== 0 && !Number.isFinite(p * q);
  return false;
}

/** Recusa a integral quando o integrando não tem valor real em parte do intervalo, como √x em [−1, 1]. */
function exigirValor(e: Expr, v: string, lo: number, hi: number, excecoes: number[]): void {
  const n = 400;
  for (let i = 0; i <= n; i++) {
    const t = i === n ? hi : lo + ((hi - lo) * i) / n;
    if (excecoes.some((c) => Math.abs(t - c) < FOLGA)) continue;
    if (Number.isNaN(avaliar(e, { [v]: t })) && !transbordou(e, { [v]: t })) {
      const intervalo = `[${numeroBonito(lo)}, ${numeroBonito(hi)}]`;
      throw new ErroDeEntrada(`${paraTexto(e)} não tem valor real em ${v} = ${numeroBonito(t)}, dentro de ${intervalo}: essa integral definida não existe.`);
    }
  }
}

/**
 * Zeros de h em [lo, hi]: trocas de sinal, refinadas por bisseção, e zeros sem troca de sinal
 * (como x² em 0), achados como mínimos de |h| que chegam a zero. Nas pontas não há vizinho dos
 * dois lados, então o zero ali é reconhecido pelo tamanho do valor: em ponto flutuante cos(π/2)
 * dá 6·10⁻¹⁷, e não 0. Sem isso, ∫ de 0 a π/2 de tg x saía 37,33 em vez de divergir.
 */
function zeros(h: (t: number) => number, lo: number, hi: number, pontas: [boolean, boolean] = [true, true]): number[] {
  const xs = Array.from({ length: DIVISOES + 1 }, (_, i) => (i === DIVISOES ? hi : lo + ((hi - lo) * i) / DIVISOES));
  const ys = xs.map(h);
  const escala = ys.reduce((maior, y) => (Number.isFinite(y) ? Math.max(maior, Math.abs(y)) : maior), 0);
  const pontaZerada = (i: number, y: number): boolean => ((i === 0 && pontas[0]) || (i === xs.length - 1 && pontas[1])) && Math.abs(y) <= 1e-12 * Math.max(1, escala);
  const achados: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const t = xs[i]!;
    const y = ys[i]!;
    const [antes, depois] = [ys[i - 1], ys[i + 1]];
    if (Number.isNaN(y)) continue;
    if (y === 0 || pontaZerada(i, y)) {
      achados.push(t);
      continue;
    }
    if (depois !== undefined && depois !== 0 && Math.sign(depois) === -Math.sign(y)) achados.push(bissecao(h, t, xs[i + 1]!));
    const minimoLocal =
      antes !== undefined &&
      depois !== undefined &&
      Math.sign(antes) === Math.sign(y) &&
      Math.sign(depois) === Math.sign(y) &&
      Math.abs(y) <= Math.abs(antes) &&
      Math.abs(y) <= Math.abs(depois);
    if (minimoLocal && Math.abs(y) < 1e-2 * escala) {
      const m = minimoDoModulo(h, xs[i - 1]!, xs[i + 1]!);
      if (Math.abs(h(m)) < 1e-12) achados.push(m);
    }
  }
  return unicos(achados);
}

function bissecao(h: (t: number) => number, a: number, b: number): number {
  let [ini, fim, yIni] = [a, b, h(a)];
  for (let k = 0; k < 200; k++) {
    const meio = (ini + fim) / 2;
    if (meio <= ini || meio >= fim) break;
    const y = h(meio);
    if (y === 0) return meio;
    if (Math.sign(y) === Math.sign(yIni)) [ini, yIni] = [meio, y];
    else fim = meio;
  }
  return (ini + fim) / 2;
}

/** Mínimo de |h| em [a, b], pela razão áurea. */
function minimoDoModulo(h: (t: number) => number, a: number, b: number): number {
  const r = (Math.sqrt(5) - 1) / 2;
  let [ini, fim] = [a, b];
  for (let k = 0; k < 200 && fim - ini > 1e-15 * Math.max(1, Math.abs(ini)); k++) {
    const [c, d] = [fim - r * (fim - ini), ini + r * (fim - ini)];
    if (Math.abs(h(c)) <= Math.abs(h(d))) fim = d;
    else ini = c;
  }
  return (ini + fim) / 2;
}

/** Ordena e junta os pontos que são o mesmo. */
function unicos(pontos: number[]): number[] {
  return [...pontos].sort((p, q) => p - q).filter((p, i, todos) => i === 0 || p - todos[i - 1]! > FOLGA);
}

// ─── Texto ─────────────────────────────────────────────────────────────────────

const textoDoLimite = (e: Expr): string => (e.tipo === 'num' ? numeroBonito(e.valor) : paraTexto(e));

/** Uma ponta do intervalo: número, +∞ ou −∞. */
const ponta = (v: number): string => (Number.isFinite(v) ? numeroBonito(v) : v > 0 ? '+∞' : '−∞');
const valorNoInfinito = (L: ValorLimite | 'não existe'): string => (typeof L === 'number' ? numeroBonito(L) : L === '-∞' ? '−∞' : L);
