/**
 * Simplificação algébrica. A Aula 3 (quadro 8) lista "não simplificar a expressão final"
 * entre os erros comuns, então nenhum resultado sai do motor sem passar por aqui.
 *
 * Faz o que é seguro e previsível: contas com números, elementos neutros (0 e 1), sinais,
 * coeficientes na frente, potências da mesma base juntas, sen/cos = tg e cos/sen = cotg.
 */
import { E, div, func, iguais, mul, neg, num, pot, soma, sub } from './expressao';
import type { Expr, NomeFuncao } from './expressao';

/** Aplica as regras até a expressão parar de mudar. */
export function simplificar(e: Expr): Expr {
  let atual = e;
  for (let volta = 0; volta < 50; volta++) {
    const proxima = umaVolta(atual);
    if (iguais(proxima, atual)) return proxima;
    atual = proxima;
  }
  return atual;
}

function umaVolta(e: Expr): Expr {
  switch (e.tipo) {
    case 'num':
    case 'var':
    case 'const':
    case 'derivada':
      return e;
    case 'neg':
      return negar(umaVolta(e.a));
    case 'soma':
      return somar(umaVolta(e.a), umaVolta(e.b));
    case 'sub':
      return subtrair(umaVolta(e.a), umaVolta(e.b));
    case 'mul':
      return monomio(mul(umaVolta(e.a), umaVolta(e.b)));
    case 'div':
      return monomio(div(umaVolta(e.a), umaVolta(e.b)));
    case 'pot':
      return potencia(umaVolta(e.base), umaVolta(e.exp));
    case 'func':
      return funcao(e.nome, umaVolta(e.arg));
    case 'log':
      return { tipo: 'log', arg: umaVolta(e.arg), base: umaVolta(e.base) };
  }
}

type Numero = Extract<Expr, { tipo: 'num' }>;
const ehNum = (e: Expr): e is Numero => e.tipo === 'num';
/** Sem type guard de propósito: um guard aqui estreitaria o tipo errado no ramo falso. */
const vale = (e: Expr, valor: number): boolean => e.tipo === 'num' && e.valor === valor;

function negar(a: Expr): Expr {
  if (ehNum(a)) return num(a.valor === 0 ? 0 : -a.valor);
  if (a.tipo === 'neg') return a.a;
  if (a.tipo === 'sub') return sub(a.b, a.a); // −(p − q) = q − p
  if (a.tipo === 'soma') return neg(a);
  return monomio(mul(num(-1), a));
}

function somar(a: Expr, b: Expr): Expr {
  if (vale(a, 0)) return b;
  if (vale(b, 0)) return a;
  if (ehNum(a) && ehNum(b)) return num(a.valor + b.valor);
  const bOposto = oposto(b);
  if (bOposto) return subtrair(a, bOposto); // a + (−c) = a − c
  const aOposto = oposto(a);
  if (aOposto) return subtrair(b, aOposto); // −c + b = b − c
  if (iguais(a, b)) return monomio(mul(num(2), a));
  return soma(a, b);
}

function subtrair(a: Expr, b: Expr): Expr {
  if (vale(b, 0)) return a;
  if (vale(a, 0)) return negar(b);
  if (ehNum(a) && ehNum(b)) return num(a.valor - b.valor);
  const bOposto = oposto(b);
  if (bOposto) return somar(a, bOposto); // a − (−c) = a + c
  if (iguais(a, b)) return num(0);
  return sub(a, b);
}

/** Se e tem sinal negativo na frente, devolve −e (já sem o sinal); senão, null. */
function oposto(e: Expr): Expr | null {
  if (ehNum(e)) return e.valor < 0 ? num(-e.valor) : null;
  if (e.tipo === 'neg') return e.a;
  if ((e.tipo === 'mul' || e.tipo === 'div') && decompor(e).coefNum < 0) return monomio(mul(num(-1), e));
  return null;
}

function potencia(base: Expr, exp: Expr): Expr {
  if (vale(exp, 0)) return num(1);
  if (vale(exp, 1)) return base;
  if (vale(base, 1)) return num(1);
  if (ehNum(base) && ehNum(exp) && Number.isInteger(exp.valor) && exp.valor > 0) return num(base.valor ** exp.valor);
  if (base.tipo === 'pot' && ehNum(base.exp) && ehNum(exp)) return potencia(base.base, num(base.exp.valor * exp.valor));
  if (ehNum(exp) && exp.valor < 0) return monomio(div(num(1), potencia(base, num(-exp.valor)))); // x⁻ⁿ = 1/xⁿ
  return pot(base, exp);
}

function funcao(nome: NomeFuncao, arg: Expr): Expr {
  if (nome === 'ln') {
    if (iguais(arg, E)) return num(1);
    if (vale(arg, 1)) return num(0);
    if (arg.tipo === 'pot' && iguais(arg.base, E)) return arg.exp; // ln(eᵘ) = u
  }
  return func(nome, arg);
}

