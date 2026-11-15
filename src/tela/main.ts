/**
 * Tela do app: junta a entrada, o motor (src/motor) e o gráfico animado. Cada conta mostra o
 * resultado, as regras usadas, uma conferência feita por outro caminho e o passo a passo,
 * na notação da aula.
 */
import { derivar } from '../motor/derivadas';
import type { Regra } from '../motor/derivadas';
import { integralDefinida } from '../motor/definidas';
import type { ResultadoIntegralDefinida } from '../motor/definidas';
import { ErroDeEntrada, avaliar, contem, derivada, lerExpressao, paraTexto } from '../motor/expressao';
import type { Expr } from '../motor/expressao';
import { analisarFuncao, calcularEm, igualdadeDaAnalise, numeroDaAnalise, pertence, tabelaDeValores as tabelaDaFuncao } from '../motor/funcoes';
import type { AnaliseFuncao, AspectoFuncao, TipoFuncao } from '../motor/funcoes';
import { integrar } from '../motor/integrais';
import type { PassoIntegral, RegraIntegral } from '../motor/integrais';
import { avaliarFuncao, calcularLimite, lerFuncaoDoLimite } from '../motor/limites';
import type { FuncaoDoLimite, PassoLimite, ResultadoLimite, TecnicaLimite, ValorLimite } from '../motor/limites';
import { numeroBonito, numeroParaLer } from '../motor/numeros';
import { iniciarConteudo } from './aulas';
import type { Conta } from './conteudos';
import { CenaCarro } from './cena-do-carro';
import type { CenaDoCarro, Marco } from './cena-do-carro';
import { escapar, formulaHTML, integralHTML, temPendencia } from './formula';
import { Grafico, curto, somaDeRiemann } from './grafico';
import type { Cena, Funcao, PontoDoGrafico } from './grafico';

type Modo = 'funcao' | 'limite' | 'derivada' | 'integral' | 'definida';
type Etiqueta = Regra | RegraIntegral | TecnicaLimite | TipoFuncao | AspectoFuncao | 'primitiva' | 'tfc' | 'módulo' | 'descontinuidade' | 'imprópria';

interface ItemPasso {
  etiqueta: Etiqueta;
  html: string;
}

interface Exemplo {
  f: string;
  a?: string;
  b?: string;
  /** Ponto do limite. */
  ponto?: string;
  /** Nome curto no botão, no lugar da fórmula (para as funções por partes). */
  rotulo?: string;
  /** O problema por trás do exemplo (o cenário do veículo). */
  contexto?: string;
  /** O que o resultado quer dizer nesse problema. */
  leitura?: string;
  /** Modo Função: o trecho de x do gráfico, as entradas da tabela e o x da conta de exemplo. */
  janela?: [number, number];
  entradas?: number[];
  avaliar?: string;
  /** O carro andando acima do gráfico, enquanto este exemplo estiver aberto. */
  cena?: CenaDoCarro;
}

/** A lombada da história: 1 s de reação a 20 m/s, depois a frenagem; a lombada fica nos 62 m. */
const LOMBADA: CenaDoCarro = {
  tipo: 'estrada',
  s: (t) => (t < 1 ? 20 * t : -2 * t * t + 24 * t - 2),
  tempo: [0, 4],
  estrada: [-6, 70],
  marcos: [
    { em: 20, nome: 'freia', tipo: 'marco' },
    { em: 62, nome: 'lombada · 62 m', tipo: 'lombada' },
  ],
};
/** O carro a 20 m/s, com o que houver na estrada. */
const aVinte = (tempo: [number, number], estrada: [number, number], inicio = 0, marcos: Marco[] = []): CenaDoCarro => ({
  tipo: 'estrada',
  s: (t) => inicio + 20 * t,
  tempo,
  estrada,
  marcos,
});

