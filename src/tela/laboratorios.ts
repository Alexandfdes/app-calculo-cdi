/**
 * Laboratórios da vista "Conteúdo das aulas": gráficos pequenos que o aluno controla, um para a
 * ideia central de cada aula, mais o círculo trigonométrico.
 * - Funções: os parâmetros de cada tipo mexem no gráfico, no domínio e na imagem.
 * - Limites: x chega perto de a pelos dois lados.
 * - Derivadas: h encolhe e a secante vira a tangente.
 * - Integrais: os retângulos de Riemann se multiplicam até virar a área.
 * - A lombada (na história do carro, em todas as aulas): o tempo de reação e a freada mudam a
 *   velocidade com que o carro chega, e a área debaixo da velocidade é a distância andada.
 * As contas exatas vêm do motor, as mesmas da calculadora; os casos de cada laboratório ficam em
 * conteudos.ts, onde o teste confere cada um. O desenho é em canvas, sem biblioteca, no estilo
 * do gráfico principal. Com "reduzir movimento" ligado, o ▶ pula direto para o fim.
 */
import { integralDefinida } from '../motor/definidas';
import { derivar } from '../motor/derivadas';
import { avaliar, lerExpressao } from '../motor/expressao';
import type { Expr } from '../motor/expressao';
import { analisarFuncao, calcularEm, igualdadeDaAnalise, numeroDaAnalise, pertence, valoresNotaveis } from '../motor/funcoes';
import type { AnaliseFuncao, Conjunto } from '../motor/funcoes';
import { avaliarFuncao, calcularLimite, lerFuncaoDoLimite } from '../motor/limites';
import type { FuncaoDoLimite, ResultadoLimite, ValorLimite } from '../motor/limites';
import { numeroParaLer, paraLer } from '../motor/numeros';
import {
  CARRO,
  LAB_DERIVADAS,
  LAB_FUNCOES,
  LAB_INTEGRAIS,
  LAB_LIMITES,
  chegadaNaLombada,
  contaDaFrenagem,
  notacao,
  passoDaSecante,
  posicaoNoInstante,
  velocidadeNoInstante,
} from './conteudos';
import type { Conta, Janela } from './conteudos';
import { escapar, formulaHTML, integralHTML } from './formula';
import { curto, passoBonito, passoDePi, rotuloDePi } from './grafico';

type AoCalcular = (conta: Conta) => void;
/** Para as animações e o observador de tamanho quando a aula sai da tela. */
export type Desmontar = () => void;

const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FONTE = '"Segoe UI", system-ui, -apple-system, sans-serif';
const BOTAO_CALCULAR = '<button type="button" class="conta" data-calcular>Abrir na calculadora<span aria-hidden="true"> ↗</span></button>';

const limitar = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const suave = (p: number): number => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));
/** Até 6 algarismos, com o sinal de menos tipográfico; ±∞ e "não existe" fora dos reais. */
const seis = (v: number): string => (Number.isFinite(v) ? String(Number(v.toPrecision(6))).replace('-', '−') : Number.isNaN(v) ? 'não existe' : v > 0 ? '+∞' : '−∞');
const formula = (s: string): string => `<span class="formula">${notacao(s)}</span>`;

function achar<T extends Element>(raiz: ParentNode, seletor: string): T {
  const el = raiz.querySelector<T>(seletor);
  if (!el) throw new Error(`Laboratório sem ${seletor}`);
  return el;
}

/** Marca o botão escolhido de um grupo (aria-pressed). */
function marcar(grupo: ParentNode, atributo: string, valor: string): void {
  grupo.querySelectorAll<HTMLElement>(`[${atributo}]`).forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute(atributo) === valor)));
}

const chips = (rotulos: string[], atributo: string): string =>
  rotulos.map((r, i) => `<button type="button" class="lab-chip" ${atributo}="${i}" aria-pressed="false">${escapar(r)}</button>`).join('');

// ─── O plano: canvas com eixos, curvas e marcas ────────────────────────────────

interface Cores {
  f: string;
  segunda: string;
  tangente: string;
  dominio: string;
  imagem: string;
  erro: string;
  positiva: string;
  negativa: string;
  amarelo: string;
}

function lerCores(): Cores {
  const css = getComputedStyle(document.documentElement);
  const cor = (nome: string, reserva: string): string => css.getPropertyValue(nome).trim() || reserva;
  return {
    f: cor('--cor-f', '#38bdf8'),
    segunda: cor('--cor-segunda', '#f472b6'),
    tangente: cor('--cor-tangente', '#a3e635'),
    dominio: cor('--cor-dominio', '#34d399'),
    imagem: cor('--cor-imagem', '#c084fc'),
    erro: cor('--erro', '#fb7185'),
    positiva: cor('--area-positiva', 'rgba(56, 189, 248, 0.28)'),
    negativa: cor('--area-negativa', 'rgba(251, 113, 133, 0.3)'),
    amarelo: '#facc15',
  };
}

