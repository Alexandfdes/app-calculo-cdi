/**
 * Motor de derivadas: aplica as regras da Aula 3 uma de cada vez e registra o passo a passo.
 *
 * Cada passo mostra a regra como ela aparece no slide, com as derivadas internas ainda
 * pendentes, escritas como (u)'. Os passos seguintes resolvem essas pendências.
 */
import {
  ErroDeEntrada,
  avaliar,
  contem,
  derivada,
  div,
  func,
  lerExpressao,
  mul,
  neg,
  num,
  paraTexto,
  pot,
  soma,
  sub,
  variavel,
} from './expressao';
import type { Expr, NomeFuncao } from './expressao';
import { simplificar } from './simplificar';

export type Regra =
  | 'constante'
  | 'potência'
  | 'múltiplo constante'
  | 'soma/subtração'
  | 'produto'
  | 'quociente'
  | 'cadeia'
  | 'função elementar';

export interface Passo {
  regra: Regra;
  /** A expressão derivada neste passo. */
  expressao: Expr;
  /** O que a regra produz; as derivadas pendentes, (u)', são resolvidas nos passos seguintes. */
  expansao: Expr;
}

export interface ResultadoDerivada {
  entrada: Expr;
  /** Derivada já simplificada. */
  resultado: Expr;
  passos: Passo[];
  regrasUsadas: Regra[];
}

/** Deriva em relação a `x` (ou outra variável, como t no cenário do veículo). */
export function derivar(entrada: string | Expr, x = 'x'): ResultadoDerivada {
  const expr = typeof entrada === 'string' ? lerExpressao(entrada, x) : entrada;
  const passos: Passo[] = [];
  const d = (e: Expr): Expr => {
    const { regra, expansao } = aplicarRegra(e, x);
    // Passo final (sem pendências) aparece simplificado; os outros, na forma do slide.
    passos.push({ regra, expressao: e, expansao: temPendencia(expansao) ? expansao : simplificar(expansao) });
    return resolver(expansao, d);
  };
  const resultado = simplificar(d(expr));
  return { entrada: expr, resultado, passos, regrasUsadas: [...new Set(passos.map((p) => p.regra))] };
}

const NOMES: Record<Regra, string> = {
  constante: 'Derivada da constante',
  potência: 'Regra da potência',
  'múltiplo constante': 'Múltiplo constante',
  'soma/subtração': 'Soma e diferença',
  produto: 'Regra do produto',
  quociente: 'Regra do quociente',
  cadeia: 'Regra da cadeia',
  'função elementar': 'Derivada de função elementar',
};

/** Um passo em texto, por exemplo: "Regra da cadeia: (sen(3*x))' = cos(3*x)*(3*x)'". */
export const descreverPasso = (p: Passo): string => `${NOMES[p.regra]}: (${paraTexto(p.expressao)})' = ${paraTexto(p.expansao)}`;