/** Exemplos tirados dos slides das Aulas 1 a 4, e o cenário do veículo. */
const EXEMPLOS: Record<Modo, Exemplo[]> = {
  funcao: [
    { f: 'x^2 - 4*x - 5' },
    { f: 'tg(x)' },
    {
      f: '20',
      rotulo: '🚗 piloto automático',
      cena: aVinte([0, 10], [-10, 210]),
      contexto: 'Com o piloto automático ligado, a velocidade do carro fica em 20 m/s (72 km/h), qualquer que seja o instante x, em segundos.',
      leitura:
        'A velocidade não depende do tempo: em qualquer instante, a saída é 20. Por isso a imagem é só {20} e o gráfico é uma reta horizontal na altura 20.',
      janela: [-1, 10],
      entradas: [0, 1, 2, 5, 10],
      avaliar: '7',
    },
    {
      f: '20*x',
      rotulo: '🚗 reação',
      cena: aVinte([0, 5], [-6, 110], 0, [{ em: 62, nome: 'lombada · 62 m', tipo: 'lombada' }]),
      contexto: 'Distância, em metros, que o carro anda x segundos depois de o motorista ver a lombada, enquanto ele ainda não freou: o carro segue a 20 m/s.',
      leitura:
        'A distância é proporcional ao tempo: no 1 s de reação o carro anda 20 m; se o motorista demorasse 2 s, seriam 40 m, o dobro. A taxa a = 20 é a própria velocidade. No problema, só faz sentido x ≥ 0.',
      janela: [-1, 10],
      entradas: [0, 1, 2, 3, 4, 5],
      avaliar: '1',
    },
    {
      f: '20*x + 100',
      rotulo: '🚗 posição',
      cena: aVinte([-5, 10], [-15, 310], 100, [{ em: 0, nome: 'posto', tipo: 'marco' }]),
      contexto: 'Posição do carro na estrada, em metros a partir do posto: no instante 0 ele está no marco de 100 m e anda a 20 m/s.',
      leitura:
        'b = 100 é a posição no instante 0 (onde a reta corta o eixo y) e a = 20 é a velocidade: a cada segundo, a posição aumenta 20 m. A raiz x = −5 é o instante em que o carro passou pelo posto, 5 s antes de começarmos a contar.',
      janela: [-7, 10],
      entradas: [-5, 0, 1, 2, 5, 10],
      avaliar: '5',
    },
    {
      f: '-2*x^2 + 24*x - 2',
      rotulo: '🚗 frenagem',
      cena: LOMBADA,
      contexto: 'Posição do carro, em metros desde onde o motorista viu a lombada, depois que o freio entra: ele vinha a 20 m/s e perde 4 m/s a cada segundo. x é o tempo, em segundos; o freio entra em x = 1.',
      leitura:
        'Em x = 1 o freio entra, com o carro nos 20 m; em x = 4 ele chega à lombada, nos 62 m. O vértice (6, 70) é onde ele pararia se não soltasse o freio: 8 m depois da lombada, e a imagem (−∞, 70] diz que ele nunca passaria dos 70 m. A fórmula só vale de x = 1 até a lombada.',
      janela: [-1, 9],
      entradas: [1, 2, 3, 4, 5, 6],
      avaliar: '4',
    },
    {
      f: 'abs(20*x - 100)',
      rotulo: '🚗 radar',
      cena: aVinte([0, 10], [-10, 210], 0, [{ em: 100, nome: 'radar · 100 m', tipo: 'radar' }]),
      contexto: 'Distância, em metros, entre o carro e um radar que fica 100 m à frente do ponto de partida; o carro anda a 20 m/s.',
      leitura:
        'Distância nunca é negativa: a imagem é [0, +∞). O bico do gráfico, em x = 5, é o instante em que o carro passa pelo radar (distância zero); antes ele se aproxima, depois se afasta.',
      janela: [-1, 10],
      entradas: [0, 2, 4, 5, 6, 8, 10],
      avaliar: '5',
    },
    {
      f: '80*0.85^x',
      rotulo: '🚗 desvalorização',
      contexto: 'Valor do carro, em mil reais, x anos depois de comprado por R$ 80 mil, perdendo 15% do valor a cada ano.',
      leitura:
        'A cada ano, o valor é multiplicado por 0.85. Ele cai sempre, mas nunca chega a zero: a reta y = 0 é assíntota, e a imagem é (0, +∞). Em 5 anos, o carro vale cerca de R$ 35 mil. No problema, só faz sentido x ≥ 0.',
      janela: [-1, 15],
      entradas: [0, 1, 2, 5, 10],
      avaliar: '5',
    },
    {
      f: 'log(x/80, 0.85)',
      rotulo: '🚗 tempo de uso',
      contexto: 'Quantos anos levam até o carro, comprado por R$ 80 mil e perdendo 15% ao ano, valer x mil reais.',
      leitura:
        'É a inversa da desvalorização: para valer R$ 40 mil, metade do preço, passam uns 4 anos e 3 meses. O domínio é x > 0 (valor de carro é positivo) e a função é decrescente: quanto menor o valor, mais anos de uso.',
      janela: [-5, 100],
      entradas: [80, 68, 57.8, 40, 20],
      avaliar: '40',
    },
    {
      f: '0.3 - 0.3*cos(x)',
      rotulo: '🚗 roda',
      cena: { tipo: 'roda' },
      contexto: 'Altura, em metros, da válvula do pneu depois de a roda girar x radianos. A roda tem raio de 30 cm, e a válvula começa encostada no chão.',
      leitura:
        'A altura vai de 0 (no chão) a 0.6 m (60 cm, no alto da roda): a imagem é [0, 0.6]. A cada volta completa, x aumenta 2π e a altura se repete: o período é 2π.',
      avaliar: 'pi',
    },
  ],
  limite: [
    { f: '(x^2 - 4)/(x - 2)', ponto: '2' },
    { f: '(sqrt(x + 1) - 1)/x', ponto: '0' },
    { f: 'sen(x)/x', ponto: '0' },
    { f: 'abs(x)/x', ponto: '0' },
    { f: '1/x', ponto: '0' },
    { f: 'sen(1/x)', ponto: '0' },
    { f: '(3*x^2 + 1)/(2*x^2 - x)', ponto: 'inf' },
    {
      f: 'x < 1 ? 0 : -4',
      ponto: '1',
      rotulo: '🚗 aceleração',
      cena: LOMBADA,
      contexto: 'Aceleração do carro que vê a lombada (x é o tempo, em segundos): 0 durante 1 s de reação, com o carro a 20 m/s, e −4 m/s² depois, quando o freio entra.',
      leitura:
        'No instante t = 1 s a aceleração salta de 0 para −4 m/s²: não existe um valor do qual ela se aproxime nesse instante. É o momento exato em que o freio entra.',
    },
    {
      f: 'x < 1 ? 20 : 24 - 4*x',
      ponto: '1',
      rotulo: '🚗 velocidade',
      cena: LOMBADA,
      contexto: 'Velocidade do mesmo carro, em m/s: 20 durante a reação e 24 − 4t depois que o freio entra.',
      leitura:
        'A velocidade chega a 20 m/s pelos dois lados: ela não salta, mesmo com a aceleração saltando. Mas o gráfico faz uma quina em t = 1 s, porque a inclinação passa de 0 para −4: ali a velocidade não tem derivada.',
    },
  ],
  derivada: [
    { f: 'x^2*sen(x)' },
    { f: 'sen(3*x)' },
    { f: 'cos(5*x^2)' },
    { f: 'e^(sen(x))' },
    { f: 'ln(cos(x))' },
    { f: 'sen(x)/x' },
    { f: 'x^3 - 4*x + 2' },
    {
      f: '-2*x^2 + 24*x - 2',
      rotulo: '🚗 frenagem',
      cena: LOMBADA,
      contexto: 'Posição do carro durante a frenagem, em metros desde onde o motorista viu a lombada; x é o tempo, em segundos, e o freio entra em x = 1.',
      leitura:
        'A derivada da posição é a velocidade: v(t) = 24 − 4t. Em t = 1 ela vale 20 m/s, a velocidade de antes do freio; na lombada, em t = 4, vale 8 m/s (28,8 km/h). O −4 é a aceleração: o carro perde 4 m/s a cada segundo.',
    },
  ],
  integral: [
    { f: '2*x*cos(x^2)' },
    { f: '3*x^2 - 4*x + 2' },
    { f: 'cos(3*x)' },
    { f: 'e^(-2*x)' },
    { f: '1/x' },
    { f: 'tg(x)' },
    { f: 'sec(x)*tg(x)' },
    {
      f: '24 - 4*x',
      rotulo: '🚗 velocidade',
      cena: LOMBADA,
      contexto: 'Velocidade do carro durante a frenagem, em m/s; x é o tempo, em segundos.',
      leitura:
        'A primitiva é a posição, a menos de uma constante: 24t − 2t² + C. Como o carro está nos 20 m quando o freio entra, em t = 1, a constante é −2, e volta s(t) = −2t² + 24t − 2.',
    },
  ],
  definida: [
    { f: 'sen(x)', a: '0', b: 'pi' },
    { f: '3*x^2 - 4*x + 2', a: '0', b: '2' },
    { f: 'abs(sen(x))', a: '0', b: '2*pi' },
    { f: '1/x', a: '1', b: 'e' },
    { f: '1/x^2', a: '-1', b: '1' },
    { f: 'e^(-x)', a: '0', b: 'inf' },
    {
      f: '24 - 4*x',
      a: '1',
      b: '4',
      rotulo: '🚗 frenagem',
      cena: LOMBADA,
      contexto: 'Velocidade do carro durante a frenagem, em m/s, de t = 1 s, quando o freio entra, até t = 4 s, quando ele chega à lombada.',
      leitura: 'A área debaixo da velocidade é a distância andada freando: 42 m. Somados aos 20 m do 1 s de reação, dão os 62 m até a lombada.',
    },
  ],
};

const ETIQUETAS: Record<Etiqueta, { nome: string; cor: string }> = {
  constante: { nome: 'Constante', cor: '#94a3b8' },
  potência: { nome: 'Potência', cor: '#a78bfa' },
  'múltiplo constante': { nome: 'Múltiplo constante', cor: '#60a5fa' },
  'soma/subtração': { nome: 'Soma e diferença', cor: '#38bdf8' },
  produto: { nome: 'Produto', cor: '#fb923c' },
  quociente: { nome: 'Quociente', cor: '#fbbf24' },
  cadeia: { nome: 'Cadeia', cor: '#f472b6' },
  'função elementar': { nome: 'Função elementar', cor: '#2dd4bf' },
  logaritmo: { nome: 'Integral de 1/x', cor: '#2dd4bf' },
  exponencial: { nome: 'Exponencial', cor: '#4ade80' },
  trigonométrica: { nome: 'Trigonométrica', cor: '#fb7185' },
  substituição: { nome: 'Substituição', cor: '#e879f9' },
  reescrita: { nome: 'Reescrita', cor: '#c084fc' },
  simplificação: { nome: 'Simplificação', cor: '#94a3b8' },
  primitiva: { nome: 'Primitiva', cor: '#a78bfa' },
  tfc: { nome: 'Teorema Fundamental', cor: '#facc15' },
  módulo: { nome: 'Módulo', cor: '#38bdf8' },
  descontinuidade: { nome: 'Descontinuidade', cor: '#fb7185' },
  imprópria: { nome: 'Integral imprópria', cor: '#fb923c' },
  'substituição direta': { nome: 'Substituição direta', cor: '#4ade80' },
  'por partes': { nome: 'Por partes', cor: '#facc15' },
  'forma indeterminada': { nome: 'Forma indeterminada', cor: '#94a3b8' },
  fatoração: { nome: 'Fatoração', cor: '#fb923c' },
  racionalização: { nome: 'Racionalização', cor: '#e879f9' },
  'limite fundamental': { nome: 'Limite fundamental', cor: '#2dd4bf' },
  'limite infinito': { nome: 'Limite infinito', cor: '#fb7185' },
  oscilação: { nome: 'Oscilação', cor: '#f472b6' },
  confronto: { nome: 'Confronto', cor: '#a78bfa' },
  'limite no infinito': { nome: 'Limite no infinito', cor: '#60a5fa' },
  'limites laterais': { nome: 'Limites laterais', cor: '#38bdf8' },
  continuidade: { nome: 'Continuidade', cor: '#facc15' },
  'mudança de variável': { nome: 'Mudança de variável', cor: '#c084fc' },
  'ordem de crescimento': { nome: 'Ordem de crescimento', cor: '#4ade80' },
  linear: { nome: 'Linear', cor: '#60a5fa' },
  afim: { nome: 'Afim', cor: '#38bdf8' },
  quadrática: { nome: 'Quadrática', cor: '#a78bfa' },
  modular: { nome: 'Modular', cor: '#2dd4bf' },
  logarítmica: { nome: 'Logarítmica', cor: '#fb923c' },
  tipo: { nome: 'Tipo', cor: '#c4b5fd' },
  domínio: { nome: 'Domínio', cor: '#34d399' },
  imagem: { nome: 'Imagem', cor: '#c084fc' },
  raízes: { nome: 'Raízes', cor: '#f472b6' },
  vértice: { nome: 'Vértice', cor: '#facc15' },
  concavidade: { nome: 'Concavidade', cor: '#a78bfa' },
  crescimento: { nome: 'Crescimento', cor: '#4ade80' },
  assíntota: { nome: 'Assíntota', cor: '#fb7185' },
  período: { nome: 'Período', cor: '#22d3ee' },
  paridade: { nome: 'Paridade', cor: '#60a5fa' },
  'corte no eixo y': { nome: 'Corte no eixo y', cor: '#a3e635' },
};