// ─── Produtos e quocientes ─────────────────────────────────────────────────────

interface Monomio {
  coefNum: number;
  coefDen: number;
  cima: Expr[];
  baixo: Expr[];
}

/** Separa um produto/quociente em coeficiente numérico, fatores de cima e fatores de baixo. */
function decompor(e: Expr): Monomio {
  const m: Monomio = { coefNum: 1, coefDen: 1, cima: [], baixo: [] };
  const visitar = (f: Expr, emCima: boolean): void => {
    if (ehNum(f)) {
      if (emCima) m.coefNum *= f.valor;
      else m.coefDen *= f.valor;
    } else if (f.tipo === 'neg') {
      m.coefNum *= -1;
      visitar(f.a, emCima);
    } else if (f.tipo === 'mul') {
      visitar(f.a, emCima);
      visitar(f.b, emCima);
    } else if (f.tipo === 'div') {
      visitar(f.a, emCima);
      visitar(f.b, !emCima);
    } else {
      (emCima ? m.cima : m.baixo).push(f);
    }
  };
  visitar(e, true);
  return m;
}

const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));

/** Ordem dos fatores: variável, depois constantes (e, π), depois o resto, como em 2·x·sen(x). */
function categoria(f: Expr): number {
  const base = f.tipo === 'pot' ? f.base : f;
  if (base.tipo === 'var') return 0;
  if (base.tipo === 'const') return 1;
  return 2;
}

interface Fator {
  base: Expr;
  exp: number;
}

/** sen(u)/cos(u) vira tg(u); cos(u)/sen(u) vira cotg(u). */
function trocarQuociente(fatores: Fator[], de: NomeFuncao, por: NomeFuncao, para: NomeFuncao): void {
  for (const f of fatores) {
    if (f.exp !== 1 || f.base.tipo !== 'func' || f.base.nome !== de) continue;
    const arg = f.base.arg;
    const par = fatores.find((o) => o.exp === -1 && o.base.tipo === 'func' && o.base.nome === por && iguais(o.base.arg, arg));
    if (par) {
      f.base = func(para, arg);
      par.exp = 0;
    }
  }
}

function monomio(e: Expr): Expr {
  const m = decompor(e);
  if (m.coefDen === 0) return e; // divisão por zero: não mexe
  if (m.coefNum === 0) return num(0);
  let coefNum = m.coefDen < 0 ? -m.coefNum : m.coefNum;
  let coefDen = Math.abs(m.coefDen);
  if (Number.isInteger(coefNum) && Number.isInteger(coefDen)) {
    const g = mdc(Math.abs(coefNum), coefDen);
    coefNum /= g;
    coefDen /= g;
  } else {
    coefNum /= coefDen;
    coefDen = 1;
  }

  // Potências da mesma base: x²·x = x³, x/x² = 1/x
  const fatores: Fator[] = [];
  const acumular = (f: Expr, sinal: number): void => {
    const numerico = f.tipo === 'pot' && ehNum(f.exp);
    const base = numerico ? f.base : f;
    const exp = numerico && ehNum(f.exp) ? f.exp.valor : 1;
    const existente = fatores.find((t) => iguais(t.base, base));
    if (existente) existente.exp += sinal * exp;
    else fatores.push({ base, exp: sinal * exp });
  };
  m.cima.forEach((f) => acumular(f, 1));
  m.baixo.forEach((f) => acumular(f, -1));
  trocarQuociente(fatores, 'sen', 'cos', 'tg');
  trocarQuociente(fatores, 'cos', 'sen', 'cotg');

  const montar = (t: Fator): Expr => (Math.abs(t.exp) === 1 ? t.base : pot(t.base, num(Math.abs(t.exp))));
  const ordenados = (lista: Fator[]) => [...lista].sort((p, q) => categoria(p.base) - categoria(q.base)).map(montar);
  const cima = ordenados(fatores.filter((t) => t.exp > 0));
  const baixo = ordenados(fatores.filter((t) => t.exp < 0));
  const produto = (lista: Expr[]): Expr => lista.reduce((acc, f) => mul(acc, f));

  let numerador: Expr;
  if (cima.length === 0) numerador = num(coefNum);
  else if (coefNum === 1) numerador = produto(cima);
  else if (coefNum === -1) numerador = neg(produto(cima));
  else numerador = produto([num(coefNum), ...cima]);

  if (baixo.length === 0 && coefDen === 1) return numerador;
  const denominador = baixo.length === 0 ? num(coefDen) : produto(coefDen === 1 ? baixo : [num(coefDen), ...baixo]);
  return div(numerador, denominador);
}