class Plano {
  readonly ctx: CanvasRenderingContext2D;
  readonly cor = lerCores();
  largura = 0;
  altura = 0;
  x0 = -5;
  x1 = 5;
  y0 = -5;
  y1 = 5;
  private readonly observador: ResizeObserver;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    janela: Janela,
    private readonly redesenhar: () => void,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Este navegador não desenha em canvas 2D.');
    this.ctx = ctx;
    this.janela(janela);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(canvas);
  }

  janela([x0, x1, y0, y1]: Janela): void {
    this.x0 = x0;
    this.x1 = x1;
    this.y0 = y0;
    this.y1 = y1;
  }

  desmontar(): void {
    this.observador.disconnect();
  }

  private medir(): void {
    const r = this.canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.largura = r.width;
    this.altura = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redesenhar();
  }

  /** Limpa a tela; false enquanto o canvas não tem tamanho (a aula está escondida). */
  limpar(): boolean {
    if (this.largura === 0 || this.altura === 0) return false;
    this.ctx.clearRect(0, 0, this.largura, this.altura);
    return true;
  }

  px(x: number): number {
    return ((x - this.x0) / (this.x1 - this.x0)) * this.largura;
  }

  py(y: number): number {
    const h = this.y1 - this.y0;
    return this.altura - ((limitar(y, this.y0 - h * 4, this.y1 + h * 4) - this.y0) / h) * this.altura;
  }

  /** O x do plano sob o ponteiro. */
  xNoPonteiro(ev: PointerEvent): number {
    const r = this.canvas.getBoundingClientRect();
    return this.x0 + ((ev.clientX - r.left) / r.width) * (this.x1 - this.x0);
  }

  /** Onde desenhar os eixos: no eixo de verdade quando ele aparece, senão na borda. */
  get linhaX(): number {
    return limitar(this.py(0), 6, this.altura - 6);
  }

  get colunaY(): number {
    return limitar(this.px(0), 6, this.largura - 6);
  }

  grade(pi = false): void {
    const { ctx, x0, x1, y0, y1 } = this;
    const passoX = pi ? passoDePi(x1 - x0) : passoBonito((x1 - x0) / 9);
    const passoY = passoBonito((y1 - y0) / 7);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = Math.ceil(x0 / passoX); i * passoX <= x1; i++) xs.push(i * passoX);
    for (let i = Math.ceil(y0 / passoY); i * passoY <= y1; i++) ys.push(i * passoY);
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.10)';
    ctx.beginPath();
    for (const x of xs) {
      ctx.moveTo(this.px(x), 0);
      ctx.lineTo(this.px(x), this.altura);
    }
    for (const y of ys) {
      ctx.moveTo(0, this.py(y));
      ctx.lineTo(this.largura, this.py(y));
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (y0 <= 0 && y1 >= 0) {
      ctx.moveTo(0, this.py(0));
      ctx.lineTo(this.largura, this.py(0));
    }
    if (x0 <= 0 && x1 >= 0) {
      ctx.moveTo(this.px(0), 0);
      ctx.lineTo(this.px(0), this.altura);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(203, 213, 225, 0.75)';
    ctx.font = `500 11px ${FONTE}`;
    ctx.textAlign = 'center';
    // sem rótulo colado na borda, onde ele sairia cortado
    const linha = limitar(this.py(0) + 15, 14, this.altura - 6);
    for (const x of xs) {
      const cx = this.px(x);
      if (Math.abs(x) >= passoX / 2 && cx > 14 && cx < this.largura - 14) ctx.fillText(pi ? rotuloDePi(x) : curto(x), cx, linha);
    }
    ctx.textAlign = 'left';
    const coluna = limitar(this.px(0) + 6, 4, this.largura - 34);
    for (const y of ys) {
      const cy = this.py(y);
      if (Math.abs(y) >= passoY / 2 && cy > 14 && cy < this.altura - 8) ctx.fillText(curto(y), coluna, cy - 4);
    }
    ctx.restore();
  }

  /** A curva; quebra nas assíntotas, onde f não existe e em `quebras`. */
  curva(f: (x: number) => number, cor: string, espessura = 2.6, quebras: number[] = []): void {
    const { ctx, x0, x1, y0, y1 } = this;
    const altura = y1 - y0;
    const n = Math.max(240, Math.floor(this.largura / 1.2));
    let anterior: number | null = null;
    let xAnterior = Number.NEGATIVE_INFINITY;
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.lineWidth = espessura;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = cor;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = f(x);
      if (!Number.isFinite(y) || Math.abs(y - (y0 + y1) / 2) > altura * 50) {
        anterior = null;
        continue;
      }
      const salto = anterior !== null && Math.abs(y - anterior) > altura * 2.5;
      const cruzou = quebras.some((q) => xAnterior < q && x >= q);
      if (anterior === null || salto || cruzou) ctx.moveTo(this.px(x), this.py(y));
      else ctx.lineTo(this.px(x), this.py(y));
      anterior = y;
      xAnterior = x;
    }
    ctx.stroke();
    ctx.restore();
  }

  segmento(xa: number, ya: number, xb: number, yb: number, cor: string, espessura = 2, tracejado = false): void {
    this.segmentoPx(this.px(xa), this.py(ya), this.px(xb), this.py(yb), cor, espessura, tracejado);
  }

  segmentoPx(xa: number, ya: number, xb: number, yb: number, cor: string, espessura = 1.6, tracejado = true): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.lineWidth = espessura;
    if (tracejado) {
      ctx.setLineDash([5, 5]);
      ctx.globalAlpha = 0.85;
    } else {
      ctx.shadowColor = cor;
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.moveTo(xa, ya);
    ctx.lineTo(xb, yb);
    ctx.stroke();
    ctx.restore();
  }

  /** A reta inteira por (x, y), cortada um pouco além da janela (inclinações enormes não distorcem). */
  reta(x: number, y: number, inclinacao: number, cor: string, espessura = 2, tracejado = false): void {
    if (!Number.isFinite(y) || !Number.isFinite(inclinacao)) return;
    const folga = this.y1 - this.y0;
    let [xa, xb] = [this.x0, this.x1];
    if (inclinacao !== 0) {
      const [c1, c2] = [x + (this.y0 - folga - y) / inclinacao, x + (this.y1 + folga - y) / inclinacao];
      xa = Math.max(xa, Math.min(c1, c2));
      xb = Math.min(xb, Math.max(c1, c2));
    }
    if (xb <= xa) return;
    this.segmento(xa, y + inclinacao * (xa - x), xb, y + inclinacao * (xb - x), cor, espessura, tracejado);
  }

  vertical(x: number, cor: string): void {
    if (x < this.x0 || x > this.x1) return;
    this.segmentoPx(this.px(x), 0, this.px(x), this.altura, cor, 1.4, true);
  }

  horizontal(y: number, cor: string): void {
    if (y < this.y0 || y > this.y1) return;
    this.segmentoPx(0, this.py(y), this.largura, this.py(y), cor, 1.4, true);
  }

  ponto(x: number, y: number, cor: string, raio = 6): void {
    if (!Number.isFinite(y)) return;
    const { ctx } = this;
    const [cx, cy] = [this.px(x), this.py(y)];
    ctx.save();
    ctx.fillStyle = cor;
    ctx.shadowColor = cor;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b1020';
    ctx.beginPath();
    ctx.arc(cx, cy, raio * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Bolinha cheia (o valor entra) ou vazia (não entra), em pixels. */
  bolinhaPx(cx: number, cy: number, cor: string, cheia: boolean): void {
    const { ctx } = this;
    ctx.save();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = cor;
    ctx.fillStyle = cheia ? cor : '#0b1226';
    ctx.shadowColor = cor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** O furo da curva: o valor do qual f se aproxima, mas que ela não assume ali. */
  buraco(x: number, y: number, cor: string): void {
    if (y < this.y0 || y > this.y1) return;
    this.bolinhaPx(this.px(x), this.py(y), cor, false);
  }

  /** Texto com contorno escuro, legível sobre a grade e as curvas. */
  texto(conteudo: string, cx: number, cy: number, cor: string, alinhar: CanvasTextAlign = 'center', tamanho = 12): void {
    const { ctx } = this;
    ctx.save();
    ctx.font = `700 ${tamanho}px ${FONTE}`;
    ctx.textAlign = alinhar;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(7, 11, 24, 0.9)';
    ctx.strokeText(conteudo, cx, cy);
    ctx.fillStyle = cor;
    ctx.fillText(conteudo, cx, cy);
    ctx.restore();
  }

  /** Domínio (no eixo x) ou imagem (no eixo y): a faixa acesa, com bolinhas nas pontas. */
  faixa(eixo: 'x' | 'y', conjunto: Conjunto, furos: number[]): void {
    const { ctx } = this;
    const cor = eixo === 'x' ? this.cor.dominio : this.cor.imagem;
    const linha = eixo === 'x' ? this.linhaX : this.colunaY;
    const [lo, hi] = eixo === 'x' ? [this.x0, this.x1] : [this.y0, this.y1];
    const ponto = (v: number): [number, number] => (eixo === 'x' ? [this.px(v), linha] : [linha, this.py(v)]);
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 7;
    ctx.shadowColor = cor;
    ctx.shadowBlur = 12;
    for (const iv of conjunto.intervalos) {
      const [a, b] = [Math.max(iv.de, lo), Math.min(iv.ate, hi)];
      if (b < a) continue;
      ctx.beginPath();
      ctx.moveTo(...ponto(a));
      ctx.lineTo(...ponto(b === a ? b + (hi - lo) * 0.004 : b));
      ctx.stroke();
    }
    ctx.restore();
    for (const iv of conjunto.intervalos) {
      for (const [v, fechada] of [
        [iv.de, iv.fechadoDe],
        [iv.ate, iv.fechadoAte],
      ] as const) {
        if (Number.isFinite(v) && v >= lo && v <= hi) this.bolinhaPx(...ponto(v), cor, fechada);
      }
    }
    for (const v of furos) if (v >= lo && v <= hi) this.bolinhaPx(...ponto(v), cor, false);
  }

  /** Retângulo de Riemann, do eixo x até a altura y. */
  retangulo(xa: number, xb: number, y: number): void {
    if (!Number.isFinite(y)) return;
    const { ctx } = this;
    const [ea, eb, zero, topo] = [this.px(xa), this.px(xb), this.py(0), this.py(y)];
    const [cima, alto] = [Math.min(zero, topo), Math.abs(topo - zero)];
    ctx.save();
    ctx.fillStyle = y >= 0 ? this.cor.positiva : this.cor.negativa;
    ctx.fillRect(ea, cima, eb - ea, alto);
    if (eb - ea > 3) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = y >= 0 ? this.cor.f : this.cor.erro;
      ctx.lineWidth = 1;
      ctx.strokeRect(ea + 0.5, cima, eb - ea - 1, alto);
    }
    ctx.restore();
  }
}

/** Os furos de uma família (os de tg x) que caem na janela. */
function furosNaJanela(c: Conjunto, de: number, ate: number): number[] {
  const familia = c.furos;
  if (!familia || familia.passo === 0) return [];
  const passo = Math.abs(familia.passo);
  const lista: number[] = [];
  for (let k = Math.ceil((de - familia.inicio) / passo); familia.inicio + k * passo <= ate && lista.length < 60; k++) lista.push(familia.inicio + k * passo);
  return lista;
}

/** Botão ▶ que leva um valor de onde está até o fim, com pausa; com "reduzir movimento", pula para o fim. */
function tocador(
  botao: HTMLButtonElement,
  rotulos: { tocar: string; pausar: string; denovo: string },
  passo: (agora: number, inicio: number) => boolean,
  pularParaOFim: () => void,
  noFim: () => boolean,
): { parar: () => void } {
  let quadro = 0;
  let tocando = false;
  const rotular = (): void => {
    botao.textContent = tocando ? rotulos.pausar : noFim() ? rotulos.denovo : rotulos.tocar;
  };
  const parar = (): void => {
    cancelAnimationFrame(quadro);
    tocando = false;
    rotular();
  };
  botao.addEventListener('click', () => {
    if (tocando) {
      parar();
      return;
    }
    if (calmo) {
      pularParaOFim();
      rotular();
      return;
    }
    tocando = true;
    rotular();
    const inicio = performance.now();
    const quadroSeguinte = (agora: number): void => {
      if (!tocando) return;
      if (passo(agora, inicio)) quadro = requestAnimationFrame(quadroSeguinte);
      else parar();
    };
    quadro = requestAnimationFrame(quadroSeguinte);
  });
  rotular();
  return { parar };
}

// ─── Aula 1: funções com controles ─────────────────────────────────────────────

const DESTAQUES = ['Vértice', 'Vértice (bico)', 'Assíntota horizontal', 'Assíntota vertical', 'Assíntotas', 'Período', 'Taxa de variação', 'Corte no eixo y'];

/** A entrada que o ponteiro escolheu, arredondada para a conta sair limpa: 1.5, π/3, −2. */
function entradaArredondada(x: number, pi: boolean): { valor: number; texto: string } {
  if (!pi) {
    const v = Number(x.toFixed(1));
    return { valor: v, texto: String(v) };
  }
  const k = Math.round(x / (Math.PI / 12));
  if (k === 0) return { valor: 0, texto: '0' };
  const g = mdc(Math.abs(k), 12);
  const [p, q] = [k / g, 12 / g];
  const multiplo = p === 1 ? 'pi' : p === -1 ? '-pi' : `${p}*pi`;
  return { valor: (k * Math.PI) / 12, texto: q === 1 ? multiplo : `${multiplo}/${q}` };
}

function laboratorioDeFuncoes(raiz: HTMLElement, aoCalcular: AoCalcular): Desmontar {
  raiz.innerHTML = `
    <div class="lab-escolhas" role="group" aria-label="Tipo de função">${chips(
      LAB_FUNCOES.map((t) => t.rotulo),
      'data-tipo',
    )}</div>
    <div class="lab-grade">
      <div class="lab-tela"><canvas role="img" aria-label="Gráfico da função escolhida, com o domínio aceso no eixo x e a imagem no eixo y"></canvas></div>
      <div class="lab-painel">
        <p class="lab-forma"></p>
        <div class="lab-escolhas lab-variantes" role="group" aria-label="Função trigonométrica"></div>
        <div class="lab-controles"></div>
        <p class="lab-formula" aria-live="polite"></p>
        <dl class="ficha lab-ficha">
          <div><dt>Tipo</dt><dd data-campo="tipo"></dd></div>
          <div class="dominio"><dt>Domínio</dt><dd data-campo="dominio"></dd></div>
          <div class="imagem"><dt>Imagem</dt><dd data-campo="imagem"></dd></div>
          <div><dt>Raízes</dt><dd data-campo="raizes"></dd></div>
          <div data-campo="destaque"><dt data-campo="destaque-nome"></dt><dd data-campo="destaque-valor"></dd></div>
        </dl>
        <p class="lab-nota" hidden></p>
        <label class="controle"><span class="controle-nome">Entrada: <output data-campo="entrada"></output></span><input type="range" data-entrada aria-label="Entrada x" /></label>
        <p class="lab-saida"></p>
        ${BOTAO_CALCULAR}
      </div>
    </div>`;
  const canvas = achar<HTMLCanvasElement>(raiz, 'canvas');
  const tipos = achar<HTMLElement>(raiz, '.lab-escolhas');
  const forma = achar<HTMLElement>(raiz, '.lab-forma');
  const variantes = achar<HTMLElement>(raiz, '.lab-variantes');
  const controles = achar<HTMLElement>(raiz, '.lab-controles');
  const formulaAtual = achar<HTMLElement>(raiz, '.lab-formula');
  const nota = achar<HTMLElement>(raiz, '.lab-nota');
  const saida = achar<HTMLElement>(raiz, '.lab-saida');
  const controleDaEntrada = achar<HTMLInputElement>(raiz, '[data-entrada]');
  const campo = (nome: string): HTMLElement => achar<HTMLElement>(raiz, `[data-campo="${nome}"]`);

  let indice = Math.max(
    0,
    LAB_FUNCOES.findIndex((t) => t.tipo === 'quadrática'),
  );
  let valores: Record<string, number> = {};
  let variante = '';
  let entrada = 1;
  let texto = '';
  let analise: AnaliseFuncao | null = null;
  let f: ((x: number) => number) | null = null;
  const plano = new Plano(canvas, LAB_FUNCOES[indice]!.janela, () => desenhar());

  function escolher(i: number): void {
    indice = i;
    const tipo = LAB_FUNCOES[i]!;
    valores = Object.fromEntries(tipo.parametros.map((p) => [p.nome, p.inicial]));
    variante = tipo.variantes?.[0] ?? '';
    entrada = tipo.pi ? Math.PI / 2 : 1;
    plano.janela(tipo.janela);
    marcar(tipos, 'data-tipo', String(i));
    variantes.hidden = !tipo.variantes;
    variantes.innerHTML = (tipo.variantes ?? [])
      .map((v) => `<button type="button" class="lab-chip" data-variante="${v}" aria-pressed="${v === variante}">${v} x</button>`)
      .join('');
    controles.innerHTML = tipo.parametros
      .map(
        (p) => `<label class="controle"><span class="controle-nome">${formula(p.nome)} = <output>${seis(p.inicial)}</output></span>
          <input type="range" min="${p.min}" max="${p.max}" step="${p.passo}" value="${p.inicial}" data-parametro="${p.nome}" aria-label="Parâmetro ${p.nome}" /></label>`,
      )
      .join('');
    controleDaEntrada.min = String(tipo.janela[0]);
    controleDaEntrada.max = String(tipo.janela[1]);
    controleDaEntrada.step = tipo.pi ? String(Math.PI / 12) : '0.1';
    controleDaEntrada.value = String(entrada);
    atualizar();
  }

  function atualizar(): void {
    const tipo = LAB_FUNCOES[indice]!;
    forma.innerHTML = `Forma geral: ${formula(tipo.forma(variante))}`;
    texto = tipo.montar(valores, variante);
    let erro: string | null = null;
    try {
      analise = analisarFuncao(texto);
    } catch (e) {
      analise = null;
      erro = e instanceof Error ? e.message : 'Não deu para analisar essa função.';
    }
    let expr: Expr | null = null;
    try {
      expr = lerExpressao(texto);
    } catch {
      expr = null;
    }
    const lida = expr;
    f = lida ? (t) => avaliar(lida, { x: t }) : null;
    const mostrada = analise?.forma ?? lida;
    formulaAtual.innerHTML = mostrada ? `<span class="formula">${notacao('f(x) = ')}${formulaHTML(mostrada)}</span>` : '';
    campo('tipo').textContent = analise?.nome ?? '—';
    campo('dominio').textContent = analise?.dominio.texto ?? '—';
    campo('imagem').textContent = analise?.imagem.texto ?? '—';
    campo('raizes').textContent = analise?.raizes.texto ?? '—';
    const destaque = analise?.caracteristicas.find((c) => DESTAQUES.includes(c.nome));
    campo('destaque').hidden = !destaque;
    campo('destaque-nome').textContent = destaque?.nome ?? '';
    campo('destaque-valor').textContent = destaque?.valor ?? '';
    const aviso = erro ?? tipo.foraDoTipo(valores);
    nota.hidden = !aviso;
    nota.textContent = aviso ?? '';
    nota.classList.toggle('erro', erro !== null);
    atualizarSaida();
    desenhar();
  }

  function atualizarSaida(): void {
    const tipo = LAB_FUNCOES[indice]!;
    const { valor, texto: textoX } = entradaArredondada(entrada, tipo.pi === true);
    campo('entrada').textContent = tipo.pi ? paraLer(textoX) : seis(valor);
    if (!analise) {
      saida.innerHTML = '';
      return;
    }
    try {
      const r = calcularEm(analise, textoX);
      const x = escapar(numeroDaAnalise(analise, r.x));
      saida.innerHTML =
        r.y === null
          ? `${formula('x = ')}${x} está fora do domínio: ${formula('f(')}${x}${formula(')')} não existe.`
          : `<span class="formula">${notacao('f(')}${x}) <span class="op">=</span>${formulaHTML(r.conta)} ${escapar(igualdadeDaAnalise(analise, r.y))}</span>`;
    } catch {
      saida.innerHTML = '';
    }
  }

  function desenhar(): void {
    if (!plano.limpar()) return;
    const tipo = LAB_FUNCOES[indice]!;
    const { cor } = plano;
    plano.grade(tipo.pi === true);
    if (analise) {
      for (const x of analise.assintotas.verticais) plano.vertical(x, cor.erro);
      if (analise.assintotas.horizontal !== null) plano.horizontal(analise.assintotas.horizontal, cor.erro);
      plano.faixa('x', analise.dominio, furosNaJanela(analise.dominio, plano.x0, plano.x1));
      plano.faixa('y', analise.imagem, []);
    }
    if (f) plano.curva(f, analise ? cor.f : cor.erro, 2.6, analise?.assintotas.verticais ?? []);
    if (analise) {
      for (const p of analise.pontos) {
        if (p.x < plano.x0 || p.x > plano.x1 || p.y < plano.y0 || p.y > plano.y1) continue;
        plano.ponto(p.x, p.y, p.nome === 'raiz' ? cor.segunda : p.nome === 'corte no eixo y' ? cor.tangente : cor.amarelo, 5);
      }
    }
    if (!analise || !f) return;
    const { valor: x } = entradaArredondada(entrada, tipo.pi === true);
    const y = pertence(analise.dominio, x) ? f(x) : Number.NaN;
    if (Number.isFinite(y)) {
      plano.segmentoPx(plano.px(x), plano.linhaX, plano.px(x), plano.py(y), cor.dominio);
      plano.segmentoPx(plano.px(x), plano.py(y), plano.colunaY, plano.py(y), cor.imagem);
      plano.ponto(x, y, '#ffffff', 6);
    } else {
      plano.texto('×', plano.px(x), plano.linhaX + 5, cor.erro, 'center', 18);
    }
  }

  tipos.addEventListener('click', (ev) => {
    const botao = (ev.target as Element).closest<HTMLElement>('[data-tipo]');
    if (botao) escolher(Number(botao.dataset.tipo));
  });
  variantes.addEventListener('click', (ev) => {
    const botao = (ev.target as Element).closest<HTMLElement>('[data-variante]');
    if (!botao) return;
    variante = botao.dataset.variante ?? variante;
    marcar(variantes, 'data-variante', variante);
    atualizar();
  });
  controles.addEventListener('input', (ev) => {
    const controle = ev.target as HTMLInputElement;
    const nome = controle.dataset.parametro;
    if (!nome) return;
    const casas = (controle.step.split('.')[1] ?? '').length;
    const v = Number(controle.valueAsNumber.toFixed(casas));
    valores[nome] = v;
    const saidaDoControle = controle.parentElement?.querySelector('output');
    if (saidaDoControle) saidaDoControle.textContent = seis(v);
    atualizar();
  });
  controleDaEntrada.addEventListener('input', () => {
    entrada = controleDaEntrada.valueAsNumber;
    atualizarSaida();
    desenhar();
  });
  const mover = (ev: PointerEvent): void => {
    entrada = limitar(plano.xNoPonteiro(ev), plano.x0, plano.x1);
    controleDaEntrada.value = String(entrada);
    atualizarSaida();
    desenhar();
  };
  canvas.addEventListener('pointermove', mover);
  canvas.addEventListener('pointerdown', mover);
  achar<HTMLButtonElement>(raiz, '[data-calcular]').addEventListener('click', () => aoCalcular({ modo: 'funcao', f: texto, resposta: analise?.tipo ?? '' }));
  escolher(indice);
  return () => plano.desmontar();
}

// ─── Aula 1: o círculo trigonométrico ──────────────────────────────────────────

function laboratorioDoCirculo(raiz: HTMLElement): Desmontar {
  const NOTAVEIS = [0, 30, 45, 60, 90, 120, 135, 150, 180, 270];
  raiz.innerHTML = `
    <div class="lab-tela lab-circulo"><canvas role="img" aria-label="Círculo trigonométrico com o ponto P, o seno e o cosseno, e o gráfico do seno ao lado"></canvas></div>
    <div class="lab-linha">
      <button type="button" class="lab-tocar"></button>
      <div class="lab-escolhas" role="group" aria-label="Ângulos notáveis">${NOTAVEIS.map(
        (g) => `<button type="button" class="lab-chip" data-graus="${g}" aria-pressed="false">${g}°</button>`,
      ).join('')}</div>
    </div>
    <p class="lab-leitura" aria-live="polite"></p>`;
  const canvas = achar<HTMLCanvasElement>(raiz, 'canvas');
  const angulos = achar<HTMLElement>(raiz, '.lab-escolhas');
  const leitura = achar<HTMLElement>(raiz, '.lab-leitura');
  const DUAS_VOLTAS = 2 * Math.PI;
  let theta = Math.PI / 3;
  /** Graus inteiros quando o ângulo foi escolhido (valores exatos); null girando. */
  let graus: number | null = 60;
  const plano = new Plano(canvas, [0, 1, 0, 1], () => desenhar());
  let geometria = { cx: 0, cy: 0, r: 1, g0: 0, g1: 1 };

  function desenhar(): void {
    if (!plano.limpar()) return;
    const { ctx, largura: L, altura: A, cor } = plano;
    const r = Math.min(A * 0.36, L * 0.17);
    const cx = r + 30;
    const cy = A / 2;
    const g0 = cx + r + 40;
    const g1 = L - 16;
    geometria = { cx, cy, r, g0, g1 };
    const gx = (t: number): number => g0 + (t / DUAS_VOLTAS) * (g1 - g0);
    const t = ((theta % DUAS_VOLTAS) + DUAS_VOLTAS) % DUAS_VOLTAS;
    const [px, py] = [cx + r * Math.cos(t), cy - r * Math.sin(t)];
    ctx.save();
    // eixos do círculo e do gráfico
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - r - 16, cy);
    ctx.lineTo(g1, cy);
    ctx.moveTo(cx, cy - r - 16);
    ctx.lineTo(cx, cy + r + 16);
    ctx.moveTo(g0, cy - r - 10);
    ctx.lineTo(g0, cy + r + 10);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.beginPath();
    for (const y of [cy - r, cy + r]) {
      ctx.moveTo(g0, y);
      ctx.lineTo(g1, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, DUAS_VOLTAS);
    ctx.stroke();
    ctx.restore();
    for (const [rotulo, v] of [
      ['π/2', Math.PI / 2],
      ['π', Math.PI],
      ['3π/2', (3 * Math.PI) / 2],
      ['2π', DUAS_VOLTAS],
    ] as const) {
      plano.texto(rotulo, gx(v), cy + 16, 'rgba(203, 213, 225, 0.8)', 'center', 11);
    }
    plano.texto('1', g0 - 8, cy - r + 4, 'rgba(203, 213, 225, 0.8)', 'right', 11);
    plano.texto('−1', g0 - 8, cy + r + 4, 'rgba(203, 213, 225, 0.8)', 'right', 11);
    // a onda inteira, apagada, e o trecho já percorrido, aceso
    const onda = (ate: number, alfa: number, espessura: number): void => {
      ctx.save();
      ctx.globalAlpha = alfa;
      ctx.strokeStyle = cor.segunda;
      ctx.lineWidth = espessura;
      ctx.shadowColor = cor.segunda;
      ctx.shadowBlur = alfa > 0.5 ? 12 : 0;
      ctx.beginPath();
      for (let i = 0; i <= 240; i++) {
        const s = (ate * i) / 240;
        if (i === 0) ctx.moveTo(gx(s), cy - r * Math.sin(s));
        else ctx.lineTo(gx(s), cy - r * Math.sin(s));
      }
      ctx.stroke();
      ctx.restore();
    };
    onda(DUAS_VOLTAS, 0.22, 2);
    onda(t, 1, 2.8);
    // o ângulo
    ctx.save();
    ctx.strokeStyle = cor.amarelo;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.26, 0, -t, true);
    ctx.stroke();
    ctx.restore();
    plano.texto('θ', cx + r * 0.36 * Math.cos(t / 2), cy - r * 0.36 * Math.sin(t / 2) + 4, cor.amarelo, 'center', 13);
    // raio, cosseno e seno
    plano.segmentoPx(cx, cy, px, py, 'rgba(226, 232, 240, 0.85)', 1.6, false);
    plano.segmentoPx(cx, cy, px, cy, cor.f, 4, false);
    plano.segmentoPx(px, cy, px, py, cor.segunda, 4, false);
    plano.segmentoPx(px, py, gx(t), py, 'rgba(244, 114, 182, 0.75)', 1.4, true);
    plano.texto('cos θ', (cx + px) / 2, cy + (Math.sin(t) >= 0 ? 16 : -8), cor.f, 'center', 12);
    plano.texto('sen θ', px + (Math.cos(t) >= 0 ? 8 : -8), (cy + py) / 2 + 4, cor.segunda, Math.cos(t) >= 0 ? 'left' : 'right', 12);
    for (const [x, y, c] of [
      [px, py, '#ffffff'],
      [gx(t), py, cor.segunda],
    ] as const) {
      ctx.save();
      ctx.fillStyle = c;
      ctx.shadowColor = c;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, DUAS_VOLTAS);
      ctx.fill();
      ctx.restore();
    }
    plano.texto('P', px + (Math.cos(t) >= 0 ? 12 : -12), py - 8, '#ffffff', 'center', 13);
  }

  function ler(): void {
    const t = ((theta % DUAS_VOLTAS) + DUAS_VOLTAS) % DUAS_VOLTAS;
    if (graus === null) {
      leitura.textContent = `θ ≈ ${Math.round((t * 180) / Math.PI)}° · sen θ ≈ ${seis(Number(Math.sin(t).toFixed(3)))} · cos θ ≈ ${seis(Number(Math.cos(t).toFixed(3)))}`;
      return;
    }
    const v = valoresNotaveis(graus);
    const tg = v.tg === 'indefinida' ? 'não existe' : paraLer(v.tg);
    leitura.textContent = `θ = ${graus}° = ${paraLer(v.rad)} rad · sen θ = ${paraLer(v.sen)} · cos θ = ${paraLer(v.cos)} · tg θ = ${tg}`;
  }

  const atualizar = (): void => {
    marcar(angulos, 'data-graus', graus === null ? '' : String(graus));
    desenhar();
    ler();
  };

  const girar = tocador(
    achar<HTMLButtonElement>(raiz, '.lab-tocar'),
    { tocar: '▶ Girar', pausar: '⏸ Parar', denovo: '▶ Girar' },
    (() => {
      let anterior = 0;
      return (agora: number, inicio: number): boolean => {
        const dt = anterior && agora - anterior < 100 ? agora - anterior : agora === inicio ? 0 : 16;
        anterior = agora;
        theta += (dt / 7000) * DUAS_VOLTAS;
        graus = null;
        leitura.setAttribute('aria-live', 'off');
        atualizar();
        return true;
      };
    })(),
    () => {
      graus = 60;
      theta = Math.PI / 3;
      atualizar();
    },
    () => false,
  );

  angulos.addEventListener('click', (ev) => {
    const botao = (ev.target as Element).closest<HTMLElement>('[data-graus]');
    if (!botao) return;
    girar.parar();
    graus = Number(botao.dataset.graus);
    theta = (graus * Math.PI) / 180;
    leitura.setAttribute('aria-live', 'polite');
    atualizar();
  });
  const arrastar = (ev: PointerEvent): void => {
    if (ev.type === 'pointermove' && ev.buttons === 0 && ev.pointerType === 'mouse') return;
    const r = canvas.getBoundingClientRect();
    const { cx, cy, r: raio } = geometria;
    const [dx, dy] = [ev.clientX - r.left - cx, cy - (ev.clientY - r.top)];
    if (Math.hypot(dx, dy) > raio * 1.8) return;
    girar.parar();
    theta = (Math.atan2(dy, dx) + DUAS_VOLTAS) % DUAS_VOLTAS;
    graus = Math.round((theta * 180) / Math.PI) % 360;
    theta = (graus * Math.PI) / 180;
    leitura.setAttribute('aria-live', 'polite');
    atualizar();
  };
  canvas.addEventListener('pointerdown', arrastar);
  canvas.addEventListener('pointermove', arrastar);
  atualizar();
  return () => {
    girar.parar();
    plano.desmontar();
  };
}

