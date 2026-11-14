/**
 * Fórmulas em HTML para a tela, na notação da aula: frações empilhadas, expoentes, raiz com
 * traço, sen² x, ln|x|, e as pendências do passo a passo, (u)′ e ∫ u dx, destacadas.
 * O texto puro, que o próprio leitor entende, continua em paraTexto (motor/expressao.ts).
 */
import type { Expr, NomeFuncao } from '../motor/expressao';

const MENOS = '−';

export const escapar = (texto: string): string => texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A expressão em HTML. */
export const formulaHTML = (e: Expr): string => html(e, false);

/** ∫ f(x) dx, com os limites de integração (já em HTML) quando houver. */
export function integralHTML(de: Expr, variavel: string, limites?: { a: string; b: string }): string {
  const simbolo = limites
    ? `<span class="int-def"><span class="int">∫</span><span class="int-limites"><span>${limites.b}</span><span>${limites.a}</span></span></span>`
    : '<span class="int">∫</span>';
  return `${simbolo}${entre(de, 2, false)}<span class="dx">d<i class="v">${escapar(variavel)}</i></span>`;
}

/** A expressão ainda tem (u)′ ou ∫ u dx por resolver? */
export function temPendencia(e: Expr): boolean {
  switch (e.tipo) {
    case 'derivada':
    case 'integral':
      return true;
    case 'num':
    case 'var':
    case 'const':
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

/** Quanto maior, mais "colado" o termo. `emLinha`: dentro de um expoente, onde a fração vira a/b. */
function precedencia(e: Expr, emLinha: boolean): number {
  switch (e.tipo) {
    case 'soma':
    case 'sub':
      return 1;
    case 'mul':
    case 'integral':
      return 2;
    case 'neg':
      return 3;
    case 'num':
      return e.valor < 0 ? 3 : 5;
    case 'div':
      return emLinha ? 2 : 4;
    case 'pot':
      return 4;
    default:
      return 5;
  }
}

function entre(e: Expr, minimo: number, emLinha: boolean): string {
  return precedencia(e, emLinha) < minimo ? `(${html(e, emLinha)})` : html(e, emLinha);
}

function numero(valor: number): string {
  const modulo = Math.abs(valor);
  const texto = Number.isInteger(modulo) ? String(modulo) : String(Number(modulo.toPrecision(10)));
  return valor < 0 ? MENOS + texto : texto;
}

function html(e: Expr, emLinha: boolean): string {
  switch (e.tipo) {
    case 'num':
      return `<span class="n">${numero(e.valor)}</span>`;
    case 'var':
      return `<i class="v">${escapar(e.nome)}</i>`;
    case 'const':
      return e.nome === 'pi' ? '<span class="c">π</span>' : '<i class="c">e</i>';
    case 'soma':
      return `${entre(e.a, 1, emLinha)}<span class="op">+</span>${entre(e.b, 1, emLinha)}`;
    case 'sub':
      return `${entre(e.a, 1, emLinha)}<span class="op">${MENOS}</span>${entre(e.b, 2, emLinha)}`;
    case 'mul': {
      // ∫ pendente dispensa parênteses: o destaque já delimita, como em 3 ∫ x² dx
      const direita = e.b.tipo === 'integral' ? html(e.b, emLinha) : entre(e.b, 4, emLinha);
      return `${entre(e.a, 2, emLinha)}${separador(e.a, e.b)}${direita}`;
    }
    case 'div':
      return emLinha
        ? `${entre(e.a, 2, true)}/${entre(e.b, 5, true)}`
        : `<span class="frac"><span class="frac-num">${html(e.a, false)}</span><span class="frac-den">${html(e.b, false)}</span></span>`;
    case 'pot':
      return potencia(e.base, e.exp, emLinha);
    case 'neg':
      return `${MENOS}${entre(e.a, 2, emLinha)}`;
    case 'func':
      return funcao(e.nome, e.arg, '', emLinha);
    case 'log':
      return `<span class="fn">log</span><sub>${html(e.base, true)}</sub>${argumento(e.arg, emLinha)}`;
    case 'derivada':
      return `<span class="pendente">(${html(e.de, emLinha)})′</span>`;
    case 'integral':
      return `<span class="pendente">${integralHTML(e.de, e.variavel)}</span>`;
  }
}

/** Entre fatores: 2x e 2(x + 1) colados, espaço antes de função (x² sen x), ponto no resto. */
function separador(a: Expr, b: Expr): string {
  const letra = b.tipo === 'var' || b.tipo === 'const' || (b.tipo === 'pot' && (b.base.tipo === 'var' || b.base.tipo === 'const'));
  if (a.tipo === 'num' && (letra || precedencia(b, false) < 4)) return '';
  if (b.tipo === 'func' || b.tipo === 'log' || b.tipo === 'integral' || (b.tipo === 'pot' && b.base.tipo === 'func')) {
    return '<span class="esp"></span>';
  }
  return '<span class="op-mul">·</span>';
}

function potencia(base: Expr, exp: Expr, emLinha: boolean): string {
  const expoente = html(exp, true);
  // sen² x, sec²(x² + 1): como nos slides
  const quadradoDeFuncao =
    base.tipo === 'func' && base.nome !== 'raiz' && base.nome !== 'abs' && exp.tipo === 'num' && Number.isInteger(exp.valor) && exp.valor > 0;
  if (quadradoDeFuncao) return funcao(base.nome, base.arg, expoente, emLinha);
  return `${entre(base, 5, emLinha)}<sup>${expoente}</sup>`;
}

function funcao(nome: NomeFuncao, arg: Expr, expoente: string, emLinha: boolean): string {
  const elevado = expoente ? `<sup>${expoente}</sup>` : '';
  if (nome === 'raiz') {
    return `<span class="raiz"><span class="raiz-sinal">√</span><span class="raiz-dentro">${html(arg, emLinha)}</span></span>${elevado}`;
  }
  if (nome === 'abs') return `<span class="modulo">|${html(arg, emLinha)}|</span>${elevado}`;
  return `<span class="fn">${nome}</span>${elevado}${argumento(arg, emLinha)}`;
}

/** sen x sem parênteses quando o argumento é só a variável; ln|x| sem parênteses em volta do módulo. */
function argumento(arg: Expr, emLinha: boolean): string {
  if (arg.tipo === 'func' && arg.nome === 'abs') return html(arg, emLinha);
  if (arg.tipo === 'var' || arg.tipo === 'const' || (arg.tipo === 'num' && arg.valor >= 0)) {
    return `<span class="esp"></span>${html(arg, emLinha)}`;
  }
  return `(${html(arg, emLinha)})`;
}
