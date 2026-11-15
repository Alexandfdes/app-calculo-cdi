/**
 * A cena do carro na calculadora: quando a conta veio de um exemplo 🚗, uma faixa acima do
 * gráfico mostra o que a função descreve. Na estrada, o carro anda conforme a posição s(t), com
 * a lombada, o radar ou o posto no lugar; na roda, a válvula gira e mostra a altura.
 * O instante vem do ponto móvel do gráfico (o x do gráfico é o tempo); nos modos em que o
 * gráfico não tem ponto móvel, o carro anda sozinho, de ponta a ponta do trecho.
 * Com "reduzir movimento" ligado, a cena fica parada no fim do trecho ou onde o ponto estiver.
 */
import { passoBonito } from './grafico';

export interface Marco {
  /** Posição na estrada, em metros. */
  em: number;
  nome: string;
  tipo: 'lombada' | 'radar' | 'marco';
}

export type CenaDoCarro =
  | {
      tipo: 'estrada';
      /** Posição do carro, em metros, no instante t. */
      s: (t: number) => number;
      /** Trecho de tempo em que a cena vale. */
      tempo: [number, number];
      /** Trecho da estrada que aparece, em metros. */
      estrada: [number, number];
      marcos: Marco[];
    }
  | { tipo: 'roda' };

const FONTE = '"Segoe UI", system-ui, -apple-system, sans-serif';
const limitar = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const comVirgula = (v: number, casas = 1): string => String(Number(v.toFixed(casas))).replace('.', ',').replace('-', '−');