// ─── Aula 2: chegando perto do ponto ───────────────────────────────────────────

const textoDoLimite = (v: ValorLimite | 'não existe' | undefined): string =>
  v === undefined ? '—' : typeof v === 'number' ? numeroParaLer(v) : v === '-∞' ? '−∞' : v === 'sem valor' ? 'não existe' : v;

function laboratorioDeLimites(raiz: HTMLElement, aoCalcular: AoCalcular): Desmontar {
  raiz.innerHTML = `
    <div class="lab-escolhas" role="group" aria-label="Caso">${chips(
      LAB_LIMITES.map((c) => c.rotulo),
      'data-caso',
    )}</div>
    <div class="lab-grade">
      <div class="lab-tela"><canvas role="img" aria-label="Gráfico com dois pontos chegando perto de x = a, um por cada lado"></canvas></div>
      <div class="lab-painel">
        <p class="lab-formula"></p>
        <label class="controle"><span class="controle-nome">Distância até ${formula('a')}: ${formula('h')} = <output data-campo="h"></output></span><input type="range" min="0" max="1000" step="1" value="0" aria-label="Distância h entre x e a" /></label>
        <div class="lab-linha"><button type="button" class="lab-tocar"></button></div>
        <div class="lab-lados">
          <div class="lab-lado esquerda"><strong>Pela esquerda</strong><span data-campo="esquerda"></span></div>
          <div class="lab-lado direita"><strong>Pela direita</strong><span data-campo="direita"></span></div>
        </div>
        <div class="lab-conclusao" aria-live="polite"></div>
        ${BOTAO_CALCULAR}
      </div>
    </div>`;
  const canvas = achar<HTMLCanvasElement>(raiz, 'canvas');
  const casos = achar<HTMLElement>(raiz, '.lab-escolhas');
  const controle = achar<HTMLInputElement>(raiz, 'input[type="range"]');
  const conclusao = achar<HTMLElement>(raiz, '.lab-conclusao');
  const campo = (nome: string): HTMLElement => achar<HTMLElement>(raiz, `[data-campo="${nome}"]`);
  let indice = 0;
  let s = 0;
  let funcao: FuncaoDoLimite = lerFuncaoDoLimite(LAB_LIMITES[0]!.f);
  let resultado: ResultadoLimite = calcularLimite(LAB_LIMITES[0]!.f, LAB_LIMITES[0]!.ponto);
  const plano = new Plano(canvas, LAB_LIMITES[0]!.janela, () => desenhar());
  const f = (t: number): number => avaliarFuncao(funcao, t);
  const h = (): number => LAB_LIMITES[indice]!.hMax * 10 ** ((-4 * s) / 1000);

  function escolher(i: number): void {
    indice = i;
    const caso = LAB_LIMITES[i]!;
    funcao = lerFuncaoDoLimite(caso.f);
    resultado = calcularLimite(caso.f, caso.ponto);
    plano.janela(caso.janela);
    marcar(casos, 'data-caso', String(i));
    const expressao = funcao.tipo === 'expressao' ? formulaHTML(funcao.e) : 'f(x)';
    achar<HTMLElement>(raiz, '.lab-formula').innerHTML = `<span class="formula">${notacao(`#lim{x → ${numeroParaLer(caso.a)}} `)}${expressao}</span>`;
    s = 0;
    animacao.parar();
    sincronizar();
  }

  function sincronizar(): void {
    controle.value = String(Math.round(s));
    const caso = LAB_LIMITES[indice]!;
    const d = h();
    campo('h').textContent = seis(d);
    const [xe, xd] = [caso.a - d, caso.a + d];
    campo('esquerda').innerHTML = `${formula('x = ')}${seis(xe)}<br>${formula('f(x) = ')}${seis(f(xe))}`;
    campo('direita').innerHTML = `${formula('x = ')}${seis(xd)}<br>${formula('f(x) = ')}${seis(f(xd))}`;
    const perto = s >= 750;
    conclusao.classList.toggle('revelada', perto);
    if (perto) {
      const r = resultado;
      const a = numeroParaLer(caso.a);
      const laterais = `${formula(`#lim{x → ${a}^-} f(x) = `)}${escapar(textoDoLimite(r.esquerda))} &nbsp; ${formula(`#lim{x → ${a}^+} f(x) = `)}${escapar(textoDoLimite(r.direita))}`;
      conclusao.innerHTML = `<p>${laterais}</p><p><strong>Limite: ${escapar(textoDoLimite(r.limite))}.</strong> ${escapar(r.interpretacao)}</p>`;
    } else {
      conclusao.textContent = 'Aproxime mais para ver a conclusão do motor.';
    }
    desenhar();
  }

  function desenhar(): void {
    if (!plano.limpar()) return;
    const caso = LAB_LIMITES[indice]!;
    const { cor } = plano;
    plano.grade();
    plano.vertical(caso.a, 'rgba(250, 204, 21, 0.7)');
    plano.texto(`x = ${numeroParaLer(caso.a)}`, plano.px(caso.a), plano.altura - 8, cor.amarelo);
    plano.curva(f, cor.f, 2.6, [caso.a]);
    const { esquerda, direita } = resultado;
    if (typeof esquerda === 'number') plano.buraco(caso.a, esquerda, cor.f);
    if (typeof direita === 'number' && direita !== esquerda) plano.buraco(caso.a, direita, cor.f);
    const d = h();
    for (const [x, c, borda] of [
      [caso.a - d, cor.segunda, 'esquerda'],
      [caso.a + d, cor.tangente, 'direita'],
    ] as const) {
      const y = f(x);
      if (!Number.isFinite(y)) continue;
      const [cx, cy] = [plano.px(x), plano.py(y)];
      const dentro = y >= plano.y0 && y <= plano.y1;
      if (dentro) {
        plano.segmentoPx(borda === 'esquerda' ? 0 : plano.largura, cy, cx, cy, c, 1.4, true);
        plano.ponto(x, y, c, 6.5);
        plano.texto(seis(y), borda === 'esquerda' ? 6 : plano.largura - 6, cy - 7, c, borda === 'esquerda' ? 'left' : 'right');
      } else {
        // fora da janela: uma seta na borda mostra para onde f foi
        plano.texto(y > plano.y1 ? '▲' : '▼', cx, y > plano.y1 ? 16 : plano.altura - 20, c, 'center', 16);
      }
    }
  }

  const animacao = tocador(
    achar<HTMLButtonElement>(raiz, '.lab-tocar'),
    { tocar: '▶ Aproximar', pausar: '⏸ Pausar', denovo: '↺ Recomeçar' },
    (() => {
      let inicioDoS = 0;
      let ultimoInicio = -1;
      return (agora: number, inicio: number): boolean => {
        if (inicio !== ultimoInicio) {
          ultimoInicio = inicio;
          if (s >= 1000) s = 0;
          inicioDoS = s;
        }
        const duracao = 400 + 3600 * (1 - inicioDoS / 1000);
        const p = Math.min(1, (agora - inicio) / duracao);
        s = inicioDoS + (1000 - inicioDoS) * suave(p);
        sincronizar();
        return p < 1;
      };
    })(),
    () => {
      s = 1000;
      sincronizar();
    },
    () => s >= 1000,
  );

  casos.addEventListener('click', (ev) => {
    const botao = (ev.target as Element).closest<HTMLElement>('[data-caso]');
    if (botao) escolher(Number(botao.dataset.caso));
  });
  controle.addEventListener('input', () => {
    animacao.parar();
    s = controle.valueAsNumber;
    sincronizar();
  });
  achar<HTMLButtonElement>(raiz, '[data-calcular]').addEventListener('click', () => {
    const caso = LAB_LIMITES[indice]!;
    aoCalcular({ modo: 'limite', f: caso.f, ponto: caso.ponto, resposta: '' });
  });
  escolher(0);
  return () => {
    animacao.parar();
    plano.desmontar();
  };
}