/** A aula que explica cada modo, para o link "Entenda…" da calculadora. */
const AULA_DO_MODO: Record<Modo, { id: string; texto: string }> = {
  funcao: { id: 'funcoes', texto: 'Entenda as funções (Aula 1)' },
  limite: { id: 'limites', texto: 'Entenda os limites (Aula 2)' },
  derivada: { id: 'derivadas', texto: 'Entenda as derivadas (Aula 3)' },
  integral: { id: 'integrais', texto: 'Entenda as integrais (Aula 4)' },
  definida: { id: 'integrais', texto: 'Entenda as integrais (Aula 4)' },
};

/** O que o campo sugere em cada modo. */
const SUGESTAO: Record<Modo, string> = {
  funcao: 'por exemplo, x^2 - 4*x - 5',
  limite: 'por exemplo, (x^2 - 4)/(x - 2)',
  derivada: 'por exemplo, x^2*sen(x)',
  integral: 'por exemplo, 2*x*cos(x^2)',
  definida: 'por exemplo, sen(x)',
};

const TRIGONOMETRICAS = new Set(['sen', 'cos', 'tg', 'cotg', 'sec', 'csc']);
const SIMBOLOS = ['∫', 'π', '∂', '√', '∞', 'Σ', 'Δ', 'dx', 'f′', 'e', 'θ', 'lim'];
const CORES = ['#a78bfa', '#22d3ee', '#f472b6', '#facc15', '#4ade80', '#60a5fa'];
const X = '<i class="v">x</i>';
const MAIS_C = '<span class="op">+</span><i class="c">C</i>';
const IGUAL = '<span class="op">=</span>';