export class CenaCarro {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private cena: CenaDoCarro | null = null;
  private largura = 0;
  private altura = 0;
  private quadro = 0;
  private inicio = 0;
  /** O x do ponto móvel do gráfico e quando ele chegou. */
  private doGrafico: number | null = null;
  private quandoMoveu = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly caixa: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Este navegador não desenha em canvas 2D.');
    this.ctx = ctx;
    new ResizeObserver(() => this.medir()).observe(canvas);
  }

  /** Mostra a cena do exemplo, ou esconde a faixa (null). */
  mostrar(cena: CenaDoCarro | null): void {
    this.cena = cena;
    this.caixa.hidden = cena === null;
    this.doGrafico = null;
    this.quandoMoveu = Number.NEGATIVE_INFINITY;
    this.inicio = performance.now();
    cancelAnimationFrame(this.quadro);
    if (cena) this.quadro = requestAnimationFrame((agora) => this.desenhar(agora));
  }

  /** O ponto móvel do gráfico está em x: o carro vai para esse instante. */
  mover(x: number): void {
    this.doGrafico = x;
    this.quandoMoveu = performance.now();
    if (this.calmo && this.cena) this.desenhar(performance.now());
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
    if (this.cena) this.desenhar(performance.now());
  }

  /** O instante a desenhar: o do gráfico, se ele se moveu há pouco; senão, o passeio próprio. */
  private instante(agora: number, [t0, t1]: [number, number]): number {
    if (this.doGrafico !== null && (this.calmo || agora - this.quandoMoveu < 400)) return limitar(this.doGrafico, t0, t1);
    if (this.calmo) return t1;
    const ciclo = ((agora - this.inicio) % 5200) / 5200;
    return t0 + (t1 - t0) * Math.min(1, ciclo / 0.8);
  }

  private desenhar(agora: number): void {
    const { ctx, cena } = this;
    if (!cena) return;
    if (this.largura > 0) {
      ctx.clearRect(0, 0, this.largura, this.altura);
      if (cena.tipo === 'estrada') this.estrada(cena, this.instante(agora, cena.tempo));
      else this.roda(this.instante(agora, [0, 2 * Math.PI]));
    }
    if (!this.calmo) this.quadro = requestAnimationFrame((proximo) => this.desenhar(proximo));
  }

  private texto(conteudo: string, x: number, y: number, cor: string, alinhar: CanvasTextAlign = 'center', tamanho = 11): void {
    const { ctx } = this;
    ctx.save();
    ctx.font = `700 ${tamanho}px ${FONTE}`;
    ctx.textAlign = alinhar;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(7, 11, 24, 0.9)';
    ctx.strokeText(conteudo, x, y);
    ctx.fillStyle = cor;
    ctx.fillText(conteudo, x, y);
    ctx.restore();
  }

  private estrada(cena: Extract<CenaDoCarro, { tipo: 'estrada' }>, t: number): void {
    const { ctx } = this;
    const [d0, d1] = cena.estrada;
    const px = (d: number): number => 14 + ((d - d0) / (d1 - d0)) * (this.largura - 28);
    const chao = this.altura - 30;
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, chao);
    ctx.lineTo(this.largura, chao);
    ctx.stroke();
    ctx.restore();
    // marcas de distância, sem número onde um marco com nome vai escrever
    const passo = passoBonito((d1 - d0) / (this.largura < 520 ? 5 : 9));
    for (let d = Math.ceil(d0 / passo) * passo; d <= d1; d += passo) {
      ctx.fillStyle = 'rgba(203, 213, 225, 0.6)';
      ctx.fillRect(px(d) - 0.5, chao, 1, 5);
      if (!cena.marcos.some((m) => Math.abs(px(m.em) - px(d)) < 62)) this.texto(`${d} m`, px(d), chao + 17, 'rgba(203, 213, 225, 0.75)', 'center', 10);
    }
    for (const m of cena.marcos) {
      const x = px(m.em);
      ctx.save();
      if (m.tipo === 'lombada') {
        const fim = px(m.em + (d1 - d0) * 0.05);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(x, chao);
        ctx.quadraticCurveTo((x + fim) / 2, chao - 20, fim, chao);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.strokeStyle = m.tipo === 'radar' ? '#fb7185' : '#f472b6';
        ctx.lineWidth = m.tipo === 'radar' ? 3 : 1.4;
        if (m.tipo === 'marco') ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, chao);
        ctx.lineTo(x, chao - 46);
        ctx.stroke();
        if (m.tipo === 'radar') {
          ctx.fillStyle = '#fb7185';
          ctx.fillRect(x - 9, chao - 56, 18, 11);
        }
      }
      ctx.restore();
      const cor = m.tipo === 'lombada' ? '#fde68a' : m.tipo === 'radar' ? '#fecdd3' : '#f9a8d4';
      this.texto(m.nome, limitar(x, 40, this.largura - 40), chao + 17, cor);
    }
    // o carro, com a frente na posição s(t)
    const frente = px(cena.s(t));
    ctx.save();
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.fillRect(frente - 40, chao - 24, 40, 14);
    ctx.fillRect(frente - 31, chao - 34, 20, 11);
    ctx.shadowBlur = 0;
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
    const h = 1e-4;
    const v = (cena.s(t + h) - cena.s(t - h)) / (2 * h);
    this.texto(`${comVirgula(Math.abs(v) * 3.6)} km/h`, limitar(frente - 20, 34, this.largura - 34), chao - 42, '#e2e8f0');
    this.texto(`t = ${comVirgula(t)} s · posição ${comVirgula(cena.s(t))} m`, 12, 16, 'rgba(203, 213, 225, 0.9)', 'left');
  }

  /** A roda de 30 cm de raio: a válvula sai do chão e gira x radianos. */
  private roda(x: number): void {
    const { ctx } = this;
    const chao = this.altura - 16;
    const r = Math.min(this.altura * 0.36, 46);
    const cx = this.largura / 2;
    const cy = chao - r;
    const [vx, vy] = [cx - r * Math.sin(x), cy + r * Math.cos(x)];
    const altura = 0.3 - 0.3 * Math.cos(x);
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, chao);
    ctx.lineTo(this.largura, chao);
    ctx.stroke();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 7;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3.5, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - (r - 7) * Math.sin(x + (k * Math.PI) / 2), cy + (r - 7) * Math.cos(x + (k * Math.PI) / 2));
    }
    ctx.stroke();
    // a altura da válvula
    ctx.strokeStyle = '#c084fc';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(cx + r + 26, vy);
    ctx.moveTo(cx + r + 26, vy);
    ctx.lineTo(cx + r + 26, chao);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(vx, vy, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
    this.texto(`altura ${comVirgula(altura * 100, 0)} cm`, cx + r + 34, (vy + chao) / 2 + 4, '#e9d5ff', 'left');
    this.texto(`girou ${comVirgula(x, 2)} rad`, 12, 16, 'rgba(203, 213, 225, 0.9)', 'left');
  }
}