// ─── Aula 3: da secante à tangente ─────────────────────────────────────────────

function laboratorioDeDerivadas(raiz: HTMLElement, aoCalcular: AoCalcular): Desmontar {
  raiz.innerHTML = `
    <div class="lab-escolhas" role="group" aria-label="Função">${chips(
      LAB_DERIVADAS.map((c) => c.rotulo),
      'data-caso',
    )}</div>
    <div class="lab-grade">
      <div class="lab-tela"><canvas role="img" aria-label="Gráfico com a reta secante por P e Q e a reta tangente em P"></canvas></div>
      <div class="lab-painel">
        <p class="lab-formula"></p>
        <p class="lab-forma"></p>
        <label class="controle"><span class="controle-nome">Ponto ${formula('x_0')} = <output data-campo="x0"></output></span><input type="range" data-x0 aria-label="Ponto x0" /></label>
        <label class="controle"><span class="controle-nome">${formula('h')} = <output data-campo="h"></output></span><input type="range" min="0" max="1000" step="1" value="0" data-h aria-label="Distância h entre P e Q" /></label>
        <div class="lab-linha"><button type="button" class="lab-tocar"></button></div>
        <dl class="ficha lab-ficha">
          <div class="secante"><dt>Inclinação da secante</dt><dd data-campo="secante"></dd></div>
          <div class="tangente"><dt>${formula("f'(x_0)")}, a da tangente</dt><dd data-campo="tangente"></dd></div>
          <div><dt>Diferença</dt><dd data-campo="diferenca"></dd></div>
        </dl>
        ${BOTAO_CALCULAR}
      </div>
    </div>`;
  const canvas = achar<HTMLCanvasElement>(raiz, 'canvas');
  const casos = achar<HTMLElement>(raiz, '.lab-escolhas');
  const controleX0 = achar<HTMLInputElement>(raiz, '[data-x0]');
  const controleH = achar<HTMLInputElement>(raiz, '[data-h]');
  const campo = (nome: string): HTMLElement => achar<HTMLElement>(raiz, `[data-campo="${nome}"]`);
  let indice = 0;
  let s = 0;
  let x0 = LAB_DERIVADAS[0]!.x0;
  let f: (x: number) => number = () => Number.NaN;
  let derivadaEm: (x: number) => number = () => Number.NaN;
  const plano = new Plano(canvas, LAB_DERIVADAS[0]!.janela, () => desenhar());
  const h = (): number => passoDaSecante(LAB_DERIVADAS[indice]!, x0, s / 1000);

  function escolher(i: number): void {
    indice = i;
    const caso = LAB_DERIVADAS[i]!;
    const expr = lerExpressao(caso.f);
    const resultado = derivar(expr);
    f = (t) => avaliar(expr, { x: t });
    derivadaEm = (t) => avaliar(resultado.resultado, { x: t });
    x0 = caso.x0;
    s = 0;
    plano.janela(caso.janela);
    marcar(casos, 'data-caso', String(i));
    achar<HTMLElement>(raiz, '.lab-formula').innerHTML = `<span class="formula">${notacao('f(x) = ')}${formulaHTML(expr)}</span>`;
    achar<HTMLElement>(raiz, '.lab-forma').innerHTML = `Pelas regras, o motor dá <span class="formula">${notacao("f'(x) = ")}${formulaHTML(resultado.resultado)}</span>`;
    controleX0.min = String(caso.faixa[0]);
    controleX0.max = String(caso.faixa[1]);
    controleX0.step = '0.05';
    controleX0.value = String(x0);
    animacao.parar();
    sincronizar();
  }

  function sincronizar(): void {
    controleH.value = String(Math.round(s));
    const d = h();
    const [y0, y1] = [f(x0), f(x0 + d)];
    const secante = (y1 - y0) / d;
    const tangente = derivadaEm(x0);
    campo('x0').textContent = seis(Number(x0.toFixed(2)));
    campo('h').textContent = seis(d);
    campo('secante').textContent = seis(secante);
    campo('tangente').textContent = seis(tangente);
    campo('diferenca').textContent = seis(Math.abs(secante - tangente));
    desenhar();
  }

  function desenhar(): void {
    if (!plano.limpar()) return;
    const caso = LAB_DERIVADAS[indice]!;
    const { cor } = plano;
    const d = h();
    const [y0, y1] = [f(x0), f(x0 + d)];
    plano.grade(caso.pi === true);
    plano.curva(f, cor.f);
    plano.reta(x0, y0, derivadaEm(x0), cor.tangente, 2, true);
    plano.reta(x0, y0, (y1 - y0) / d, cor.segunda, 2.4);
    plano.segmento(x0, y0, x0 + d, y0, cor.amarelo, 1.5, true);
    plano.segmento(x0 + d, y0, x0 + d, y1, cor.amarelo, 1.5, true);
    const [pP, pQ] = [
      [plano.px(x0), plano.py(y0)],
      [plano.px(x0 + d), plano.py(y1)],
    ] as const;
    if (Math.abs(pQ[0] - pP[0]) > 26) plano.texto('h', (pP[0] + pQ[0]) / 2, pP[1] + ((y1 - y0) * d >= 0 ? 16 : -8), cor.amarelo);
    if (Math.abs(pQ[1] - pP[1]) > 22) plano.texto('Δy', pQ[0] + (d > 0 ? 8 : -8), (pP[1] + pQ[1]) / 2 + 4, cor.amarelo, d > 0 ? 'left' : 'right');
    plano.ponto(x0 + d, y1, cor.segunda, 5.5);
    plano.ponto(x0, y0, '#ffffff', 6);
    plano.texto('P', pP[0] - 10, pP[1] - 10, '#ffffff');
    if (Math.hypot(pQ[0] - pP[0], pQ[1] - pP[1]) > 18) plano.texto('Q', pQ[0] + 10, pQ[1] - 10, cor.segunda);
  }

  const animacao = tocador(
    achar<HTMLButtonElement>(raiz, '.lab-tocar'),
    { tocar: '▶ h → 0', pausar: '⏸ Pausar', denovo: '↺ Recomeçar' },
    (() => {
      let inicioDoS = 0;
      let ultimoInicio = -1;
      return (agora: number, inicio: number): boolean => {
        if (inicio !== ultimoInicio) {
          ultimoInicio = inicio;
          if (s >= 1000) s = 0;
          inicioDoS = s;
        }
        const duracao = 400 + 3600 * (1 - inicioDoS / 1000);
        const p = Math.min(1, (agora - inicio) / duracao);
        s = inicioDoS + (1000 - inicioDoS) * suave(p);
        sincronizar();
        return p < 1;
      };
    })(),
    () => {
      s = 1000;
      sincronizar();
    },
    () => s >= 1000,
  );

  casos.addEventListener('click', (ev) => {
    const botao = (ev.target as Element).closest<HTMLElement>('[data-caso]');
    if (botao) escolher(Number(botao.dataset.caso));
  });
  controleX0.addEventListener('input', () => {
    x0 = controleX0.valueAsNumber;
    sincronizar();
  });
  controleH.addEventListener('input', () => {
    animacao.parar();
    s = controleH.valueAsNumber;
    sincronizar();
  });
  achar<HTMLButtonElement>(raiz, '[data-calcular]').addEventListener('click', () => aoCalcular({ modo: 'derivada', f: LAB_DERIVADAS[indice]!.f, resposta: '' }));
  escolher(0);
  return () => {
    animacao.parar();
    plano.desmontar();
  };
}

