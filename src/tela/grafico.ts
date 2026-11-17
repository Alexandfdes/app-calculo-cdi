/**
 * Gráfico animado da tela, em canvas e sem biblioteca. A curva se desenha sozinha; no estudo
 * de uma função, o domínio se acende no eixo x, a imagem no eixo y, os pontos notáveis
 * aparecem e um ponto leva cada entrada até a sua saída; na derivada, a reta tangente percorre
 * a curva e o ponto de f′ mostra que a altura de f′ é a inclinação; na integral, a área se
 * acumula até o ponto ("integrar é acumular"); na integral definida, os retângulos de Riemann
 * se multiplicam até virar a área exata.
 * Com "reduzir movimento" ligado no sistema, tudo aparece pronto, sem animação.
 */

export type Funcao = (x: number) => number;

/** Um limite lateral como o gráfico precisa: número, infinito, oscilação ou sem valor. */
export type ValorNoGrafico = number | '+∞' | '-∞' | 'oscila' | 'sem valor';

/** Intervalo da reta, como o motor de funções descreve domínio e imagem. */
export interface Faixa {
  de: number;
  ate: number;
  fechadoDe: boolean;
  fechadoAte: boolean;
}

export interface PontoDoGrafico {
  x: number;
  y: number;
  /** raiz, vértice, máximo, mínimo ou corte no eixo y: decide a cor. */
  nome: string;
  /** Texto da etiqueta; vazio, o ponto aparece sem etiqueta. */
  rotulo: string;
}

/** O que a Aula 1 pede para enxergar no gráfico de uma função. */
export interface Estudo {
  janela: [number, number];
  dominio: Faixa[];
  /** Pontos tirados do domínio dentro da janela (os da tangente). */
  furos: number[];
  imagem: Faixa[];
  pontos: PontoDoGrafico[];
  verticais: number[];
  horizontal: number | null;
  /** Setas no meio de cada trecho: para cima onde f cresce, para baixo onde decresce. */
  setas?: { x: number; sobe: boolean }[];
}

export type Cena =
  | {
      tipo: 'limite';
      f: Funcao;
      /** O ponto; ±Infinity para limite no infinito. */
      a: number;
      /** Limites laterais; no infinito, os dois são o próprio limite. */
      esquerda: ValorNoGrafico;
      direita: ValorNoGrafico;
      valorEmA: number | null;
      /** Onde a função por partes troca de fórmula: a curva é cortada aí. */
      corte: number | null;
      /** Como mostrar o ponto, por exemplo "π/2". */
      rotuloPonto: string;
      trigonometrica: boolean;
    }
  | { tipo: 'funcao'; f: Funcao; trigonometrica: boolean; estudo?: Estudo }
  | { tipo: 'derivada'; f: Funcao; derivada: Funcao; trigonometrica: boolean }
  | { tipo: 'integral'; f: Funcao; primitiva: Funcao; trigonometrica: boolean }
  | {
      tipo: 'definida';
      f: Funcao;
      a: number;
      b: number;
      /** Como mostrar a e b nos rótulos, por exemplo "π". */
      rotulos: [string, string];
      diverge: boolean;
      singularidades: number[];
      trigonometrica: boolean;
    };

export interface Ouvintes {
  /** O que o ponto móvel está mostrando, em texto. */
  aoLer?: (texto: string) => void;
  /** Onde está o ponto móvel (o x), a cada quadro em que ele é desenhado. */
  aoMover?: (x: number) => void;
  /** Integral definida: a soma de Riemann com n retângulos. */
  aoSomar?: (n: number, soma: number) => void;
  /** Integral definida: a animação chegou à área exata (ou à divergência). */
  aoTerminar?: () => void;
}

