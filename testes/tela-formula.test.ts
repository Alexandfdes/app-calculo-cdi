/**
 * Testes das fórmulas da tela (src/tela/formula.ts): a notação da aula em HTML.
 * `texto` tira as tags para comparar só o que aparece na tela.
 */
import { describe, expect, it } from 'vitest';
import { lerExpressao } from '../src/motor/expressao';
import type { Expr } from '../src/motor/expressao';
import { formulaHTML, integralHTML } from '../src/tela/formula';

const texto = (html: string): string => html.replace(/<[^>]+>/g, '');
const formula = (entrada: string): string => formulaHTML(lerExpressao(entrada));

describe('Fórmulas da tela na notação da aula', () => {
  it('produto com número fica colado e o menos é o tipográfico: 3x² − 4x + 2', () => {
    expect(texto(formula('3*x^2 - 4*x + 2'))).toBe('3x2−4x+2');
    expect(formula('3*x^2 - 4*x + 2')).not.toContain('*');
  });

  it('expoente vira sobrescrito', () => {
    expect(formula('x^2')).toBe('<i class="v">x</i><sup><span class="n">2</span></sup>');
  });

  it('quociente vira fração empilhada e a raiz ganha o traço', () => {
    const html = formula('1/(2*sqrt(x))');
    expect(html).toContain('class="frac"');
    expect(html).toContain('class="raiz"');
  });

  it('sec² x e ln|x| como nos slides', () => {
    expect(formula('sec(x)^2')).toContain('<span class="fn">sec</span><sup>');
    expect(texto(formula('ln(abs(x))'))).toBe('ln|x|');
  });

  it('a integral põe parênteses em volta da soma', () => {
    expect(texto(integralHTML(lerExpressao('3*x^2 - 4*x + 2'), 'x'))).toBe('∫(3x2−4x+2)dx');
  });

  it('nada do que vem de fora entra como HTML', () => {
    const malicioso: Expr = { tipo: 'var', nome: '<img src=x onerror=alert(1)>' };
    expect(formulaHTML(malicioso)).not.toContain('<img');
  });
});