// ─── Aula 4: retângulos que viram área ─────────────────────────────────────────

const REGRAS_DE_RIEMANN = [
  { nome: 'Esquerda', fracao: 0 },
  { nome: 'Ponto médio', fracao: 0.5 },
  { nome: 'Direita', fracao: 1 },
];

function laboratorioDeIntegrais(raiz: HTMLElement, aoCalcular: AoCalcular): Desmontar {
  raiz.innerHTML = `
    <div class="lab-escolhas" role="group" aria-label="Integral">${chips(
      LAB_INTEGRAIS.map((c) => c.rotulo),
      'data-caso',
    )}</div>
    <div class="lab-grade">
      <div class="lab-tela"><canvas role="img" aria-label="Gráfico com os retângulos da soma de Riemann debaixo da curva"></canvas></div>
      <div class="lab-painel">
        <p class="lab-formula"></p>
        <p class="lab-forma"></p>
        <label class="controle"><span class="controle-nome">Retângulos: ${formula('n')} = <output data-campo="n"></output></span><input type="range" min="1" max="128" step="1" value="1" aria-label="Número de retângulos" /></label>
        <div class="lab-escolhas lab-regras" role="group" aria-label="Altura de cada retângulo">${chips(
          REGRAS_DE_RIEMANN.map((r) => r.nome),
          'data-regra',
        )}</div>
        <div class="lab-linha"><button type="button" class="lab-tocar"></button></div>
        <dl class="ficha lab-ficha">
          <div><dt>Soma dos retângulos</dt><dd data-campo="soma"></dd></div>
          <div class="exata"><dt>Valor exato, pelo TFC</dt><dd data-campo="exato"></dd></div>
          <div><dt>Diferença</dt><dd data-campo="diferenca"></dd></div>
        </dl>
        ${BOTAO_CALCULAR}
      </div>
    </div>`;
  const canvas = achar<HTMLCanvasElement>(raiz, 'canvas');
  const casos = achar<HTMLElement>(raiz, '.lab-escolhas');
  const regras = achar<HTMLElement>(raiz, '.lab-regras');
  const controle = achar<HTMLInputElement>(raiz, 'input[type="range"]');
  const campo = (nome: string): HTMLElement => achar<HTMLElement>(raiz, `[data-campo="${nome}"]`);
  let indice = 0;
  let n = 1;
  let regra = 1;
  let a = 0;
  let b = 1;
  let exato = 0;
  let f: (x: number) => number = () => Number.NaN;
  const plano = new Plano(canvas, LAB_INTEGRAIS[0]!.janela, () => desenhar());

  const soma = (): number => {
    const largura = (b - a) / n;
    const fracao = REGRAS_DE_RIEMANN[regra]!.fracao;
    let total = 0;
    for (let i = 0; i < n; i++) total += f(a + (i + fracao) * largura) * largura;
    return total;
  };

  function escolher(i: number): void {
    indice = i;
    const caso = LAB_INTEGRAIS[i]!;
    const expr = lerExpressao(caso.f);
    f = (t) => avaliar(expr, { x: t });
    a = avaliar(lerExpressao(caso.a));
    b = avaliar(lerExpressao(caso.b));
    const r = integralDefinida(caso.f, caso.a, caso.b);
    exato = typeof r.valor === 'number' ? r.valor : Number.NaN;
    plano.janela(caso.janela);
    marcar(casos, 'data-caso', String(i));
    const limites = { a: formulaHTML(lerExpressao(caso.a)), b: formulaHTML(lerExpressao(caso.b)) };
    achar<HTMLElement>(raiz, '.lab-formula').innerHTML = `<span class="formula">${integralHTML(expr, 'x', limites)}</span>`;
    achar<HTMLElement>(raiz, '.lab-forma').innerHTML = `Primitiva pelo motor: <span class="formula">${notacao('F(x) = ')}${formulaHTML(r.primitiva.resultado)}</span>`;
    const textoExato = numeroParaLer(exato);
    campo('exato').textContent = /[/√π]/.test(textoExato) ? `${textoExato} ≈ ${seis(exato)}` : textoExato;
    n = 1;
    animacao.parar();
    sincronizar();
  }

  function sincronizar(): void {
    controle.value = String(n);
    campo('n').textContent = String(n);
    const s = soma();
    campo('soma').textContent = seis(s);
    campo('diferenca').textContent = seis(Math.abs(s - exato));
    marcar(regras, 'data-regra', String(regra));
    desenhar();
  }

  function desenhar(): void {
    if (!plano.limpar()) return;
    const caso = LAB_INTEGRAIS[indice]!;
    const { cor } = plano;
    plano.grade(caso.pi === true);
    const largura = (b - a) / n;
    const fracao = REGRAS_DE_RIEMANN[regra]!.fracao;
    for (let i = 0; i < n; i++) plano.retangulo(a + i * largura, a + (i + 1) * largura, f(a + (i + fracao) * largura));
    plano.curva(f, cor.f);
    for (const [v, nome] of [
      [a, 'a'],
      [b, 'b'],
    ] as const) {
      plano.vertical(v, 'rgba(250, 204, 21, 0.75)');
      plano.texto(`${nome} = ${numeroParaLer(v)}`, limitar(plano.px(v), 30, plano.largura - 30), 16, '#fde68a');
    }
  }

  const animacao = tocador(
    achar<HTMLButtonElement>(raiz, '.lab-tocar'),
    { tocar: '▶ Mais retângulos', pausar: '⏸ Pausar', denovo: '↺ Recomeçar' },
    (() => {
      let nInicial = 1;
      let ultimoInicio = -1;
      return (agora: number, inicio: number): boolean => {
        if (inicio !== ultimoInicio) {
          ultimoInicio = inicio;
          if (n >= 128) n = 1;
          nInicial = 2 ** Math.floor(Math.log2(n));
          sincronizar();
        }
        // pelo relógio, e não por quadro: a aba em segundo plano pula quadros, mas não dobras
        const proximo = Math.min(128, nInicial * 2 ** Math.floor((agora - inicio) / 650));
        if (proximo !== n && proximo > n) {
          n = proximo;
          sincronizar();
        }
        return n < 128;
      };
    })(),
    () => {
      n = 128;
      sincronizar();
    },
    () => n >= 128,
  );

  casos.addEventListener('click', (ev) => {
    const botao = (ev.target as Element).closest<HTMLElement>('[data-caso]');
    if (botao) escolher(Number(botao.dataset.caso));
  });
  regras.addEventListener('click', (ev) => {
    const botao = (ev.target as Element).closest<HTMLElement>('[data-regra]');
    if (!botao) return;
    regra = Number(botao.dataset.regra);
    sincronizar();
  });
  controle.addEventListener('input', () => {
    animacao.parar();
    n = controle.valueAsNumber;
    sincronizar();
  });
  achar<HTMLButtonElement>(raiz, '[data-calcular]').addEventListener('click', () => {
    const caso = LAB_INTEGRAIS[indice]!;
    aoCalcular({ modo: 'definida', f: caso.f, a: caso.a, b: caso.b, resposta: '' });
  });
  escolher(0);
  return () => {
    animacao.parar();
    plano.desmontar();
  };
}