interface Vista {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const DURACAO = { grade: 350, pausa: 150, curva: 1000, retangulos: 650, area: 800 };
const RETANGULOS = [1, 2, 4, 8, 16, 32, 64, 128];
const FONTE = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Número curto para rótulos: 1.234, −0.5, 1.20e+5, ∞. */
export function curto(v: number): string {
  if (Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  const modulo = Math.abs(v);
  const texto = modulo !== 0 && (modulo >= 1e5 || modulo < 1e-3) ? v.toExponential(2) : String(Number(v.toFixed(modulo >= 100 ? 1 : 3)));
  return texto.replace(/-/g, '−');
}

const limitar = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const suavizar = (p: number): number => 1 - (1 - p) ** 3;
const progresso = (t: number, inicio: number, duracao: number): number => suavizar(limitar((t - inicio) / duracao, 0, 1));

export class Grafico {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly cores: Record<'f' | 'segunda' | 'tangente' | 'positiva' | 'negativa' | 'erro' | 'dominio' | 'imagem', string>;
  private cena: Cena | null = null;
  private vista: Vista = { x0: -5, x1: 5, y0: -5, y1: 5 };
  private inicio = 0;
  private quadro = 0;
  private largura = 0;
  private altura = 0;
  private ponteiro: number | null = null;
  private ultimoMovimento = Number.NEGATIVE_INFINITY;
  private xAtual: number | null = null;
  private partida = 0;
  private trecho: [number, number] = [-5, 5];
  private acumulada: Funcao = () => Number.NaN;
  private ultimoN = 0;
  private terminou = false;
  private ultimaLeitura = '';
  /** Entrada escolhida fora do gráfico (a conta "f(3) = …"): o ponto móvel para nela. */
  private fixo: number | null = null;
  private readonly cacheCurvas = new Map<Funcao, { x0: number; x1: number; y0: number; y1: number; n: number; pontos: [number, number | null][]; saltos: Set<number> }>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly ouvintes: Ouvintes = {},
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Este navegador não desenha em canvas 2D.');
    this.ctx = ctx;
    const css = getComputedStyle(document.documentElement);
    const cor = (nome: string, reserva: string): string => css.getPropertyValue(nome).trim() || reserva;
    this.cores = {
      f: cor('--cor-f', '#38bdf8'),
      segunda: cor('--cor-segunda', '#f472b6'),
      tangente: cor('--cor-tangente', '#a3e635'),
      positiva: cor('--area-positiva', 'rgba(56, 189, 248, 0.28)'),
      negativa: cor('--area-negativa', 'rgba(251, 113, 133, 0.30)'),
      erro: cor('--erro', '#fb7185'),
      dominio: cor('--cor-dominio', '#34d399'),
      imagem: cor('--cor-imagem', '#c084fc'),
    };
    new ResizeObserver(() => this.redimensionar()).observe(canvas);
    const mover = (ev: PointerEvent): void => {
      const r = canvas.getBoundingClientRect();
      this.ponteiro = this.vista.x0 + ((ev.clientX - r.left) / r.width) * (this.vista.x1 - this.vista.x0);
      this.ultimoMovimento = performance.now();
      if (this.calmo) this.pedirQuadro();
    };
    canvas.addEventListener('pointermove', mover);
    canvas.addEventListener('pointerdown', mover);
    canvas.addEventListener('pointerleave', () => {
      this.ponteiro = null;
    });
    this.redimensionar();
  }

  mostrar(cena: Cena): void {
    this.cena = cena;
    this.inicio = performance.now();
    this.ponteiro = null;
    this.xAtual = null;
    this.ultimoN = 0;
    this.terminou = false;
    this.ultimaLeitura = '';
    this.fixo = null;
    const [x0, x1]: [number, number] =
      cena.tipo === 'definida'
        ? comMargem(cena.a, cena.b)
        : cena.tipo === 'limite'
          ? janelaDoLimite(cena)
          : cena.tipo === 'funcao' && cena.estudo
            ? cena.estudo.janela
            : cena.trigonometrica
              ? [-2 * Math.PI, 2 * Math.PI]
              : [-4, 4];
    const curvas: Funcao[] = [cena.f];
    if (cena.tipo === 'funcao' && cena.estudo) {
      // os pontos notáveis e a assíntota horizontal também precisam caber
      const faixa = faixaVertical(curvas, x0, x1);
      const altura = faixa.y1 - faixa.y0;
      const { pontos, horizontal } = cena.estudo;
      const extras = [...pontos.filter((p) => p.x >= x0 && p.x <= x1).map((p) => p.y), ...(horizontal === null ? [] : [horizontal])];
      this.vista = {
        x0,
        x1,
        y0: Math.min(faixa.y0, ...extras.map((v) => v - altura * 0.12)),
        y1: Math.max(faixa.y1, ...extras.map((v) => v + altura * 0.2)),
      };
      this.pedirQuadro();
      return;
    }
    if (cena.tipo === 'limite') {
      const faixa = faixaVertical(curvas, x0, x1);
      const extras = [cena.esquerda, cena.direita, cena.valorEmA].filter((v): v is number => typeof v === 'number');
      const altura = faixa.y1 - faixa.y0;
      this.vista = {
        x0,
        x1,
        y0: Math.min(faixa.y0, ...extras.map((v) => v - altura * 0.12)),
        y1: Math.max(faixa.y1, ...extras.map((v) => v + altura * 0.2)),
      };
      this.pedirQuadro();
      return;
    }
    if (cena.tipo === 'derivada') curvas.push(cena.derivada);
    if (cena.tipo === 'integral') {
      const { partida, trecho } = acharPartida(cena.f, x0, x1);
      const base = cena.primitiva(partida);
      this.partida = partida;
      this.trecho = trecho;
      this.acumulada = (x) => (x < trecho[0] || x > trecho[1] ? Number.NaN : cena.primitiva(x) - base);
      curvas.push(this.acumulada);
    }
    let faixa = faixaVertical(curvas, x0, x1);
    if (cena.tipo === 'derivada') {
      // se f′ for bem mais alta que f (tg e sec²), a janela segue f, para f não sumir achatada
      const soF = faixaVertical([curvas[0]!], x0, x1);
      if (faixa.y1 - faixa.y0 > 3 * (soF.y1 - soF.y0)) faixa = soF;
    }
    this.vista = { x0, x1, ...faixa };
    this.pedirQuadro();
  }

  /** Para o ponto móvel numa entrada (a conta digitada na tela); null o solta de novo. */
  destacar(x: number | null): void {
    this.fixo = x;
    this.ultimoMovimento = Number.NEGATIVE_INFINITY;
    this.pedirQuadro();
  }

  // ─── Quadro a quadro ─────────────────────────────────────────────────────────

  private pedirQuadro(): void {
    cancelAnimationFrame(this.quadro);
    this.quadro = requestAnimationFrame((agora) => this.desenhar(agora));
  }

  private redimensionar(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.largura = r.width;
    this.altura = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.pedirQuadro();
  }

  private desenhar(agora: number): void {
    const { ctx, cena } = this;
    ctx.clearRect(0, 0, this.largura, this.altura);
    if (!cena || this.largura === 0 || this.altura === 0) return;
    const t = this.calmo ? Number.POSITIVE_INFINITY : agora - this.inicio;
    const fimCurva = DURACAO.pausa + DURACAO.curva;
    const pCurva = progresso(t, DURACAO.pausa, DURACAO.curva);
    const pSegunda = progresso(t, fimCurva, DURACAO.curva);
    const pInteracao = progresso(t, fimCurva + DURACAO.curva, 450);
    this.grade(progresso(t, 0, DURACAO.grade), cena.trigonometrica);
    let continuar = t < fimCurva;

    switch (cena.tipo) {
      case 'funcao':
        if (cena.estudo) continuar = this.estudo(cena.f, cena.estudo, t, pCurva);
        else this.curva(cena.f, this.cores.f, pCurva);
        break;
      case 'derivada': {
        this.curva(cena.f, this.cores.f, pCurva);
        this.curva(cena.derivada, this.cores.segunda, pSegunda);
        if (pInteracao > 0) this.tangente(cena, this.posicao(t, [this.vista.x0, this.vista.x1]), pInteracao);
        continuar = true;
        break;
      }
      case 'integral': {
        const x = this.posicao(t, this.trecho);
        if (pInteracao > 0) this.area(cena.f, Math.min(this.partida, x), Math.max(this.partida, x), pInteracao);
        this.curva(cena.f, this.cores.f, pCurva);
        this.curva(this.acumulada, this.cores.segunda, pSegunda);
        if (pInteracao > 0) this.acumulo(cena, x, pInteracao);
        continuar = true;
        break;
      }
      case 'definida':
        continuar = this.definida(cena, t);
        break;
      case 'limite':
        this.curva(cena.f, this.cores.f, pCurva, 2.6, [cena.a, cena.corte ?? Number.NaN].filter(Number.isFinite));
        if (pCurva >= 1) {
          if (Number.isFinite(cena.a)) this.aproximarDoPonto(cena, t, progresso(t, fimCurva, 400));
          else this.aproximarDoInfinito(cena, t, progresso(t, fimCurva, 400));
        }
        continuar = true;
        break;
    }
    if (continuar && !this.calmo) this.quadro = requestAnimationFrame((proximo) => this.desenhar(proximo));
  }

  /** Onde está o ponto móvel: segue o ponteiro; parado, passeia sozinho pela curva. */
  private posicao(t: number, [lo, hi]: [number, number]): number {
    const meio = (lo + hi) / 2;
    const amplitude = (hi - lo) * 0.42;
    const ponteiro = this.ponteiro;
    let alvo: number;
    if (ponteiro !== null && performance.now() - this.ultimoMovimento < 2500) alvo = limitar(ponteiro, lo, hi);
    else if (this.fixo !== null) alvo = limitar(this.fixo, lo, hi);
    else if (this.calmo) alvo = meio + amplitude * 0.45;
    else alvo = meio + amplitude * Math.sin(t / 1900);
    this.xAtual = this.xAtual === null || this.calmo ? alvo : this.xAtual + (alvo - this.xAtual) * 0.14;
    this.ouvintes.aoMover?.(this.xAtual);
    return this.xAtual;
  }

  // ─── Cenas ───────────────────────────────────────────────────────────────────

  /**
   * Estudo de uma função (Aula 1): a curva se desenha, o domínio se acende no eixo x e a
   * imagem no eixo y (as "sombras" da curva em cada eixo), os pontos notáveis aparecem um a um
   * e, por fim, um ponto leva cada entrada x até a sua saída f(x).
   */
  private estudo(f: Funcao, e: Estudo, t: number, pCurva: number): boolean {
    const fimCurva = DURACAO.pausa + DURACAO.curva;
    const pAssintotas = progresso(t, fimCurva, 500);
    if (pAssintotas > 0) this.assintotas(e, pAssintotas);
    this.curva(f, this.cores.f, pCurva, 2.6, e.furos);
    const pDominio = progresso(t, fimCurva, 700);
    const pImagem = progresso(t, fimCurva + 350, 700);
    if (pDominio > 0) this.faixaNoEixo('x', e.dominio, e.furos, pDominio);
    if (pImagem > 0) this.faixaNoEixo('y', e.imagem, [], pImagem);
    const inicioPontos = fimCurva + 800;
    e.pontos.forEach((p, i) => {
      const pPonto = progresso(t, inicioPontos + i * 170, 420);
      if (pPonto > 0) this.pontoNotavel(p, pPonto);
    });
    const pEntrada = progresso(t, inicioPontos + e.pontos.length * 170 + 300, 450);
    if (pEntrada > 0) this.entradaESaida(f, e, this.posicao(t, [this.vista.x0, this.vista.x1]), pEntrada);
    const pSetas = progresso(t, inicioPontos + e.pontos.length * 170 + 650, 500);
    if (pSetas > 0 && e.setas) this.setasDeCrescimento(f, e.setas, pSetas);
    return true;
  }

  /** Uma seta sobre a curva no meio de cada trecho: ↗ onde f cresce, ↘ onde decresce. */
  private setasDeCrescimento(f: Funcao, setas: { x: number; sobe: boolean }[], alfa: number): void {
    const { ctx } = this;
    const { x0, x1, y0, y1 } = this.vista;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.font = `700 15px ${FONTE}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(7, 11, 24, 0.9)';
    for (const s of setas) {
      if (s.x < x0 || s.x > x1) continue;
      const y = f(s.x);
      if (!Number.isFinite(y) || y < y0 || y > y1) continue;
      const simbolo = s.sobe ? '\u2197' : '\u2198';
      ctx.fillStyle = s.sobe ? '#4ade80' : '#fb7185';
      const [cx, cy] = [this.px(s.x), this.py(y) - 14];
      ctx.strokeText(simbolo, cx, cy);
      ctx.fillText(simbolo, cx, cy);
    }
    ctx.restore();
  }

  /** Assíntotas tracejadas, com a equação de cada uma. */
  private assintotas(e: Estudo, alfa: number): void {
    const { ctx } = this;
    const { x0, x1, y0, y1 } = this.vista;
    ctx.save();
    ctx.globalAlpha = alfa * 0.85;
    ctx.strokeStyle = this.cores.erro;
    ctx.fillStyle = this.cores.erro;
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.font = `600 12px ${FONTE}`;
    const verticais = e.verticais.filter((v) => v > x0 && v < x1);
    for (const v of verticais) {
      ctx.beginPath();
      ctx.moveTo(this.px(v), 0);
      ctx.lineTo(this.px(v), this.altura);
      ctx.stroke();
    }
    if (verticais.length === 1) {
      ctx.textAlign = 'left';
      ctx.fillText(`x = ${curto(verticais[0]!)}`, limitar(this.px(verticais[0]!) + 6, 4, this.largura - 60), 18);
    }
    if (e.horizontal !== null && e.horizontal > y0 && e.horizontal < y1) {
      const y = this.py(e.horizontal);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.largura, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(`y = ${curto(e.horizontal)}`, this.largura - 8, y - 8);
    }
    ctx.restore();
  }

  /**
   * O domínio aceso no eixo x (da esquerda para a direita) ou a imagem no eixo y (de baixo
   * para cima): faixas grossas, bolinha cheia nas pontas que entram e vazia nas que não entram.
   */
  private faixaNoEixo(eixo: 'x' | 'y', faixas: Faixa[], furos: number[], p: number): void {
    const { ctx } = this;
    const { x0, x1, y0, y1 } = this.vista;
    const cor = eixo === 'x' ? this.cores.dominio : this.cores.imagem;
    // no eixo de verdade quando ele aparece; senão, na borda do gráfico
    const linha = eixo === 'x' ? limitar(this.py(0), 6, this.altura - 6) : limitar(this.px(0), 6, this.largura - 6);
    const [lo, hi] = eixo === 'x' ? [x0, x1] : [y0, y1];
    const ate = lo + (hi - lo) * p;
    const ponto = (v: number): [number, number] => (eixo === 'x' ? [this.px(v), linha] : [linha, this.py(v)]);
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 7;
    ctx.shadowColor = cor;
    ctx.shadowBlur = 14;
    for (const f of faixas) {
      const [a, b] = [Math.max(f.de, lo), Math.min(f.ate, ate)];
      if (b <= a) continue;
      ctx.beginPath();
      ctx.moveTo(...ponto(a));
      ctx.lineTo(...ponto(b));
      ctx.stroke();
    }
    ctx.restore();
    for (const f of faixas) {
      for (const [v, fechada] of [
        [f.de, f.fechadoDe],
        [f.ate, f.fechadoAte],
      ] as const) {
        if (Number.isFinite(v) && v >= lo && v <= ate) this.bolinha(...ponto(v), cor, fechada);
      }
    }
    for (const v of furos) if (v >= lo && v <= ate) this.bolinha(...ponto(v), cor, false);
  }

  private corDoPonto(nome: string): string {
    if (nome === 'raiz') return this.cores.segunda;
    if (nome === 'corte no eixo y') return this.cores.tangente;
    return '#facc15';
  }

  /** Um ponto notável que surge crescendo além do tamanho e volta, com a etiqueta. */
  private pontoNotavel(p: PontoDoGrafico, prog: number): void {
    const { x0, x1, y0, y1 } = this.vista;
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) return;
    const { ctx } = this;
    const cor = this.corDoPonto(p.nome);
    const raio = 6 * (1 + 0.7 * Math.sin(Math.PI * Math.min(1, prog)) * (1 - prog * 0.3));
    const [cx, cy] = [this.px(p.x), this.py(p.y)];
    ctx.save();
    ctx.globalAlpha = Math.min(1, prog * 1.6);
    ctx.fillStyle = cor;
    ctx.shadowColor = cor;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b1020';
    ctx.beginPath();
    ctx.arc(cx, cy, raio * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (p.rotulo && prog > 0.4) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (prog - 0.4) * 2.5);
      this.etiqueta(p.rotulo, p.x, p.y, cor);
      ctx.restore();
    }
  }

  /** A máquina da função: a entrada x sobe do eixo x até a curva e sai no eixo y como f(x). */
  private entradaESaida(f: Funcao, e: Estudo, x: number, alfa: number): void {
    const { ctx } = this;
    const y = f(x);
    const noEixoX = limitar(this.py(0), 6, this.altura - 6);
    const noEixoY = limitar(this.px(0), 6, this.largura - 6);
    const cx = this.px(x);
    ctx.save();
    ctx.globalAlpha = alfa;
    if (!Number.isFinite(y)) {
      this.tracejadoPx(cx, 0, cx, this.altura, this.cores.erro);
      this.bolinha(cx, noEixoX, this.cores.erro, false);
      ctx.restore();
      this.ler(`entrada x = ${curto(x)}: fora do domínio, então f(x) não existe`);
      return;
    }
    const cy = this.py(y);
    this.tracejadoPx(cx, noEixoX, cx, cy, this.cores.dominio);
    this.tracejadoPx(cx, cy, noEixoY, cy, this.cores.imagem);
    this.bolinha(cx, noEixoX, this.cores.dominio, true);
    this.bolinha(noEixoY, cy, this.cores.imagem, true);
    this.ponto(x, y, this.cores.f);
    this.etiqueta(`f(${curto(x)}) = ${curto(y)}`, x, y, this.cores.f);
    ctx.restore();
    const furo = e.furos.some((v) => Math.abs(v - x) < 1e-9);
    this.ler(furo ? `entrada x = ${curto(x)}: fora do domínio` : `entrada x = ${curto(x)}   →   saída f(x) = ${curto(y)}`);
  }

  private tangente(cena: Extract<Cena, { tipo: 'derivada' }>, x: number, alfa: number): void {
    const y = cena.f(x);
    const m = cena.derivada(x);
    if (!Number.isFinite(y) || !Number.isFinite(m)) {
      this.ler(`Em x = ${curto(x)}, f ou f′ não existe.`);
      return;
    }
    const { ctx } = this;
    const { x0, x1 } = this.vista;
    ctx.save();
    ctx.globalAlpha = alfa;
    this.segmento(x0, y + m * (x0 - x), x1, y + m * (x1 - x), this.cores.tangente, 2.4);
    this.tracejado(x, y, x, m, this.cores.segunda);
    this.ponto(x, m, this.cores.segunda);
    this.ponto(x, y, this.cores.tangente);
    this.etiqueta(`inclinação ${curto(m)}`, x, y, this.cores.tangente);
    ctx.restore();
    this.ler(`x = ${curto(x)}   ·   f(x) = ${curto(y)}   ·   inclinação da tangente = f′(x) = ${curto(m)}`);
  }

  private acumulo(cena: Extract<Cena, { tipo: 'integral' }>, x: number, alfa: number): void {
    const y = cena.f(x);
    const acumulado = this.acumulada(x);
    if (!Number.isFinite(y) || !Number.isFinite(acumulado)) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alfa;
    this.tracejado(x, 0, x, acumulado, this.cores.segunda);
    this.ponto(x, y, this.cores.f);
    this.ponto(x, acumulado, this.cores.segunda);
    this.etiqueta(`área ${curto(acumulado)}`, x, acumulado, this.cores.segunda);
    ctx.restore();
    const [p, q] = [curto(this.partida), curto(x)];
    this.ler(`Área de ${p} até ${q}  =  F(${q}) − F(${p})  =  ${curto(acumulado)}`);
  }

  /** Integral definida; devolve se ainda há animação pela frente. */
  private definida(cena: Extract<Cena, { tipo: 'definida' }>, t: number): boolean {
    const lo = Math.min(cena.a, cena.b);
    const hi = Math.max(cena.a, cena.b);
    const pCurva = progresso(t, DURACAO.pausa, DURACAO.curva);
    const inicioRetangulos = DURACAO.pausa + DURACAO.curva + 250;
    const fimRetangulos = inicioRetangulos + RETANGULOS.length * DURACAO.retangulos;
    const pArea = progresso(t, fimRetangulos, DURACAO.area);

    if (pArea > 0 && !cena.diverge) this.area(cena.f, lo, hi, pArea);
    if (t >= inicioRetangulos) {
      const indice = Math.min(RETANGULOS.length - 1, Math.floor((t - inicioRetangulos) / DURACAO.retangulos));
      const n = RETANGULOS[indice]!;
      const crescer = progresso(t, inicioRetangulos + indice * DURACAO.retangulos, 320);
      const alfa = cena.diverge ? 1 : 1 - pArea;
      if (alfa > 0) this.retangulos(cena.f, lo, hi, n, crescer, alfa);
      if (n !== this.ultimoN) {
        this.ultimoN = n;
        const poloDentro = cena.diverge && cena.singularidades.some((s) => s > lo + 1e-9 && s < hi - 1e-9);
        if (!poloDentro) this.ouvintes.aoSomar?.(n, somaDeRiemann(cena.f, cena.a, cena.b, n));
      }
    }
    this.curva(cena.f, this.cores.f, pCurva);
    this.limites(cena, pCurva);
    if (cena.diverge && pArea > 0) this.singularidades(cena.singularidades, pArea, t);
    if (pArea >= 1 && !this.terminou) {
      this.terminou = true;
      this.ouvintes.aoTerminar?.();
    }
    return pArea < 1 || cena.diverge;
  }

  /** Em que ponto do ciclo de aproximação estamos: vai de 0 a 1, fica um pouco parado e recomeça. */
  private cicloDeAproximacao(t: number): number {
    if (this.calmo) return 0.9;
    const fase = ((t - DURACAO.pausa - DURACAO.curva) % 3600) / 2700;
    return suavizar(Math.min(1, Math.max(0, fase)));
  }

  /** Limite num ponto: dois pontos chegam a x = a, um por cada lado, e o que acontece lá fica marcado. */
  private aproximarDoPonto(cena: Extract<Cena, { tipo: 'limite' }>, t: number, alfa: number): void {
    const { ctx } = this;
    const { x0, x1 } = this.vista;
    const a = cena.a;
    const largura = Math.min(a - x0, x1 - a) * 0.85;
    const d = largura * (1 - this.cicloDeAproximacao(t)) + largura * 0.004;
    ctx.save();
    ctx.globalAlpha = alfa;
    // a reta x = a
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.px(a), 0);
    ctx.lineTo(this.px(a), this.altura);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fde68a';
    ctx.font = `600 12px ${FONTE}`;
    ctx.textAlign = 'center';
    ctx.fillText(`x → ${cena.rotuloPonto}`, limitar(this.px(a), 36, this.largura - 36), 18);
    // o que acontece em x = a
    const lados: [ValorNoGrafico, -1 | 1][] = [
      [cena.esquerda, -1],
      [cena.direita, 1],
    ];
    if (lados.some(([v]) => v === '+∞' || v === '-∞')) this.singularidades([a], 1, t);
    if (lados.some(([v]) => v === 'oscila')) {
      ctx.fillStyle = 'rgba(251, 113, 133, 0.12)';
      ctx.fillRect(this.px(a - largura * 0.25), 0, this.px(a + largura * 0.25) - this.px(a - largura * 0.25), this.altura);
      ctx.fillStyle = this.cores.erro;
      ctx.fillText('oscila', this.px(a), this.altura - 12);
    }
    // os dois pontos que chegam
    const leituras: string[] = [];
    for (const [, lado] of lados) {
      const x = a + lado * d;
      const y = cena.f(x);
      if (!Number.isFinite(y)) continue;
      const cor = lado < 0 ? this.cores.segunda : this.cores.tangente;
      this.ponto(x, y, cor);
      this.etiqueta(curto(y), x, y, cor);
      leituras.push(`x = ${curto(x)} → f(x) = ${curto(y)}`);
    }
    // buracos nos limites laterais e o ponto cheio em f(a)
    const finitos = lados.map(([v]) => v).filter((v): v is number => typeof v === 'number');
    for (const L of finitos) if (cena.valorEmA === null || Math.abs(cena.valorEmA - L) > 1e-9) this.buraco(a, L);
    if (cena.valorEmA !== null) this.ponto(a, cena.valorEmA, '#fde68a');
    ctx.restore();
    this.ler(leituras.join('   ·   '));
  }

  /** Limite no infinito: um ponto corre para longe e a assíntota horizontal aparece. */
  private aproximarDoInfinito(cena: Extract<Cena, { tipo: 'limite' }>, t: number, alfa: number): void {
    const { ctx } = this;
    const { x0, x1 } = this.vista;
    const L = cena.direita;
    ctx.save();
    ctx.globalAlpha = alfa;
    if (typeof L === 'number') {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, this.py(L));
      ctx.lineTo(this.largura, this.py(L));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fde68a';
      ctx.font = `600 12px ${FONTE}`;
      ctx.textAlign = cena.a > 0 ? 'right' : 'left';
      ctx.fillText(`y = ${curto(L)}`, cena.a > 0 ? this.largura - 10 : 10, this.py(L) - 8);
    }
    const p = 0.08 + 0.88 * this.cicloDeAproximacao(t);
    const x = cena.a > 0 ? x0 + (x1 - x0) * p : x1 - (x1 - x0) * p;
    const y = cena.f(x);
    if (Number.isFinite(y)) {
      this.ponto(x, y, this.cores.tangente);
      this.etiqueta(curto(y), x, y, this.cores.tangente);
      this.ler(`x = ${curto(x)} → f(x) = ${curto(y)}`);
    }
    ctx.restore();
  }

  /** Bola aberta: o limite lateral, que f não atinge em a. */
  private buraco(x: number, y: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = '#0b1226';
    ctx.strokeStyle = this.cores.f;
    ctx.shadowColor = this.cores.f;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(this.px(x), this.py(y), 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ─── Desenho ─────────────────────────────────────────────────────────────────

  private px(x: number): number {
    return ((x - this.vista.x0) / (this.vista.x1 - this.vista.x0)) * this.largura;
  }

  private py(y: number): number {
    const { y0, y1 } = this.vista;
    const altura = y1 - y0;
    return this.altura - ((limitar(y, y0 - altura * 4, y1 + altura * 4) - y0) / altura) * this.altura;
  }

  private grade(alfa: number, trigonometrica: boolean): void {
    const { ctx } = this;
    const { x0, x1, y0, y1 } = this.vista;
    const passoX = trigonometrica ? passoDePi(x1 - x0) : passoBonito((x1 - x0) / 10);
    const passoY = passoBonito((y1 - y0) / 8);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = Math.ceil(x0 / passoX); i * passoX <= x1; i++) xs.push(i * passoX);
    for (let i = Math.ceil(y0 / passoY); i * passoY <= y1; i++) ys.push(i * passoY);
    ctx.save();
    ctx.globalAlpha = alfa;
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
    const linhaX = limitar(this.py(0) + 15, 14, this.altura - 6);
    for (const x of xs) {
      if (Math.abs(x) < passoX / 2) continue;
      ctx.fillText(trigonometrica ? rotuloDePi(x) : curto(x), this.px(x), linhaX);
    }
    ctx.textAlign = 'left';
    const colunaY = limitar(this.px(0) + 6, 4, this.largura - 34);
    for (const y of ys) {
      if (Math.abs(y) < passoY / 2) continue;
      ctx.fillText(curto(y), colunaY, this.py(y) - 4);
    }
    ctx.restore();
  }

  /** A curva, desenhada até `progresso` da largura; quebra nas assíntotas (tg, 1/x), onde f não existe e em `quebras`. */
  private curva(f: Funcao, cor: string, progressoDaCurva: number, espessura = 2.6, quebras: number[] = []): void {
    if (progressoDaCurva <= 0) return;
    const { ctx } = this;
    const { x0, x1, y0, y1 } = this.vista;
    const altura = y1 - y0;
    const n = Math.max(240, Math.floor(this.largura / 1.5));
    const limite = x0 + (x1 - x0) * progressoDaCurva;

    let entradaCache = this.cacheCurvas.get(f);
    if (!entradaCache || entradaCache.x0 !== x0 || entradaCache.x1 !== x1 || entradaCache.y0 !== y0 || entradaCache.y1 !== y1 || entradaCache.n !== n) {
      if (this.cacheCurvas.size > 15) this.cacheCurvas.clear();
      const pontos: [number, number | null][] = [];
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const y = f(x);
        const valido = Number.isFinite(y) && Math.abs(y - (y0 + y1) / 2) <= altura * 50;
        pontos.push([x, valido ? y : null]);
      }
      // saltos de verdade (como |x|′ em 0) quebram a curva, qualquer que seja a largura da tela
      const saltos = new Set<number>();
      for (let i = 1; i <= n; i++) {
        const [xa, ya] = pontos[i - 1]!;
        const [xb, yb] = pontos[i]!;
        if (ya !== null && yb !== null && Math.abs(yb - ya) > altura * 0.05 && pulou(f, xa, xb, altura)) saltos.add(i);
      }
      entradaCache = { x0, x1, y0, y1, n, pontos, saltos };
      this.cacheCurvas.set(f, entradaCache);
    }

    let anterior: number | null = null;
    let xAnterior = Number.NEGATIVE_INFINITY;
    let ponta: [number, number] | null = null;
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.lineWidth = espessura;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = cor;
    ctx.shadowBlur = progressoDaCurva < 1 ? 4 : 0;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const [x, y] = entradaCache.pontos[i]!;
      if (x > limite) break;
      if (y === null) {
        anterior = null;
        continue;
      }
      const salto = anterior !== null && (Math.abs(y - anterior) > altura * 2.5 || entradaCache.saltos.has(i));
      const cruzouQuebra = quebras.some((q) => xAnterior < q && x >= q);
      if (anterior === null || salto || cruzouQuebra) ctx.moveTo(this.px(x), this.py(y));
      else ctx.lineTo(this.px(x), this.py(y));
      anterior = y;
      xAnterior = x;
      ponta = [x, y];
    }
    ctx.stroke();
    ctx.restore();
    if (progressoDaCurva < 1 && ponta) this.ponto(ponta[0], ponta[1], cor);
  }

  /** Área entre a curva e o eixo x, de l a r: acima do eixo numa cor, abaixo em outra. */
  private area(f: Funcao, l: number, r: number, alfa: number): void {
    if (r - l < 1e-12) return;
    const { ctx } = this;
    const n = 260;
    const zero = this.py(0);
    const pontos: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const x = l + ((r - l) * i) / n;
      const y = f(x);
      pontos.push([this.px(x), Number.isFinite(y) ? this.py(y) : zero]);
    }
    for (const [acima, cor] of [
      [true, this.cores.positiva],
      [false, this.cores.negativa],
    ] as const) {
      ctx.save();
      ctx.beginPath();
      if (acima) ctx.rect(0, 0, this.largura, zero);
      else ctx.rect(0, zero, this.largura, this.altura - zero);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(this.px(l), zero);
      for (const [x, y] of pontos) ctx.lineTo(x, y);
      ctx.lineTo(this.px(r), zero);
      ctx.closePath();
      ctx.globalAlpha = alfa;
      ctx.fillStyle = cor;
      ctx.fill();
      ctx.restore();
    }
  }

  /** Retângulos de Riemann com o ponto médio; `crescer` vai de 0 a 1 enquanto eles sobem do eixo. */
  private retangulos(f: Funcao, lo: number, hi: number, n: number, crescer: number, alfa: number): void {
    const { ctx } = this;
    const largura = (hi - lo) / n;
    const zero = this.py(0);
    ctx.save();
    for (let i = 0; i < n; i++) {
      const y = f(lo + (i + 0.5) * largura);
      if (!Number.isFinite(y)) continue;
      const xa = this.px(lo + i * largura);
      const xb = this.px(lo + (i + 1) * largura);
      const topo = zero + (this.py(y) - zero) * crescer;
      const [cima, alto] = [Math.min(zero, topo), Math.abs(topo - zero)];
      ctx.globalAlpha = alfa;
      ctx.fillStyle = y >= 0 ? this.cores.positiva : this.cores.negativa;
      ctx.fillRect(xa, cima, xb - xa, alto);
      if (xb - xa > 3) {
        ctx.globalAlpha = alfa * 0.6;
        ctx.strokeStyle = y >= 0 ? this.cores.f : this.cores.erro;
        ctx.lineWidth = 1;
        ctx.strokeRect(xa + 0.5, cima, xb - xa - 1, alto);
      }
    }
    ctx.restore();
  }

  private limites(cena: Extract<Cena, { tipo: 'definida' }>, alfa: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.font = `600 12px ${FONTE}`;
    ctx.textAlign = 'center';
    for (const [valor, rotulo] of [
      [cena.a, `a = ${cena.rotulos[0]}`],
      [cena.b, `b = ${cena.rotulos[1]}`],
    ] as const) {
      const x = this.px(valor);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
      ctx.setLineDash([5, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.altura);
      ctx.stroke();
      ctx.fillStyle = '#fde68a';
      ctx.fillText(rotulo, limitar(x, 28, this.largura - 28), 18);
    }
    ctx.restore();
  }

  /** Onde a integral imprópria explode: linha vermelha pulsando e o ∞. */
  private singularidades(pontos: number[], alfa: number, t: number): void {
    const { ctx } = this;
    const pulso = this.calmo ? 1 : 0.65 + 0.35 * Math.sin(t / 260);
    ctx.save();
    ctx.globalAlpha = alfa * pulso;
    for (const c of pontos) {
      const x = this.px(c);
      ctx.strokeStyle = this.cores.erro;
      ctx.shadowColor = this.cores.erro;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.altura);
      ctx.stroke();
      ctx.fillStyle = this.cores.erro;
      ctx.font = `700 30px ${FONTE}`;
      ctx.textAlign = 'center';
      ctx.fillText('∞', limitar(x + 22, 20, this.largura - 20), 48);
    }
    ctx.restore();
  }

  private segmento(xa: number, ya: number, xb: number, yb: number, cor: string, espessura: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.lineWidth = espessura;
    ctx.shadowColor = cor;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(this.px(xa), this.py(ya));
    ctx.lineTo(this.px(xb), this.py(yb));
    ctx.stroke();
    ctx.restore();
  }

  private tracejado(xa: number, ya: number, xb: number, yb: number, cor: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.globalAlpha *= 0.8;
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.px(xa), this.py(ya));
    ctx.lineTo(this.px(xb), this.py(yb));
    ctx.stroke();
    ctx.restore();
  }

  /** Tracejado em pixels (os eixos podem estar presos na borda do gráfico). */
  private tracejadoPx(xa: number, ya: number, xb: number, yb: number, cor: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.globalAlpha *= 0.85;
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(xa, ya);
    ctx.lineTo(xb, yb);
    ctx.stroke();
    ctx.restore();
  }

  /** Bolinha cheia (o valor entra no conjunto) ou vazia (não entra), em pixels. */
  private bolinha(cx: number, cy: number, cor: string, cheia: boolean): void {
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

  private ponto(x: number, y: number, cor: string): void {
    const { ctx } = this;
    const [cx, cy] = [this.px(x), this.py(y)];
    ctx.save();
    ctx.fillStyle = cor;
    ctx.shadowColor = cor;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b1020';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private etiqueta(texto: string, x: number, y: number, cor: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.font = `600 12px ${FONTE}`;
    const largura = ctx.measureText(texto).width + 16;
    const altura = 24;
    let cx = this.px(x) + 12;
    let cy = this.py(y) - altura - 10;
    if (cx + largura > this.largura - 4) cx = this.px(x) - largura - 12;
    if (cy < 4) cy = this.py(y) + 12;
    ctx.fillStyle = 'rgba(7, 11, 24, 0.86)';
    ctx.strokeStyle = cor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cx, cy, largura, altura, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = cor;
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, cx + 8, cy + altura / 2 + 0.5);
    ctx.restore();
  }

  private ler(texto: string): void {
    if (texto === this.ultimaLeitura) return;
    this.ultimaLeitura = texto;
    this.ouvintes.aoLer?.(texto);
  }
}

// ─── Contas do gráfico ─────────────────────────────────────────────────────────

/** Soma de Riemann pelo ponto médio, com o sinal dos limites (de a até b). NaN se f não existir num ponto médio. */
export function somaDeRiemann(f: Funcao, a: number, b: number, n: number): number {
  const h = (b - a) / n;
  let soma = 0;
  for (let i = 0; i < n; i++) soma += f(a + (i + 0.5) * h) * h;
  return soma;
}

/** Janela do limite: em volta do ponto, mais estreita quando f oscila; no infinito, um bom trecho para o lado certo. */
function janelaDoLimite(cena: Extract<Cena, { tipo: 'limite' }>): [number, number] {
  if (!Number.isFinite(cena.a)) return cena.a > 0 ? [0, 24] : [-24, 0];
  const oscila = cena.esquerda === 'oscila' || cena.direita === 'oscila';
  const raio = oscila ? 0.8 : cena.trigonometrica ? Math.PI : 3;
  return [cena.a - raio, cena.a + raio];
}

function comMargem(a: number, b: number): [number, number] {
  const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
  const d = hi - lo || 1;
  return [lo - d * 0.18, hi + d * 0.18];
}

/**
 * Entre duas amostras vizinhas a curva subiu muito: foi um salto (|x|′ em 0) ou só uma subida íngreme?
 * Aperta o intervalo pela metade, seguindo o lado onde está a maior parte da variação; num salto,
 * a variação não diminui (ou f deixa de existir no caminho), numa curva contínua ela some.
 */
function pulou(f: Funcao, a: number, b: number, altura: number): boolean {
  let [xa, xb] = [a, b];
  let [ya, yb] = [f(a), f(b)];
  for (let i = 0; i < 30; i++) {
    const m = (xa + xb) / 2;
    const ym = f(m);
    if (!Number.isFinite(ym)) return true;
    if (Math.abs(ym - ya) >= Math.abs(yb - ym)) [xb, yb] = [m, ym];
    else [xa, ya] = [m, ym];
  }
  return Math.abs(yb - ya) > altura * 0.01;
}

/** Faixa vertical que mostra bem as curvas: ignora os 3% mais extremos (assíntotas) e inclui o eixo x. */
function faixaVertical(curvas: Funcao[], x0: number, x1: number): { y0: number; y1: number } {
  const ys: number[] = [];
  for (const f of curvas) {
    for (let i = 0; i <= 400; i++) {
      const y = f(x0 + ((x1 - x0) * i) / 400);
      if (Number.isFinite(y)) ys.push(y);
    }
  }
  if (ys.length === 0) return { y0: -5, y1: 5 };
  ys.sort((p, q) => p - q);
  let baixo = Math.min(0, ys[Math.floor(ys.length * 0.03)]!);
  let alto = Math.max(0, ys[Math.min(ys.length - 1, Math.ceil(ys.length * 0.97))]!);
  if (alto - baixo < 1e-6) {
    baixo -= 1;
    alto += 1;
  }
  // Folga maior em cima: lá ficam os rótulos de a e b e o placar da soma de Riemann
  const altura = alto - baixo;
  return { y0: baixo - altura * 0.14, y1: alto + altura * 0.26 };
}

/** De onde a área começa a acumular (0, se f existir ali) e até onde f segue sem interrupção. */
function acharPartida(f: Funcao, x0: number, x1: number): { partida: number; trecho: [number, number] } {
  const existe = (x: number): boolean => Number.isFinite(f(x));
  const candidatos = [0, 1, -1, 0.5, -0.5, 2, -2, (x0 + x1) / 2];
  const partida = candidatos.find((c) => c > x0 && c < x1 && existe(c) && existe(c - 1e-4) && existe(c + 1e-4)) ?? (x0 + x1) / 2;
  const { y0, y1 } = faixaVertical([f], x0, x1);
  const escala = y1 - y0;
  const passo = (x1 - x0) / 800;
  const andar = (sentido: 1 | -1): number => {
    let x = partida;
    let y = f(x);
    for (let i = 0; i < 1600; i++) {
      const proximo = x + sentido * passo;
      if (proximo < x0 || proximo > x1) return limitar(proximo, x0, x1);
      const yp = f(proximo);
      if (!Number.isFinite(yp) || Math.abs(yp - y) > escala * 2 || Math.abs(yp) > escala * 30) return x;
      x = proximo;
      y = yp;
    }
    return x;
  };
  return { partida, trecho: [andar(-1), andar(1)] };
}

/** 1, 2 ou 5 vezes uma potência de 10, perto de `bruto`. */
export function passoBonito(bruto: number): number {
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const fracao = bruto / potencia;
  return (fracao < 1.5 ? 1 : fracao < 3.5 ? 2 : fracao < 7.5 ? 5 : 10) * potencia;
}

/** Marcas em múltiplos de π para gráficos de seno e cosseno. */
export function passoDePi(faixa: number): number {
  const candidatos = [Math.PI / 4, Math.PI / 2, Math.PI, 2 * Math.PI];
  // em trechos muito longos, múltiplos redondos de 2π, para não empilhar centenas de rótulos
  return candidatos.find((p) => faixa / p <= 12) ?? 2 * Math.PI * passoBonito(faixa / (2 * Math.PI) / 8);
}

export function rotuloDePi(x: number): string {
  const quartos = Math.round(x / (Math.PI / 4));
  const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));
  const g = mdc(Math.abs(quartos), 4);
  const [p, q] = [quartos / g, 4 / g];
  const numerador = p === 1 ? 'π' : p === -1 ? '−π' : `${String(p).replace('-', '−')}π`;
  return q === 1 ? numerador : `${numerador}/${q}`;
}