const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function elemento<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado na página.`);
  return el as T;
}

const campo = elemento<HTMLInputElement>('funcao');
const campoA = elemento<HTMLInputElement>('limite-a');
const campoB = elemento<HTMLInputElement>('limite-b');
const formulario = elemento<HTMLFormElement>('formulario');
const modos = elemento<HTMLFieldSetElement>('modos');
const limites = elemento<HTMLDivElement>('limites');
const previa = elemento<HTMLParagraphElement>('previa');
const exemplos = elemento<HTMLDivElement>('exemplos');
const resultado = elemento<HTMLElement>('resultado');
const listaPassos = elemento<HTMLOListElement>('passos');
const canvas = elemento<HTMLCanvasElement>('canvas');
const legenda = elemento<HTMLDivElement>('legenda');
const leitura = elemento<HTMLParagraphElement>('leitura');
const placar = elemento<HTMLDivElement>('riemann');
const rever = elemento<HTMLButtonElement>('rever');
const campoPonto = elemento<HTMLInputElement>('ponto');
const pontoDoLimite = elemento<HTMLDivElement>('ponto-limite');
const entender = elemento<HTMLAnchorElement>('entender');
const entenderTexto = elemento<HTMLSpanElement>('entender-texto');

let modo: Modo = 'derivada';
let digitacao = 0;
let veioDeExemplo = true;
/** O exemplo do veículo em uso, para mostrar o problema e a leitura física do resultado. */
let exemploAtual: Exemplo | null = null;
let ultimaCena: Cena | null = null;

/**
 * O problema do carro e a leitura do resultado, nos modos Derivada, Integral e Integral definida,
 * quando a conta veio de um exemplo 🚗 deste modo, com este texto (e, na definida, estes limites).
 */
function textoDoExemplo(m: Modo, texto: string, limites?: { a: string; b: string }): string {
  const e = exemploAtual;
  if (!e?.contexto || e.f !== texto || !EXEMPLOS[m].includes(e)) return '';
  if (limites && (e.a !== limites.a || e.b !== limites.b)) return '';
  return `<p class="contexto">${escapar(e.contexto)}</p>${e.leitura ? `<p class="interpretacao">${escapar(e.leitura)}</p>` : ''}`;
}
let ultimosPassos: ItemPasso[] = [];
let aoTerminarDefinida: (() => void) | null = null;

const cenaDoCarro = new CenaCarro(elemento<HTMLDivElement>('cena-carro'), elemento<HTMLCanvasElement>('canvas-carro'));

const grafico = new Grafico(canvas, {
  aoLer: (texto) => {
    leitura.textContent = texto;
  },
  aoMover: (x) => cenaDoCarro.mover(x),
  aoSomar: (n, soma) => {
    placar.hidden = false;
    placar.innerHTML = `<span>${n} ${n === 1 ? 'retângulo' : 'retângulos'}</span><strong>${escapar(curto(soma))}</strong>`;
  },
  aoTerminar: () => aoTerminarDefinida?.(),
});

// ─── Contas ────────────────────────────────────────────────────────────────────

const avaliador =
  (e: Expr): Funcao =>
  (x) =>
    avaliar(e, { x });

/** O número como na aula: 1/2, √3/2, 2π/3, com o sinal de menos tipográfico. */
const bonito = numeroParaLer;

/**
 * Gráfico em múltiplos de π quando há seno, cosseno etc. e todos com argumento linear
 * (sen x, cos 3x). Com cos(x²) o eixo em π não ajuda e a janela de −2π a 2π vira um rabisco.
 */
function usaTrigonometria(e: Expr): boolean {
  let achou = false;
  let linear = true;
  const ehLinear = (u: Expr): boolean => {
    switch (u.tipo) {
      case 'num':
      case 'const':
      case 'var':
        return true;
      case 'soma':
      case 'sub':
        return ehLinear(u.a) && ehLinear(u.b);
      case 'mul':
        return ehLinear(u.a) && ehLinear(u.b) && !(contem(u.a, 'x') && contem(u.b, 'x'));
      case 'div':
        return ehLinear(u.a) && !contem(u.b, 'x');
      case 'neg':
        return ehLinear(u.a);
      default:
        return false;
    }
  };
  const visitar = (u: Expr): void => {
    switch (u.tipo) {
      case 'func':
        if (TRIGONOMETRICAS.has(u.nome)) {
          achou = true;
          linear &&= ehLinear(u.arg);
        }
        visitar(u.arg);
        return;
      case 'soma':
      case 'sub':
      case 'mul':
      case 'div':
        visitar(u.a);
        visitar(u.b);
        return;
      case 'pot':
        visitar(u.base);
        visitar(u.exp);
        return;
      case 'neg':
        visitar(u.a);
        return;
      case 'log':
        visitar(u.arg);
        return;
      default:
        return;
    }
  };
  visitar(e);
  return achou && linear;
}

/** Pontos espalhados e "irregulares" em [−2,9; 2,9], para não cair só em valores notáveis. */
const PONTOS = Array.from({ length: 30 }, (_, i) => -2.9 + i * 0.2 + 0.0173);

/** Derivada conferida pela inclinação medida: (f(x + h) − f(x − h)) / 2h. */
function conferirDerivada(f: Funcao, df: Funcao): string {
  let total = 0;
  let certos = 0;
  for (const x of PONTOS) {
    const h = 1e-5 * Math.max(1, Math.abs(x));
    const [depois, antes, d] = [f(x + h), f(x - h), df(x)];
    if (![depois, antes, d].every(Number.isFinite)) continue;
    total++;
    if (Math.abs((depois - antes) / (2 * h) - d) <= 1e-4 * Math.max(1, Math.abs(d))) certos++;
  }
  if (total < 3) return '';
  return certos === total
    ? `✓ Conferido: a inclinação medida na curva bate com f′(x) em ${total} pontos.`
    : `Atenção: em ${total - certos} de ${total} pontos a inclinação medida não bateu com f′(x).`;
}

/** "Verifique o resultado derivando!" (Aula 4, quadro 12), com o motor de derivadas. */
function conferirIntegral(f: Expr, F: Expr): string {
  let dF: Expr;
  try {
    dF = derivar(F).resultado;
  } catch {
    return '';
  }
  const [fn, dfn] = [avaliador(f), avaliador(dF)];
  let total = 0;
  let certos = 0;
  for (const x of PONTOS) {
    const [a, b] = [fn(x), dfn(x)];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    total++;
    if (Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a))) certos++;
  }
  if (total < 3) return '';
  return certos === total
    ? '✓ Verifique derivando (Aula 4, quadro 12): o motor de derivadas deriva F(x) e volta a f(x).'
    : 'Atenção: derivando F(x) não voltou a f(x) em todos os pontos.';
}

/** +∞, −∞ ou o número: uma ponta do intervalo de integração. */
const pontaDoIntervalo = (v: number): string => (Number.isFinite(v) ? bonito(v) : v > 0 ? '+∞' : '−∞');
/** O limite de integração como fórmula; no infinito, o símbolo. */
const limiteHTML = (e: Expr): string => (e.tipo === 'num' && !Number.isFinite(e.valor) ? escapar(pontaDoIntervalo(e.valor)) : formulaHTML(e));

/** O limite de integração escrito no chip do exemplo: inf vira +∞. */
const limiteDoChip = (texto: string): string => (texto === 'inf' ? '+∞' : texto === '-inf' ? '−∞' : formulaHTML(lerExpressao(texto)));

/** A integral definida conferida por uma soma de Riemann bem fina. */
function conferirDefinida(r: ResultadoIntegralDefinida, a: number, b: number): string {
  if (r.valor === 'diverge') return '';
  if (r.noInfinito) return 'Integral imprópria: o intervalo não tem fim, então o valor é um limite de F, e não dá para conferir com um número finito de retângulos.';
  const soma = somaDeRiemann(avaliador(r.entrada), a, b, 4000);
  if (!Number.isFinite(soma)) return '';
  const bate = Math.abs(soma - r.valor) <= 1e-3 * Math.max(1, Math.abs(r.valor));
  const devagar = r.descontinuidades.length > 0 ? ' Na integral imprópria as somas chegam devagar.' : '';
  return bate
    ? `✓ Conferido: a soma de Riemann com 4000 retângulos dá ${curto(soma)}, que bate com ${bonito(r.valor)}.`
    : `A soma de Riemann com 4000 retângulos dá ${curto(soma)}.${devagar}`;
}

// ─── Passos ────────────────────────────────────────────────────────────────────

function passoDaDerivada(p: { regra: Regra; expressao: Expr; expansao: Expr }): ItemPasso {
  return { etiqueta: p.regra, html: `${formulaHTML(derivada(p.expressao))}${IGUAL}${formulaHTML(p.expansao)}` };
}

function passoDaIntegral(p: PassoIntegral): ItemPasso {
  const v = `<i class="v">${escapar(p.variavel)}</i>`;
  const conta = `${integralHTML(p.integrando, p.variavel)}${IGUAL}${formulaHTML(p.expansao)}`;
  const s = p.substituicao;
  if (!s) return { etiqueta: p.regra, html: conta + (temPendencia(p.expansao) ? '' : MAIS_C) };
  const u = `<i class="v">${escapar(s.variavel)}</i>`;
  // du = dx, e não du = 1 dx; soma vai entre parênteses: du = (2x + 1) dx
  const parenteses = s.du.tipo === 'soma' || s.du.tipo === 'sub';
  const du = s.du.tipo === 'num' && s.du.valor === 1 ? `d${v}` : `${parenteses ? '(' : ''}${formulaHTML(s.du)}${parenteses ? ')' : ''} d${v}`;
  const troca = `<span class="troca">${u}${IGUAL}${formulaHTML(s.u)}, d${u}${IGUAL}${du}</span>`;
  const volta = s.volta ? `${IGUAL}${formulaHTML(s.volta.emU)}${MAIS_C}${IGUAL}${formulaHTML(s.volta.emX)}${MAIS_C}` : '';
  return { etiqueta: 'substituição', html: `${troca}<br>${conta}${volta}` };
}

function passosDaDefinida(r: ResultadoIntegralDefinida, a: number, b: number): ItemPasso[] {
  const F = r.primitiva.resultado;
  const itens: ItemPasso[] = [{ etiqueta: 'primitiva', html: `F(${X})${IGUAL}${formulaHTML(F)}` }];
  const intervalo = `[${bonito(Math.min(a, b))}, ${bonito(Math.max(a, b))}]`;
  if (r.descontinuidades.length > 0) {
    const pontos = r.descontinuidades.map(bonito).join(', ');
    const fim =
      r.valor === 'diverge'
        ? 'F também não tem valor aí, então a integral imprópria <strong>diverge</strong>. A conta ingênua F(b) − F(a) daria um número errado.'
        : 'Mas F tem valor aí: a integral imprópria converge.';
    itens.push({
      etiqueta: 'descontinuidade',
      html: `<span class="texto">f não existe em ${X} = ${escapar(pontos)}, dentro de ${escapar(intervalo)}, e o TFC pede f contínua em [a, b]. ${fim}</span>`,
    });
  }
  if (r.noInfinito) {
    const quanto = (L: (typeof r.noInfinito)[number]): string => (typeof L === 'number' ? bonito(L) : L === '-∞' ? '−∞' : (L ?? ''));
    const limites = ([a, b] as const)
      .map((v, i) => [v, r.noInfinito![i as 0 | 1]] as const)
      .filter(([v]) => !Number.isFinite(v))
      .map(([v, L]) => `F(${escapar(pontaDoIntervalo(v))}) é o limite de F(${X}) com ${X} → ${escapar(pontaDoIntervalo(v))}, que ${L === 'oscila' || L === 'não existe' || L === 'sem valor' ? 'não existe' : `vale ${escapar(quanto(L))}`}`);
    const fim = r.valor === 'diverge' ? ' Esse limite não é um número: a integral imprópria <strong>diverge</strong>.' : '';
    itens.push({ etiqueta: 'imprópria', html: `<span class="texto">O intervalo não tem fim: ${limites.join('; ')}.${fim}</span>` });
    if (r.valor === 'diverge') return itens;
    const Fde = (v: number, i: 0 | 1): number => (Number.isFinite(v) ? avaliador(F)(v) : (r.noInfinito![i] as number));
    const [Fa, Fb] = [Fde(a, 0), Fde(b, 1)];
    const subtraendo = Fa < 0 ? `(${escapar(bonito(Fa))})` : escapar(bonito(Fa));
    itens.push({
      etiqueta: 'tfc',
      html: `F(${limiteHTML(r.b)})<span class="op">−</span>F(${limiteHTML(r.a)})${IGUAL}${escapar(bonito(Fb))}<span class="op">−</span>${subtraendo}${IGUAL}${escapar(bonito(r.valor))}`,
    });
    return itens;
  }
  if (r.valor === 'diverge') return itens;
  const Fx = avaliador(F);
  const [limA, limB] = [formulaHTML(r.a), formulaHTML(r.b)];
  if (r.entrada.tipo === 'func' && r.entrada.nome === 'abs') {
    const marcos = [Math.min(a, b), ...r.cortes, Math.max(a, b)];
    if (r.cortes.length > 0) {
      itens.push({
        etiqueta: 'módulo',
        html: `<span class="texto">${formulaHTML(r.primitiva.entrada)} troca de sinal em ${X} = ${escapar(r.cortes.map(bonito).join(', '))}: o intervalo é cortado aí e cada pedaço entra com o seu módulo.</span>`,
      });
    }
    const trechos = marcos
      .slice(1)
      .map((t, i) => `|F(${escapar(bonito(t))}) − F(${escapar(bonito(marcos[i]!))})|`)
      .join(' + ');
    itens.push({ etiqueta: 'tfc', html: `Área${IGUAL}${trechos}${IGUAL}${escapar(bonito(Math.abs(r.valor)))}` });
    return itens;
  }
  const [Fa, Fb] = [Fx(a), Fx(b)];
  const subtraendo = Fa < 0 ? `(${escapar(bonito(Fa))})` : escapar(bonito(Fa));
  itens.push({
    etiqueta: 'tfc',
    html: `F(${limB})<span class="op">−</span>F(${limA})${IGUAL}${escapar(bonito(Fb))}<span class="op">−</span>${subtraendo}${IGUAL}${escapar(bonito(r.valor))}`,
  });
  return itens;
}

// ─── Mostrar ───────────────────────────────────────────────────────────────────

function etiquetaHTML(e: Etiqueta): string {
  const { nome, cor } = ETIQUETAS[e];
  return `<span class="regra" style="--cor: ${cor}">${escapar(nome)}</span>`;
}

function reiniciarAnimacao(el: HTMLElement, classe: string): void {
  el.classList.remove('novo', 'erro');
  void el.offsetWidth; // força o navegador a recomeçar a animação
  el.classList.add(classe);
}

function mostrarResultado(titulo: string, formula: string, regras: readonly Etiqueta[], conferencia: string, extra = ''): void {
  reiniciarAnimacao(resultado, 'novo');
  resultado.innerHTML = `
    <p class="resultado-titulo">${escapar(titulo)}</p>
    <div class="formula formula-grande">${formula}</div>
    <div class="regras" aria-label="Regras usadas">${regras.map(etiquetaHTML).join('')}</div>
    ${extra}
    ${conferencia ? `<p class="conferencia">${escapar(conferencia)}</p>` : ''}`;
  celebrar();
}

function mostrarPassos(itens: ItemPasso[]): void {
  ultimosPassos = itens;
  listaPassos.innerHTML = itens
    .map((p, i) => `<li class="passo" style="--i: ${i}">${etiquetaHTML(p.etiqueta)}<div class="passo-formula formula">${p.html}</div></li>`)
    .join('');
}

function mostrarNoGrafico(cena: Cena, descricao: string, itensDaLegenda: [string, string][]): void {
  ultimaCena = cena;
  canvas.setAttribute('aria-label', descricao);
  legenda.innerHTML = itensDaLegenda.map(([nome, cor]) => `<span style="--cor: ${cor}"><span>${nome}</span></span>`).join('');
  leitura.textContent = '';
  placar.hidden = true;
  grafico.mostrar(cena);
}

function mostrarDerivada(texto: string): void {
  const r = derivar(texto);
  const [f, df] = [avaliador(r.entrada), avaliador(r.resultado)];
  mostrarResultado(
    'Derivada',
    `<span class="nome-funcao">f′(${X})</span>${IGUAL}${formulaHTML(r.resultado)}`,
    r.regrasUsadas,
    conferirDerivada(f, df),
    textoDoExemplo('derivada', texto),
  );
  mostrarPassos(r.passos.map(passoDaDerivada));
  mostrarNoGrafico(
    { tipo: 'derivada', f, derivada: df, trigonometrica: usaTrigonometria(r.entrada) },
    `Gráfico de f(x) = ${paraTexto(r.entrada)} e de f′(x) = ${paraTexto(r.resultado)}, com a reta tangente percorrendo a curva.`,
    [
      [`f(${X})`, 'var(--cor-f)'],
      [`f′(${X})`, 'var(--cor-segunda)'],
      ['reta tangente', 'var(--cor-tangente)'],
    ],
  );
}

function mostrarIntegral(texto: string): void {
  const r = integrar(texto);
  const F = r.resultado;
  mostrarResultado(
    'Integral indefinida',
    `${integralHTML(r.entrada, 'x')}${IGUAL}${formulaHTML(F)}${MAIS_C}`,
    r.regrasUsadas,
    conferirIntegral(r.entrada, F),
    textoDoExemplo('integral', texto),
  );
  mostrarPassos(r.passos.map(passoDaIntegral));
  mostrarNoGrafico(
    { tipo: 'integral', f: avaliador(r.entrada), primitiva: avaliador(F), trigonometrica: usaTrigonometria(r.entrada) },
    `Gráfico de f(x) = ${paraTexto(r.entrada)} e da primitiva F(x) = ${paraTexto(F)}, com a área acumulada até o ponto que se move.`,
    [
      [`f(${X})`, 'var(--cor-f)'],
      [`F(${X}): área acumulada`, 'var(--cor-segunda)'],
    ],
  );
}

function mostrarDefinida(texto: string): void {
  const r = integralDefinida(texto, campoA.value.trim() || '0', campoB.value.trim() || '1');
  const [a, b] = [avaliar(r.a), avaliar(r.b)];
  // no gráfico, o intervalo sem fim aparece cortado: 8 unidades a partir da ponta finita
  const [ga, gb] = Number.isFinite(a) && Number.isFinite(b) ? [a, b] : !Number.isFinite(a) && !Number.isFinite(b) ? [Math.sign(a) * 6, Math.sign(b) * 6] : Number.isFinite(a) ? [a, a + Math.sign(b) * 8] : [b + Math.sign(a) * 8, b];
  const rotulo = (v: number): string => (Number.isFinite(v) ? bonito(v) : v > 0 ? '+∞ (segue)' : '−∞ (segue)');
  const diverge = r.valor === 'diverge';
  const valor = typeof r.valor === 'number' ? r.valor : Number.NaN;
  const final = diverge
    ? '<span class="diverge">diverge</span>'
    : `<span class="valor" aria-hidden="true">${escapar(bonito(valor))}</span><span class="so-leitor">${escapar(bonito(valor))}</span>`;
  mostrarResultado(
    'Integral definida',
    `${integralHTML(r.entrada, 'x', { a: limiteHTML(r.a), b: limiteHTML(r.b) })}${IGUAL}${final}`,
    diverge ? [r.noInfinito ? 'imprópria' : 'descontinuidade'] : [...(r.noInfinito ? (['imprópria'] as const) : []), 'tfc', ...r.primitiva.regrasUsadas],
    conferirDefinida(r, a, b),
    textoDoExemplo('definida', texto, { a: campoA.value.trim(), b: campoB.value.trim() }),
  );
  if (!diverge) contarAte(resultado.querySelector<HTMLElement>('.valor'), valor);
  mostrarPassos([...r.primitiva.passos.map(passoDaIntegral), ...passosDaDefinida(r, a, b)]);
  aoTerminarDefinida = () => {
    placar.hidden = false;
    placar.innerHTML = diverge
      ? '<span>as somas crescem sem parar</span><strong class="diverge">diverge</strong>'
      : `<span>${r.noInfinito ? 'área até o infinito' : 'área exata pelo TFC'}</span><strong>${escapar(bonito(valor))}</strong>`;
  };
  mostrarNoGrafico(
    {
      tipo: 'definida',
      f: avaliador(r.entrada),
      a: ga,
      b: gb,
      rotulos: [rotulo(a), rotulo(b)],
      diverge,
      singularidades: r.descontinuidades,
      trigonometrica: usaTrigonometria(r.entrada),
    },
    `Gráfico de f(x) = ${paraTexto(r.entrada)} de ${pontaDoIntervalo(a)} a ${pontaDoIntervalo(b)}, com retângulos de Riemann que se multiplicam até virar a área.`,
    [
      [`f(${X})`, 'var(--cor-f)'],
      ['área positiva', 'var(--cor-f)'],
      ['área negativa', 'var(--erro)'],
    ],
  );
}

// ─── Funções (Aula 1) ──────────────────────────────────────────────────────────

/**
 * Confere a análise pela própria função, em 601 entradas da janela: as do domínio têm saída
 * dentro da imagem, as de fora não têm saída, e f zera nas raízes.
 */
function conferirFuncao(a: AnaliseFuncao, [x0, x1]: [number, number]): string {
  const f = avaliador(a.entrada);
  let dentro = 0;
  let fora = 0;
  let falhas = 0;
  for (let i = 0; i <= 600; i++) {
    const t = x0 + ((x1 - x0) * i) / 600 + 1e-7;
    const y = f(t);
    if (pertence(a.dominio, t)) {
      dentro++;
      if (!pertence(a.imagem, y, 1e-9)) falhas++;
    } else {
      fora++;
      if (!Number.isNaN(y)) falhas++;
    }
  }
  if (falhas > 0 || !a.raizes.valores.every((r) => Math.abs(f(r)) < 1e-9)) {
    return 'Atenção: em alguma entrada do gráfico, a função não bateu com o domínio, a imagem ou as raízes.';
  }
  const raizes = a.raizes.valores.length === 0 ? '' : `, e f vale 0 ${a.raizes.valores.length === 1 ? 'na raiz' : 'nas raízes'}`;
  const semSaida = fora > 0 ? `, as ${fora} de fora não têm saída` : '';
  return `✓ Conferido em ${dentro + fora} entradas do gráfico: as ${dentro} do domínio deram saídas dentro de Im(f) = ${a.imagem.texto}${semSaida}${raizes}.`;
}

/** A tabela de entradas e saídas, deitada: x em cima, f(x) embaixo. */
function tabelaDeEntradas(a: AnaliseFuncao, entradas?: number[]): string {
  const linhas = tabelaDaFuncao(a, entradas);
  const xs = linhas.map((l) => `<td>${escapar(numeroDaAnalise(a, l.x))}</td>`).join('');
  const ys = linhas
    .map((l) => (l.y === null ? '<td class="fora" title="fora do domínio">∄</td>' : `<td>${escapar(numeroDaAnalise(a, l.y))}</td>`))
    .join('');
  return `<div class="entradas-saidas"><table class="tabela tabela-deitada"><caption>Entradas e saídas</caption><tbody><tr><th scope="row">${X}</th>${xs}</tr><tr><th scope="row">f(${X})</th>${ys}</tr></tbody></table></div>`;
}

/** A entrada da conta de exemplo: um valor do meio da tabela (na trigonométrica, π/3). */
function sugestaoDeEntrada(a: AnaliseFuncao): string {
  const indice = a.tipo === 'trigonométrica' ? 3 : Math.ceil(a.entradas.length / 2);
  return numeroBonito(a.entradas[Math.min(indice, a.entradas.length - 1)] ?? 1);
}

function avaliadorHTML(inicial: string): string {
  return `<form class="avaliar" id="avaliar" autocomplete="off">
    <label class="avaliar-titulo" for="avaliar-x">Calcule uma saída</label>
    <span class="avaliar-conta formula"><span class="nome-funcao">f(</span><input id="avaliar-x" value="${escapar(inicial)}" spellcheck="false" autocapitalize="off" aria-describedby="avaliar-saida" /><span class="nome-funcao">)</span><output id="avaliar-saida" for="avaliar-x"></output></span>
  </form>`;
}

/** O aluno digita uma entrada e vê a conta, f(3) = 3² − 4·3 − 5 = −8; o ponto do gráfico vai junto. */
function ligarAvaliador(a: AnaliseFuncao, [x0, x1]: [number, number]): void {
  const form = resultado.querySelector<HTMLFormElement>('#avaliar');
  const entrada = resultado.querySelector<HTMLInputElement>('#avaliar-x');
  const saida = resultado.querySelector<HTMLOutputElement>('#avaliar-saida');
  if (!form || !entrada || !saida) return;
  const atualizar = (moverGrafico: boolean): void => {
    const texto = entrada.value.trim();
    if (!texto) {
      saida.innerHTML = '';
      if (moverGrafico) grafico.destacar(null);
      return;
    }
    try {
      const v = calcularEm(a, texto);
      if (v.y === null) {
        saida.innerHTML = ` <span class="fora">não existe: ${escapar(numeroDaAnalise(a, v.x))} está fora do domínio, D(f) = ${escapar(a.dominio.texto)}</span>`;
      } else {
        const [sinal, ...valor] = igualdadeDaAnalise(a, v.y).split(' ');
        saida.innerHTML = `${IGUAL}${formulaHTML(v.conta)}<span class="op">${sinal}</span><span class="valor">${escapar(valor.join(' '))}</span>`;
      }
      if (moverGrafico) grafico.destacar(v.x >= x0 && v.x <= x1 ? v.x : null);
    } catch (erro) {
      saida.innerHTML = ` <span class="fora">${escapar(erro instanceof ErroDeEntrada ? erro.message : 'Não consegui ler esse número.')}</span>`;
      if (moverGrafico) grafico.destacar(null);
    }
  };
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    atualizar(true);
  });
  entrada.addEventListener('input', () => atualizar(true));
  atualizar(false);
}

/** Os pontos notáveis com etiqueta; com muitas raízes (seno, tangente), só as bolinhas. */
function pontosDoGrafico(a: AnaliseFuncao): PontoDoGrafico[] {
  const raizes = a.pontos.filter((p) => p.nome === 'raiz').length;
  const coordenadas = (p: { x: number; y: number }): string => `(${numeroDaAnalise(a, p.x)}, ${numeroDaAnalise(a, p.y)})`;
  return a.pontos.map((p) => {
    let rotulo = coordenadas(p);
    if (p.nome === 'raiz') rotulo = raizes <= 3 ? `raiz ${numeroDaAnalise(a, p.x)}` : '';
    else if (p.nome === 'vértice') rotulo = `${a.tipo === 'modular' ? 'bico' : 'vértice'} ${coordenadas(p)}`;
    else if (p.nome === 'máximo' || p.nome === 'mínimo') rotulo = `${p.nome} ${coordenadas(p)}`;
    return { ...p, rotulo };
  });
}

function mostrarFuncao(texto: string): void {
  const a = analisarFuncao(texto);
  const exemplo = exemploAtual?.f === texto ? exemploAtual : null;
  const janela = exemplo?.janela ?? a.janela;
  const outraForma = paraTexto(a.forma) !== paraTexto(a.entrada);
  const formula = `<span class="nome-funcao">f(${X})</span>${IGUAL}${formulaHTML(a.entrada)}${outraForma ? `${IGUAL}${formulaHTML(a.forma)}` : ''}`;
  const ficha: [string, string, string][] = [
    ['Domínio', `D(f) = ${a.dominio.texto}`, 'dominio'],
    ['Imagem', `Im(f) = ${a.imagem.texto}`, 'imagem'],
    ...a.caracteristicas.map((c): [string, string, string] => [c.nome, c.valor, '']),
  ];
  const extra = `
    <p class="forma-aula">Forma da aula: <span class="formula">${escapar(a.formaGeral)}</span>${a.parametrosTexto ? `, com ${escapar(a.parametrosTexto)}` : ''}</p>
    ${a.avisos.map((aviso) => `<p class="aviso">${escapar(aviso)}</p>`).join('')}
    <dl class="ficha">${ficha
      .map(([nome, valor, classe], i) => `<div class="${classe}" style="--i: ${i}"><dt>${escapar(nome)}</dt><dd>${escapar(valor)}</dd></div>`)
      .join('')}</dl>
    ${exemplo?.contexto ? `<p class="contexto">${escapar(exemplo.contexto)}</p>` : ''}
    <p class="interpretacao">${escapar(exemplo?.leitura ?? a.interpretacao)}</p>
    ${tabelaDeEntradas(a, exemplo?.entradas)}
    ${avaliadorHTML(exemplo?.avaliar ?? sugestaoDeEntrada(a))}`;
  mostrarResultado(a.nome, formula, [a.tipo], conferirFuncao(a, janela), extra);
  ligarAvaliador(a, janela);
  mostrarPassos(a.passos.map((p) => ({ etiqueta: p.aspecto, html: `<span class="texto">${escapar(p.texto)}</span>` })));
  mostrarNoGrafico(
    {
      tipo: 'funcao',
      f: avaliador(a.entrada),
      trigonometrica: a.tipo === 'trigonométrica',
      estudo: {
        janela,
        dominio: a.dominio.intervalos,
        furos: a.dominio.furos ? a.assintotas.verticais : [],
        imagem: a.imagem.intervalos,
        pontos: pontosDoGrafico(a),
        verticais: a.assintotas.verticais,
        horizontal: a.assintotas.horizontal,
      },
    },
    `Gráfico de f(x) = ${paraTexto(a.entrada)}, ${a.nome.toLowerCase()}. O domínio, ${a.dominio.texto}, aparece aceso no eixo x, e a imagem, ${a.imagem.texto}, no eixo y.`,
    [
      [`f(${X})`, 'var(--cor-f)'],
      ['domínio, no eixo x', 'var(--cor-dominio)'],
      ['imagem, no eixo y', 'var(--cor-imagem)'],
      ['pontos notáveis', '#facc15'],
    ],
  );
}

// ─── Limites (Aula 2) ──────────────────────────────────────────────────────────

/** f escrita como na aula; a por partes ganha a chave com as duas fórmulas. */
function funcaoHTML(f: FuncaoDoLimite): string {
  if (f.tipo === 'expressao') return formulaHTML(f.e);
  const c = formulaHTML(f.textoCorte);
  const [esq, dir] = f.corteNaEsquerda ? ['≤', '>'] : ['<', '≥'];
  return `<span class="partes"><span class="chave">{</span><span class="partes-linhas"><span>${formulaHTML(f.esquerda)}, se ${X} ${esq} ${c}</span><span>${formulaHTML(f.direita)}, se ${X} ${dir} ${c}</span></span></span>`;
}

const textoDoValor = (v: ValorLimite | 'não existe'): string =>
  typeof v === 'number' ? bonito(v) : v === '-∞' ? '−∞' : v === 'sem valor' ? 'não existe' : v;

function valorHTML(v: ValorLimite | 'não existe'): string {
  const classe = typeof v === 'number' || v === '+∞' || v === '-∞' ? 'valor' : 'diverge';
  return `<span class="${classe}">${escapar(textoDoValor(v))}</span>`;
}

/** lim com o ponto embaixo: x → 2, x → 2⁻, x → +∞. */
function limHTML(r: ResultadoLimite, lado = ''): string {
  const ponto = r.ponto ? formulaHTML(r.ponto) : r.a > 0 ? '+∞' : '−∞';
  return `<span class="lim"><span class="lim-nome">lim</span><span class="lim-sub">${X} → ${ponto}${lado}</span></span><span class="esp"></span>`;
}

/** A tabela de valores da "ideia intuitiva" (quadro 1): x chegando perto de a por cada lado. */
function tabelaDeValores(r: ResultadoLimite): string {
  const f = (t: number): number => avaliarFuncao(r.funcao, t);
  const numero = (v: number): string => (Number.isFinite(v) ? String(Number(v.toPrecision(6))).replace('-', '−') : '—');
  const tabela = (titulo: string, xs: number[]): string =>
    `<table class="tabela"><caption>${titulo}</caption><thead><tr><th>${X}</th><th>f(${X})</th></tr></thead><tbody>${xs
      .map((t) => `<tr><td>${numero(t)}</td><td>${numero(f(t))}</td></tr>`)
      .join('')}</tbody></table>`;
  if (!Number.isFinite(r.a)) {
    const sinal = r.a > 0 ? 1 : -1;
    return `<div class="tabelas">${tabela(sinal > 0 ? 'x crescendo' : 'x decrescendo', [10, 100, 1000, 1e4, 1e5].map((t) => sinal * t))}</div>`;
  }
  const passos = [0.1, 0.01, 0.001, 0.0001].map((h) => h * Math.max(1, Math.abs(r.a)));
  return `<div class="tabelas">${tabela('Chegando pela esquerda', passos.map((h) => r.a - h))}${tabela('Chegando pela direita', passos.map((h) => r.a + h))}</div>`;
}

/** Confere o motor pela tabela: bem perto de a (ou bem longe, no infinito), f já está perto do limite. */
function conferirLimite(r: ResultadoLimite): string {
  const f = (t: number): number => avaliarFuncao(r.funcao, t);
  const perto = (v: number, alvo: ValorLimite | 'não existe' | undefined): boolean | null => {
    if (typeof alvo === 'number') return Math.abs(v - alvo) <= 1e-3 * Math.max(1, Math.abs(alvo));
    if (alvo === '+∞') return v > 1e3;
    if (alvo === '-∞') return v < -1e3;
    return null;
  };
  if (!Number.isFinite(r.a)) {
    const t = r.a > 0 ? 1e6 : -1e6;
    const ok = perto(f(t), r.limite);
    return ok ? `✓ Conferido: em x = ${curto(t)}, f(x) = ${curto(f(t))}, já colado no limite.` : '';
  }
  const h = 1e-6 * Math.max(1, Math.abs(r.a));
  const [esq, dir] = [perto(f(r.a - h), r.esquerda), perto(f(r.a + h), r.direita)];
  if (esq === null && dir === null) return '';
  if (esq === false || dir === false) return 'Atenção: bem perto do ponto, a tabela de valores não confirmou o resultado.';
  return '✓ Conferido na tabela: a um milionésimo do ponto, f(x) já está colado no valor de cada limite lateral.';
}

function etiquetaDaContinuidade(r: ResultadoLimite): string {
  if (!Number.isFinite(r.a)) return '';
  const cor = r.descontinuidade ? '#fb7185' : '#4ade80';
  const nome = r.descontinuidade
    ? `Descontinuidade ${r.descontinuidade === 'salto' ? 'de salto' : r.descontinuidade}`
    : typeof r.limite === 'number'
      ? `Contínua em x = ${bonito(r.a)}`
      : '';
  return nome ? `<span class="regra" style="--cor: ${cor}">${escapar(nome)}</span>` : '';
}

function passoDoLimite(p: PassoLimite): ItemPasso {
  const contas = p.contas?.length ? `<div class="contas">${p.contas.map(formulaHTML).join(IGUAL)}</div>` : '';
  return { etiqueta: p.tecnica, html: `<span class="texto">${escapar(p.texto)}</span>${contas}` };
}

function mostrarLimite(texto: string): void {
  const r = calcularLimite(texto, campoPonto.value.trim() || '0');
  const f = r.funcao;
  const nomeDaFuncao = f.tipo === 'expressao' ? funcaoHTML(f) : `f(${X})`;
  // ln 2 ganha o valor aproximado ao lado; 3/2 já se lê sozinho
  const exatoComFuncao = r.exato !== undefined && JSON.stringify(r.exato).includes('"func"');
  const principal = !r.exato
    ? valorHTML(r.limite)
    : exatoComFuncao
      ? `${formulaHTML(r.exato)}<span class="op">≈</span>${escapar(curto(r.limite as number))}`
      : `<span class="valor">${formulaHTML(r.exato)}</span>`;
  const laterais =
    Number.isFinite(r.a) && r.esquerda !== undefined && r.direita !== undefined && (r.limite === 'não existe' || r.esquerda !== r.direita)
      ? `<div class="laterais"><span>${limHTML(r, '<sup>−</sup>')}f(${X})${IGUAL}${valorHTML(r.esquerda)}</span><span>${limHTML(r, '<sup>+</sup>')}f(${X})${IGUAL}${valorHTML(r.direita)}</span></div>`
      : '';
  const tecnicas = [...new Set(r.passos.map((p) => p.tecnica))].filter(
    (t) => t !== 'forma indeterminada' && t !== 'limites laterais' && t !== 'continuidade',
  );
  const exemplo = exemploAtual?.f === texto ? exemploAtual : null;
  const extra = `
    ${laterais}
    <div class="regras">${etiquetaDaContinuidade(r)}</div>
    ${exemplo?.contexto ? `<p class="contexto">${escapar(exemplo.contexto)}</p>` : ''}
    <p class="interpretacao">${escapar(exemplo?.leitura ?? r.interpretacao)}</p>
    ${tabelaDeValores(r)}`;
  mostrarResultado('Limite', `${limHTML(r)}${nomeDaFuncao}${IGUAL}${principal}`, tecnicas, conferirLimite(r), extra);
  mostrarPassos(r.passos.map(passoDoLimite));
  const noGrafico = (v: ValorLimite | 'não existe' | undefined): ValorLimite => (v === undefined || v === 'não existe' ? 'sem valor' : v);
  const lado = (v: ValorLimite | undefined): ValorLimite => noGrafico(Number.isFinite(r.a) ? v : r.limite);
  mostrarNoGrafico(
    {
      tipo: 'limite',
      f: (t) => avaliarFuncao(f, t),
      a: r.a,
      esquerda: lado(r.esquerda),
      direita: lado(r.direita),
      valorEmA: r.valorEmA,
      corte: f.tipo === 'partes' ? f.corte : null,
      rotuloPonto: Number.isFinite(r.a) ? bonito(r.a) : r.a > 0 ? '+∞' : '−∞',
      trigonometrica: f.tipo === 'expressao' && usaTrigonometria(f.e),
    },
    `Gráfico de f perto de x = ${Number.isFinite(r.a) ? bonito(r.a) : r.a > 0 ? 'mais infinito' : 'menos infinito'}, com pontos que se aproximam pelos dois lados. ${r.interpretacao}`,
    Number.isFinite(r.a)
      ? [
          [`f(${X})`, 'var(--cor-f)'],
          ['chegando pela esquerda', 'var(--cor-segunda)'],
          ['chegando pela direita', 'var(--cor-tangente)'],
        ]
      : [
          [`f(${X})`, 'var(--cor-f)'],
          ['x indo ao infinito', 'var(--cor-tangente)'],
        ],
  );
}

function mostrarErro(mensagem: string, texto: string): void {
  reiniciarAnimacao(resultado, 'erro');
  resultado.innerHTML = `<p class="resultado-titulo">Não deu para calcular</p><p class="mensagem-erro">${escapar(mensagem)}</p>`;
  ultimosPassos = [];
  listaPassos.innerHTML = '<li class="vazio">O passo a passo aparece aqui quando a conta der certo.</li>';
  try {
    const f = modo === 'limite' ? lerFuncaoDoLimite(texto) : ({ tipo: 'expressao', e: lerExpressao(texto) } as const);
    mostrarNoGrafico(
      { tipo: 'funcao', f: (t) => avaliarFuncao(f, t), trigonometrica: f.tipo === 'expressao' && usaTrigonometria(f.e) },
      `Gráfico de f(x) = ${f.tipo === 'expressao' ? paraTexto(f.e) : 'por partes'}.`,
      [[`f(${X})`, 'var(--cor-f)']],
    );
  } catch {
    // a expressão nem foi lida: o gráfico fica como estava
  }
}

function calcular(): void {
  const texto = campo.value.trim();
  // o carro só aparece enquanto a conta é a do exemplo 🚗 aberto
  const e = exemploAtual;
  cenaDoCarro.mostrar(e?.cena && e.f === texto && EXEMPLOS[modo].includes(e) ? e.cena : null);
  if (!texto) {
    mostrarErro('Digite uma função para começar, ou toque num dos exemplos.', '');
    return;
  }
  try {
    if (modo === 'funcao') mostrarFuncao(texto);
    else if (modo === 'limite') mostrarLimite(texto);
    else if (modo === 'derivada') mostrarDerivada(texto);
    else if (modo === 'integral') mostrarIntegral(texto);
    else mostrarDefinida(texto);
  } catch (erro) {
    if (erro instanceof ErroDeEntrada) mostrarErro(erro.message, texto);
    else {
      console.error(erro);
      mostrarErro('Algo inesperado aconteceu nessa conta. Confira a expressão e tente de novo.', texto);
    }
  }
}

// ─── Efeitos ───────────────────────────────────────────────────────────────────

/** O número sobe de 0 até o valor, e no fim aparece escrito como na aula (π, 1/2…). */
function contarAte(el: HTMLElement | null, valor: number): void {
  if (!el || calmo || !Number.isFinite(valor)) return;
  const final = el.textContent ?? '';
  const inicio = performance.now();
  const passo = (agora: number): void => {
    const p = Math.min(1, (agora - inicio) / 1300);
    el.textContent = p < 1 ? curto(valor * (1 - (1 - p) ** 3)) : final;
    if (p < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

/** Símbolos de cálculo que explodem do resultado. */
function celebrar(): void {
  if (calmo) return;
  for (let i = 0; i < 16; i++) {
    const faisca = document.createElement('span');
    const angulo = (Math.PI * 2 * i) / 16 + Math.random() * 0.4;
    const distancia = 90 + Math.random() * 130;
    faisca.className = 'faisca';
    faisca.setAttribute('aria-hidden', 'true');
    faisca.textContent = SIMBOLOS[i % SIMBOLOS.length]!;
    faisca.style.setProperty('--dx', `${Math.cos(angulo) * distancia}px`);
    faisca.style.setProperty('--dy', `${Math.sin(angulo) * distancia * 0.6}px`);
    faisca.style.setProperty('--giro', `${(Math.random() - 0.5) * 540}deg`);
    faisca.style.setProperty('--cor', CORES[i % CORES.length]!);
    faisca.addEventListener('animationend', () => faisca.remove());
    resultado.append(faisca);
  }
}

/** Símbolos flutuando bem de leve no fundo. */
function criarFundo(): void {
  if (calmo) return;
  const fundo = elemento<HTMLDivElement>('fundo');
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('span');
    const duracao = 22 + Math.random() * 26;
    s.textContent = SIMBOLOS[Math.floor(Math.random() * SIMBOLOS.length)]!;
    s.style.setProperty('--x', `${Math.random() * 100}%`);
    s.style.setProperty('--tam', `${14 + Math.random() * 36}px`);
    s.style.setProperty('--dur', `${duracao}s`);
    s.style.setProperty('--atraso', `${-Math.random() * duracao}s`);
    s.style.setProperty('--giro', `${(Math.random() - 0.5) * 720}deg`);
    s.style.setProperty('--opacidade', `${0.05 + Math.random() * 0.1}`);
    s.style.setProperty('--cor', CORES[i % CORES.length]!);
    fundo.append(s);
  }
}

const esperar = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

/** O exemplo se digita sozinho no campo, letra por letra, e a conta sai em seguida. */
async function usarExemplo(exemplo: Exemplo): Promise<void> {
  const minha = ++digitacao;
  veioDeExemplo = true;
  exemploAtual = exemplo;
  if (exemplo.a !== undefined) campoA.value = exemplo.a;
  if (exemplo.b !== undefined) campoB.value = exemplo.b;
  if (exemplo.ponto !== undefined) campoPonto.value = exemplo.ponto;
  if (calmo) {
    campo.value = exemplo.f;
  } else {
    campo.value = '';
    campo.classList.add('digitando');
    for (const letra of exemplo.f) {
      if (minha !== digitacao) return;
      campo.value += letra;
      atualizarPrevia();
      await esperar(34);
    }
    campo.classList.remove('digitando');
  }
  if (minha !== digitacao) return;
  atualizarPrevia();
  calcular();
}

function atualizarPrevia(): void {
  const texto = campo.value.trim();
  if (!texto) {
    previa.innerHTML = '';
    return;
  }
  try {
    const f: FuncaoDoLimite = modo === 'limite' ? lerFuncaoDoLimite(texto) : { tipo: 'expressao', e: lerExpressao(texto) };
    previa.innerHTML = `<span class="nome-funcao">f(${X})</span>${IGUAL}${funcaoHTML(f)}`;
    previa.classList.remove('incompleta');
  } catch {
    previa.classList.add('incompleta'); // fica a última leitura boa, apagada, até a expressão fechar
  }
}

function montarExemplos(): void {
  exemplos.replaceChildren(
    ...EXEMPLOS[modo].map((exemplo, i) => {
      const botao = document.createElement('button');
      const ponto = exemplo.ponto === undefined ? '' : exemplo.ponto === 'inf' ? '+∞' : formulaHTML(lerExpressao(exemplo.ponto));
      const limitesDoExemplo =
        exemplo.a !== undefined && exemplo.b !== undefined
          ? ` <span class="chip-limites">de ${limiteDoChip(exemplo.a)} a ${limiteDoChip(exemplo.b)}</span>`
          : ponto
            ? ` <span class="chip-limites">${X} → ${ponto}</span>`
            : '';
      botao.type = 'button';
      botao.className = 'chip formula';
      botao.style.setProperty('--i', String(i));
      botao.innerHTML = (exemplo.rotulo ? `<span class="chip-rotulo">${escapar(exemplo.rotulo)}</span>` : formulaHTML(lerExpressao(exemplo.f))) + limitesDoExemplo;
      const descricao = exemplo.a !== undefined ? ` de ${exemplo.a} a ${exemplo.b}` : exemplo.ponto !== undefined ? ` com x indo a ${exemplo.ponto}` : '';
      botao.setAttribute('aria-label', `Usar o exemplo ${exemplo.rotulo ?? exemplo.f}${descricao}`);
      botao.addEventListener('click', () => void usarExemplo(exemplo));
      return botao;
    }),
  );
}

/** O link da calculadora para a aula que explica o modo aberto. */
function apontarAula(m: Modo): void {
  entender.href = `#${AULA_DO_MODO[m].id}`;
  entenderTexto.textContent = AULA_DO_MODO[m].texto;
}