// ─── A história: o carro chegando na lombada ───────────────────────────────────

/** Número para frase, com vírgula decimal: 28,8; 4; 3,6. */
const comVirgula = (v: number, casas = 1): string => String(Number(v.toFixed(casas))).replace('.', ',').replace('-', '−');
const emKmH = (ms: number): number => ms * 3.6;

function laboratorioDaLombada(raiz: HTMLElement, aoCalcular: AoCalcular): Desmontar {
  raiz.innerHTML = `
    <div class="lab-grade">
      <div class="lab-telas">
        <div class="lab-tela lab-estrada"><canvas role="img" aria-label="Estrada vista de lado, com o carro, o ponto em que o freio entra e a lombada 62 m à frente"></canvas></div>
        <div class="lab-tela lab-velocidade"><canvas role="img" aria-label="Velocidade do carro no tempo; a área debaixo dela é a distância andada, e a linha tracejada marca 30 km/h"></canvas></div>
      </div>
      <div class="lab-painel">
        <p class="lab-forma" data-campo="lei"></p>
        <label class="controle"><span class="controle-nome">Tempo de reação: <output data-campo="reacao"></output></span><input type="range" data-controle="reacao" min="0.5" max="2" step="0.1" value="${CARRO.reacao}" aria-label="Tempo de reação, em segundos" /></label>
        <label class="controle"><span class="controle-nome">Freada: <output data-campo="freada"></output></span><input type="range" data-controle="freada" min="2" max="7" step="0.5" value="${CARRO.freada}" aria-label="Freada: quantos m/s o carro perde a cada segundo" /></label>
        <div class="lab-linha"><button type="button" class="lab-tocar"></button></div>
        <dl class="ficha lab-ficha">
          <div><dt>Velocidade na lombada</dt><dd data-campo="chegada"></dd></div>
          <div><dt>Instante da chegada</dt><dd data-campo="instante"></dd></div>
          <div><dt>Reação + frenagem</dt><dd data-campo="distancias"></dd></div>
        </dl>
        <p class="lab-nota" data-campo="veredito" aria-live="polite"></p>
        ${BOTAO_CALCULAR}
      </div>
    </div>`;
  const campo = (nome: string): HTMLElement => achar<HTMLElement>(raiz, `[data-campo="${nome}"]`);
  const controleReacao = achar<HTMLInputElement>(raiz, '[data-controle="reacao"]');
  const controleFreada = achar<HTMLInputElement>(raiz, '[data-controle="freada"]');
  const limite = CARRO.limiteKmH / 3.6;
  let chegada = chegadaNaLombada(CARRO.reacao, CARRO.freada);
  /** O instante desenhado: 0 até o ▶, e o carro anda até a chegada. */
  let agora = 0;
  const estrada = new Plano(achar<HTMLCanvasElement>(raiz, '.lab-estrada canvas'), [-6, 70, -1, 3], () => desenharEstrada());
  const grafico = new Plano(achar<HTMLCanvasElement>(raiz, '.lab-velocidade canvas'), [-0.4, 5, -2.5, 25], () => desenharGrafico());

  function desenharEstrada(): void {
    if (!estrada.limpar()) return;
    const { ctx, cor } = estrada;
    const chao = estrada.py(0);
    estrada.segmentoPx(0, chao, estrada.largura, chao, 'rgba(226, 232, 240, 0.55)', 2, false);
    // a lombada começa nos 62 m; o rótulo dela cabe inteiro na tela, e as marcas que encostariam nele ficam sem número
    const [ini, fim] = [estrada.px(CARRO.distancia), estrada.px(CARRO.distancia + 3.7)];
    const rotulo = 'lombada · 62 m';
    ctx.save();
    ctx.font = `700 11px ${FONTE}`;
    const meia = ctx.measureText(rotulo).width / 2;
    ctx.restore();
    const centro = Math.min((ini + fim) / 2, estrada.largura - 4 - meia);
    const passo = estrada.largura < 520 ? 20 : 10;
    for (let d = 0; d <= 60; d += 10) {
      const x = estrada.px(d);
      estrada.segmentoPx(x, chao, x, chao + 5, 'rgba(203, 213, 225, 0.6)', 1, false);
      if (d % passo === 0 && x + 18 < centro - meia) estrada.texto(`${d} m`, x, chao + 16, 'rgba(203, 213, 225, 0.75)', 'center', 10);
    }
    ctx.save();
    ctx.fillStyle = cor.amarelo;
    ctx.beginPath();
    ctx.moveTo(ini, chao);
    ctx.quadraticCurveTo((ini + fim) / 2, chao - 22, fim, chao);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    estrada.texto(rotulo, centro, chao + 16, '#fde68a', 'center', 11);
    // onde o freio entra
    const freia = estrada.px(chegada.reacaoM);
    estrada.segmentoPx(freia, chao - 50, freia, chao, cor.segunda, 1.4, true);
    estrada.texto('freia', freia + 4, chao - 52, cor.segunda, 'left', 11);
    // o carro, com a frente na posição s(t)
    const frente = estrada.px(posicaoNoInstante(chegada, agora));
    ctx.save();
    ctx.fillStyle = cor.f;
    ctx.fillRect(frente - 40, chao - 24, 40, 14);
    ctx.fillRect(frente - 31, chao - 34, 20, 11);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    for (const roda of [frente - 31, frente - 9]) {
      ctx.beginPath();
      ctx.arc(roda, chao - 7, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    estrada.texto(`${comVirgula(emKmH(velocidadeNoInstante(chegada, agora)))} km/h`, frente - 20, chao - 42, '#e2e8f0', 'center', 11);
  }

  function desenharGrafico(): void {
    if (!grafico.limpar()) return;
    const { ctx, cor } = grafico;
    grafico.grade();
    // a área debaixo da velocidade, de 0 até o instante desenhado: a distância andada até ali
    const ate = Math.min(agora, chegada.tempo);
    ctx.save();
    ctx.fillStyle = cor.positiva;
    ctx.beginPath();
    ctx.moveTo(grafico.px(0), grafico.py(0));
    for (let i = 0; i <= 160; i++) {
      const t = (ate * i) / 160;
      ctx.lineTo(grafico.px(t), grafico.py(velocidadeNoInstante(chegada, t)));
    }
    ctx.lineTo(grafico.px(ate), grafico.py(0));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    grafico.curva((t) => (t >= 0 && t <= chegada.tempo ? velocidadeNoInstante(chegada, t) : Number.NaN), cor.f);
    grafico.segmento(0, limite, grafico.x1, limite, cor.erro, 1.4, true);
    grafico.texto('30 km/h', grafico.largura - 8, grafico.py(limite) - 7, cor.erro, 'right', 11);
    grafico.segmento(chegada.reacao, 0, chegada.reacao, CARRO.velocidade, cor.segunda, 1.2, true);
    const passou = !chegada.parou && chegada.velocidade <= limite + 1e-9;
    grafico.ponto(chegada.tempo, chegada.velocidade, chegada.parou ? cor.amarelo : passou ? cor.tangente : cor.erro);
    if (agora > 0 && agora < chegada.tempo) grafico.ponto(agora, velocidadeNoInstante(chegada, agora), '#e2e8f0', 4);
    grafico.texto('v (m/s)', grafico.colunaY + 30, 14, 'rgba(203, 213, 225, 0.85)', 'left', 11);
    grafico.texto('t (s)', grafico.largura - 8, grafico.linhaX - 8, 'rgba(203, 213, 225, 0.85)', 'right', 11);
  }

  const desenhar = (): void => {
    desenharEstrada();
    desenharGrafico();
  };

  function atualizar(): void {
    const [reacao, freada] = [controleReacao.valueAsNumber, controleFreada.valueAsNumber];
    chegada = chegadaNaLombada(reacao, freada);
    agora = 0;
    grafico.janela([-0.4, Math.max(5, Math.ceil(chegada.tempo) + 0.5), -2.5, 25]);
    campo('reacao').textContent = `${comVirgula(reacao)} s`;
    campo('freada').textContent = `${comVirgula(freada)} m/s²`;
    campo('lei').innerHTML = `Depois do freio: ${formula(`v(t) = 20 - ${comVirgula(freada)}(t - ${comVirgula(reacao)})`)}`;
    const kmh = emKmH(chegada.velocidade);
    campo('chegada').textContent = chegada.parou ? 'não chega: parou antes' : `${comVirgula(kmh)} km/h (${comVirgula(chegada.velocidade)} m/s)`;
    campo('instante').textContent = `${chegada.parou ? 'para em ' : ''}t = ${comVirgula(chegada.tempo)} s`;
    campo('distancias').textContent = `${comVirgula(chegada.reacaoM)} m + ${comVirgula(chegada.frenagemM)} m`;
    const nota = campo('veredito');
    nota.classList.remove('ok', 'erro');
    if (chegada.parou) {
      const antes = CARRO.distancia - chegada.reacaoM - chegada.frenagemM;
      nota.textContent =
        antes < 0.05
          ? 'Parou bem em cima da lombada: freou mais do que precisava para passar a 30 km/h.'
          : `Freou forte demais: parou ${comVirgula(antes)} m antes da lombada.`;
    } else if (kmh <= CARRO.limiteKmH + 1e-9) {
      nota.textContent = `Passa a ${comVirgula(kmh)} km/h, dentro dos 30 km/h da lombada.`;
      nota.classList.add('ok');
    } else {
      nota.textContent = `Chega a ${comVirgula(kmh)} km/h: rápido demais para a lombada.`;
      nota.classList.add('erro');
    }
    animacao.parar();
    desenhar();
  }

  const animacao = tocador(
    achar<HTMLButtonElement>(raiz, '.lab-tocar'),
    { tocar: '▶ Ver o carro andar', pausar: '⏸ Pausar', denovo: '↺ De novo' },
    (() => {
      let ultimoInicio = -1;
      let base = 0;
      return (relogio: number, inicio: number): boolean => {
        if (inicio !== ultimoInicio) {
          ultimoInicio = inicio;
          if (agora >= chegada.tempo) agora = 0;
          base = agora;
        }
        // em tempo real, pelo relógio: 4 s de movimento levam 4 s na tela
        agora = Math.min(chegada.tempo, base + (relogio - inicio) / 1000);
        desenhar();
        return agora < chegada.tempo;
      };
    })(),
    () => {
      agora = chegada.tempo;
      desenhar();
    },
    () => agora >= chegada.tempo,
  );

  for (const controle of [controleReacao, controleFreada]) controle.addEventListener('input', atualizar);
  achar<HTMLButtonElement>(raiz, '[data-calcular]').addEventListener('click', () => aoCalcular(contaDaFrenagem(chegada)));
  atualizar();
  return () => {
    animacao.parar();
    estrada.desmontar();
    grafico.desmontar();
  };
}

/** Monta o laboratório pedido em `raiz` (data-lab no HTML da aula). */
export function montarLaboratorio(tipo: string | undefined, raiz: HTMLElement, aoCalcular: AoCalcular): Desmontar {
  try {
    switch (tipo) {
      case 'funcoes':
        return laboratorioDeFuncoes(raiz, aoCalcular);
      case 'circulo':
        return laboratorioDoCirculo(raiz);
      case 'limites':
        return laboratorioDeLimites(raiz, aoCalcular);
      case 'derivadas':
        return laboratorioDeDerivadas(raiz, aoCalcular);
      case 'integrais':
        return laboratorioDeIntegrais(raiz, aoCalcular);
      case 'lombada':
        return laboratorioDaLombada(raiz, aoCalcular);
      default:
        return () => undefined;
    }
  } catch (erro) {
    console.error(erro);
    raiz.innerHTML = '<p class="lab-nota erro">Este laboratório não abriu neste navegador. O resto da aula continua valendo.</p>';
    return () => undefined;
  }
}
