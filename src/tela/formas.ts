/**
 * Formas prontas do modo Função: o aluno escolhe a forma geral da aula (ax + b, ax² + bx + c…) e
 * só preenche os números nas caixas. Cada mudança reescreve o campo de texto da calculadora, na
 * escrita que o motor lê, e dispara a conta. Reaproveita as formas do laboratório da Aula 1
 * (LAB_FUNCOES), que já sabem montar a expressão a partir dos parâmetros.
 */
import { LAB_FUNCOES, notacao } from './conteudos';
import type { TipoNoLab } from './conteudos';
import { escapar } from './formula';

/** A forma geral com os parâmetros no lugar das caixas: 'f(x) = ' e as peças entre eles. */
function pecas(tipo: TipoNoLab, variante: string): string[] {
  const forma = tipo.forma(variante).replace(/^f\(x\) = /, '');
  const nomes = tipo.parametros.map((p) => p.nome);
  const regex = new RegExp(`(${nomes.join('|')})`, 'g');
  return forma.split(regex);
}

export class Formas {
  private tipo: TipoNoLab | null = null;
  private variante = '';
  private valores: Record<string, number> = {};
  private readonly fichas: HTMLElement;
  private readonly caixas: HTMLElement;

  constructor(
    private readonly raiz: HTMLElement,
    /** Chamado com a expressão pronta a cada mudança de número. */
    private readonly aoMudar: (texto: string) => void,
  ) {
    raiz.innerHTML = `
      <p class="exemplos-titulo">Monte a função</p>
      <div class="chips formas-fichas" role="group" aria-label="Forma geral"></div>
      <div class="formas-caixas formula" hidden></div>`;
    this.fichas = raiz.querySelector('.formas-fichas')!;
    this.caixas = raiz.querySelector('.formas-caixas')!;
    this.fichas.innerHTML = LAB_FUNCOES.map(
      (t, i) =>
        `<button type="button" class="chip formula ficha-forma" data-forma="${i}" aria-pressed="false" aria-label="Forma ${t.rotulo}">${notacao(t.forma(t.variantes?.[0] ?? '').replace(/^f\(x\) = /, ''))}</button>`,
    ).join('');
    this.fichas.addEventListener('click', (ev) => {
      const b = (ev.target as Element).closest<HTMLElement>('[data-forma]');
      if (!b) return;
      const i = Number(b.dataset.forma);
      if (this.tipo === LAB_FUNCOES[i]) this.fechar();
      else this.abrir(i);
    });
    this.caixas.addEventListener('input', (ev) => {
      const el = ev.target as HTMLInputElement;
      if (el.dataset.parametro) {
        const v = Number(el.value.replace(',', '.'));
        if (Number.isFinite(v) && el.value.trim() !== '') {
          this.valores[el.dataset.parametro] = v;
          this.emitir();
        }
      }
    });
    this.caixas.addEventListener('change', (ev) => {
      const el = ev.target as HTMLSelectElement;
      if (el.dataset.variante !== undefined) {
        this.variante = el.value;
        this.emitir();
      }
    });
  }

  /** O aluno digitou no campo por conta própria: as caixas saem de cena. */
  fechar(): void {
    this.tipo = null;
    this.caixas.hidden = true;
    this.caixas.innerHTML = '';
    this.fichas.querySelectorAll('[data-forma]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  }

  private abrir(i: number): void {
    const tipo = LAB_FUNCOES[i]!;
    this.tipo = tipo;
    this.variante = tipo.variantes?.[0] ?? '';
    this.valores = Object.fromEntries(tipo.parametros.map((p) => [p.nome, p.inicial]));
    this.fichas.querySelectorAll<HTMLElement>('[data-forma]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.forma === String(i))));
    this.montarCaixas();
    this.caixas.hidden = false;
    this.emitir();
    this.caixas.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  }

  private montarCaixas(): void {
    const tipo = this.tipo!;
    const partes = pecas(tipo, this.variante).map((peca) => {
      const p = tipo.parametros.find((q) => q.nome === peca);
      if (!p) {
        // a variante (sen, cos ou tg) dentro da peça vira um seletor
        const v = tipo.variantes?.find((nome) => peca.includes(nome));
        if (tipo.variantes && v) {
          const opcoes = tipo.variantes.map((o) => `<option value="${o}"${o === this.variante ? ' selected' : ''}>${o}</option>`).join('');
          const [antes, depois] = peca.split(v) as [string, string];
          return `${notacao(antes)}<select data-variante aria-label="Função trigonométrica">${opcoes}</select>${notacao(depois)}`;
        }
        return notacao(peca);
      }
      return `<input type="text" inputmode="decimal" data-parametro="${p.nome}" value="${this.valores[p.nome]}" aria-label="Valor de ${p.nome}" size="4" />`;
    });
    this.caixas.innerHTML = `<span class="nome-funcao">f(<i class="v">x</i>)</span><span class="op">=</span>${partes.join('')}`;
  }

  private emitir(): void {
    const tipo = this.tipo;
    if (!tipo) return;
    this.aoMudar(tipo.montar(this.valores, this.variante));
  }

  /** Para o teste e para quem quiser saber: a forma aberta, se houver. */
  get aberta(): string | null {
    return this.tipo ? escapar(this.tipo.rotulo) : null;
  }
}