function aplicarRegra(e: Expr, x: string): { regra: Regra; expansao: Expr } {
  const depende = (u: Expr) => contem(u, x);
  const ehX = (u: Expr) => u.tipo === 'var' && u.nome === x;
  // Com cadeia: f(u)' = f'(u)·u'. Sem cadeia, quando u é a própria variável.
  const comCadeia = (u: Expr, externa: Expr, regraSimples: Regra) =>
    ehX(u) ? { regra: regraSimples, expansao: externa } : { regra: 'cadeia' as const, expansao: mul(externa, derivada(u)) };

  if (!depende(e)) return { regra: 'constante', expansao: num(0) };

  switch (e.tipo) {
    case 'num':
    case 'const':
      return { regra: 'constante', expansao: num(0) };
    case 'var':
      return { regra: 'potência', expansao: num(1) }; // (x)' = 1·x⁰
    case 'neg':
      return { regra: 'múltiplo constante', expansao: neg(derivada(e.a)) };
    case 'soma':
      return { regra: 'soma/subtração', expansao: soma(derivada(e.a), derivada(e.b)) };
    case 'sub':
      return { regra: 'soma/subtração', expansao: sub(derivada(e.a), derivada(e.b)) };
    case 'mul':
      if (!depende(e.a)) return { regra: 'múltiplo constante', expansao: mul(e.a, derivada(e.b)) };
      if (!depende(e.b)) return { regra: 'múltiplo constante', expansao: mul(derivada(e.a), e.b) };
      return { regra: 'produto', expansao: soma(mul(derivada(e.a), e.b), mul(e.a, derivada(e.b))) };
    case 'div': {
      if (!depende(e.b)) return { regra: 'múltiplo constante', expansao: div(derivada(e.a), e.b) };
      // k/xⁿ = k·x⁻ⁿ: regra da potência, como o slide faz com 1/x
      const n = expoenteDaVariavel(e.b, x);
      if (!depende(e.a) && n !== null) {
        return { regra: 'potência', expansao: mul(e.a, mul(num(-n), pot(variavel(x), num(-n - 1)))) };
      }
      return {
        regra: 'quociente',
        expansao: div(sub(mul(derivada(e.a), e.b), mul(e.a, derivada(e.b))), pot(e.b, num(2))),
      };
    }
    case 'pot': {
      const { base, exp } = e;
      if (!depende(exp)) return comCadeia(base, mul(exp, pot(base, sub(exp, num(1)))), 'potência'); // n·uⁿ⁻¹
      if (!depende(base)) {
        if (!(avaliar(base) > 0)) throw new ErroDeEntrada(`Na exponencial aˣ a base precisa ser positiva, e aqui ela é ${paraTexto(base)}.`);
        const externa = base.tipo === 'const' && base.nome === 'e' ? e : mul(e, func('ln', base)); // aᵘ·ln a
        return comCadeia(exp, externa, 'função elementar');
      }
      throw new ErroDeEntrada('Variável na base e no expoente ao mesmo tempo (como x^x) está fora do conteúdo da disciplina.');
    }
    case 'func':
      return comCadeia(e.arg, derivadaExterna(e.nome, e.arg), e.nome === 'raiz' ? 'potência' : 'função elementar');
    case 'log':
      return comCadeia(e.arg, div(num(1), mul(e.arg, func('ln', e.base))), 'função elementar');
    case 'derivada':
    case 'integral':
      throw new Error('Marcador do passo a passo não pode aparecer na entrada.');
  }
}

/** Derivada da função de fora, avaliada em u (tabelas dos quadros 3 e 4 da Aula 3). */
function derivadaExterna(nome: NomeFuncao, u: Expr): Expr {
  switch (nome) {
    case 'sen':
      return func('cos', u);
    case 'cos':
      return neg(func('sen', u));
    case 'tg':
      return pot(func('sec', u), num(2));
    case 'cotg':
      return neg(pot(func('csc', u), num(2)));
    case 'sec':
      return mul(func('sec', u), func('tg', u));
    case 'csc':
      return neg(mul(func('csc', u), func('cotg', u)));
    case 'ln':
      return div(num(1), u);
    case 'raiz':
      return div(num(1), mul(num(2), func('raiz', u))); // √u = u^(1/2): regra da potência
    case 'abs':
      return div(u, func('abs', u)); // não existe onde u = 0 (o "bico" do |x|)
    case 'arctg':
      return div(num(1), soma(num(1), pot(u, num(2))));
  }
}

/** n se a expressão for x ou xⁿ com n numérico; senão, null. */
function expoenteDaVariavel(e: Expr, x: string): number | null {
  if (e.tipo === 'var' && e.nome === x) return 1;
  if (e.tipo === 'pot' && e.base.tipo === 'var' && e.base.nome === x && e.exp.tipo === 'num') return e.exp.valor;
  return null;
}

function temPendencia(e: Expr): boolean {
  switch (e.tipo) {
    case 'derivada':
      return true;
    case 'num':
    case 'var':
    case 'const':
    case 'integral':
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

/** Troca cada pendência (u)' pela derivada de u. */
function resolver(e: Expr, d: (u: Expr) => Expr): Expr {
  switch (e.tipo) {
    case 'derivada':
      return d(e.de);
    case 'num':
    case 'var':
    case 'const':
    case 'integral':
      return e;
    case 'soma':
    case 'sub':
    case 'mul':
    case 'div':
      return { ...e, a: resolver(e.a, d), b: resolver(e.b, d) };
    case 'pot':
      return { ...e, base: resolver(e.base, d), exp: resolver(e.exp, d) };
    case 'neg':
      return { ...e, a: resolver(e.a, d) };
    case 'func':
      return { ...e, arg: resolver(e.arg, d) };
    case 'log':
      return { ...e, arg: resolver(e.arg, d), base: resolver(e.base, d) };
  }
}