/** `exemplo`: a conta que vem do conteúdo das aulas, no lugar do primeiro exemplo do modo. */
function trocarModo(novo: Modo, exemplo?: Exemplo): void {
  modo = novo;
  modos.dataset.modo = novo;
  limites.hidden = novo !== 'definida';
  pontoDoLimite.hidden = novo !== 'limite';
  campo.placeholder = SUGESTAO[novo];
  apontarAula(novo);
  montarExemplos();
  // Conta que veio de um exemplo dá lugar ao primeiro exemplo do novo modo; a que o aluno digitou é refeita no novo modo.
  if (exemplo) void usarExemplo(exemplo);
  else if (veioDeExemplo || !campo.value.trim()) void usarExemplo(EXEMPLOS[novo][0]!);
  else calcular();
}

/**
 * Botão "Calcular" do conteúdo das aulas: a conta vai para a calculadora, no modo certo, e se
 * digita sozinha. Se ela é um dos exemplos do modo (os do veículo), vem com o problema e a leitura.
 */
function calcularConta(conta: Conta): void {
  const radio = document.getElementById(`modo-${conta.modo}`) as HTMLInputElement | null;
  if (radio) radio.checked = true;
  const conhecido = EXEMPLOS[conta.modo].find((e) => e.f === conta.f && e.ponto === conta.ponto && e.a === conta.a && e.b === conta.b);
  const exemplo: Exemplo = conhecido ?? { f: conta.f };
  if (!conhecido) {
    if (conta.ponto !== undefined) exemplo.ponto = conta.ponto;
    if (conta.a !== undefined) exemplo.a = conta.a;
    if (conta.b !== undefined) exemplo.b = conta.b;
  }
  navegacao.irPara('calculadora');
  trocarModo(conta.modo, exemplo);
  radio?.focus({ preventScroll: true });
}

// ─── Ligações ──────────────────────────────────────────────────────────────────

formulario.addEventListener('submit', (ev) => {
  ev.preventDefault();
  digitacao++;
  calcular();
});

campo.addEventListener('input', () => {
  digitacao++;
  veioDeExemplo = false;
  exemploAtual = null;
  campo.classList.remove('digitando');
  atualizarPrevia();
});

modos.querySelectorAll<HTMLInputElement>('input[name="modo"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    if (radio.checked) trocarModo(radio.value as Modo);
  });
});

rever.addEventListener('click', () => {
  listaPassos.innerHTML = '';
  requestAnimationFrame(() => mostrarPassos(ultimosPassos));
  if (ultimaCena) {
    placar.hidden = true;
    grafico.mostrar(ultimaCena);
  }
});

if (calmo) document.querySelectorAll('animateMotion').forEach((animacao) => animacao.remove());
criarFundo();
montarExemplos();
apontarAula(modo);
const navegacao = iniciarConteudo(calcularConta);
// Só se o aluno ainda não trocou de modo nem digitou nada nesse meio-tempo
setTimeout(() => {
  if (digitacao === 0 && modo === 'derivada') void usarExemplo(EXEMPLOS.derivada[0]!);
}, calmo ? 0 : 700);
