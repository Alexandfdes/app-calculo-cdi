/**
 * Casos de teste tirados dos slides de CDI (Aulas 1 a 4) e das armadilhas do projeto.
 *
 * - Todo valor esperado é conferido por um oráculo independente (oraculo.ts, com math.js).
 * - Onde o slide erra, o caso traz o valor CERTO. `erroNoSlide` descreve o erro e, quando
 *   dá, traz o valor do slide, para o teste provar que ele seria reprovado.
 * - Notação da aula: sen, tg, cotg, sec, csc, ln. Logaritmo em outra base sempre com a base
 *   explícita: log(x, 10). Ângulos em radianos. Multiplicação sempre explícita (2*x).
 * - A variável é sempre x (nos casos do tema, x faz o papel do tempo t).
 */

export type Intervalo = [number, number];

export const REGRAS_DERIVACAO = ['constante', 'potência', 'soma/subtração', 'produto', 'quociente', 'cadeia'] as const;
export const REGRAS_INTEGRACAO = ['constante', 'potência', 'soma/subtração', 'exponencial', 'trigonométrica', 'substituição'] as const;
export type RegraDerivacao = (typeof REGRAS_DERIVACAO)[number];
export type RegraIntegracao = (typeof REGRAS_INTEGRACAO)[number];

/** Erro encontrado no slide: a descrição e, quando dá, os campos com o valor que o slide mostra. */
export type ErroNoSlide<T> = { descricao: string } & Partial<Omit<T, 'id' | 'fonte' | 'erroNoSlide'>>;

// ─── Aula 1 — Funções ──────────────────────────────────────────────────────────

export interface CasoQuadratica {
  id: string;
  fonte: string;
  a: number;
  b: number;
  c: number;
  delta: number;
  raizes: number[];
  vertice: [number, number];
  imagem: string;
  erroNoSlide?: ErroNoSlide<CasoQuadratica>;
}

export const quadraticas: CasoQuadratica[] = [
  {
    id: 'F01', fonte: 'Aula 1, slide da quadrática, quadro 4 (exemplo)',
    a: 1, b: -4, c: -5, delta: 36, raizes: [-1, 5], vertice: [2, -9], imagem: '[-9, +∞)',
  },
  {
    id: 'F02', fonte: 'Aula 1, slide da quadrática, quadro 2 (Elementos do gráfico)',
    a: 1, b: -2, c: 2, delta: -4, raizes: [], vertice: [1, 1], imagem: '[1, +∞)',
    erroNoSlide: {
      descricao: 'O desenho põe o vértice acima do eixo x, com a > 0, e mesmo assim marca raízes x₁ e x₂. Nesse caso não há raiz real.',
    },
  },
  {
    id: 'F03', fonte: 'Aula 1, concavidade para baixo (a < 0)',
    a: -1, b: 4, c: 0, delta: 16, raizes: [0, 4], vertice: [2, 4], imagem: '(-∞, 4]',
  },
];

export interface CasoValidade {
  id: string;
  fonte: string;
  declarado: 'quadrática' | 'afim' | 'exponencial' | 'logarítmica';
  /** A função com os parâmetros que o usuário digitou. */
  f: string;
  /** O que o app deve fazer com essa entrada. */
  resposta: 'tratar como afim' | 'tratar como constante' | 'rejeitar';
  /** O fato matemático que justifica a resposta (é isso que o oráculo confere). */
  porque: 'vira afim' | 'vira constante' | 'sem valor real';
}

export const validade: CasoValidade[] = [
  { id: 'V01', fonte: 'Aula 1: quadrática exige a ≠ 0', declarado: 'quadrática', f: '0*x^2 + 2*x + 1', resposta: 'tratar como afim', porque: 'vira afim' },
  { id: 'V02', fonte: 'Aula 1: afim de 1º grau exige a ≠ 0', declarado: 'afim', f: '0*x + 3', resposta: 'tratar como constante', porque: 'vira constante' },
  { id: 'V03', fonte: 'Aula 1: exponencial exige a > 0 e a ≠ 1', declarado: 'exponencial', f: '1^x', resposta: 'rejeitar', porque: 'vira constante' },
  { id: 'V04', fonte: 'Aula 1: exponencial exige a > 0 e a ≠ 1', declarado: 'exponencial', f: '(-2)^x', resposta: 'rejeitar', porque: 'sem valor real' },
  { id: 'V05', fonte: 'Aula 1: logaritmo exige base > 0 e ≠ 1', declarado: 'logarítmica', f: 'log(x, 1)', resposta: 'rejeitar', porque: 'sem valor real' },
  { id: 'V06', fonte: 'Aula 1: logaritmo exige base > 0 e ≠ 1', declarado: 'logarítmica', f: 'log(x, -10)', resposta: 'rejeitar', porque: 'sem valor real' },
];

export interface CasoAngulo {
  id: string;
  fonte: string;
  graus: number;
  rad: string;
  cos: string;
  sen: string;
  tg: string;
  erroNoSlide?: ErroNoSlide<CasoAngulo>;
}

const TABELA = 'Aula 1, slide trigonométricas, quadro 4 (valores notáveis)';
const CICLO = 'Aula 1, slide trigonométricas, quadro 2 (ciclo)';

/** tg: 'indefinida' quando cos = 0. */
export const angulos: CasoAngulo[] = [
  { id: 'T01', fonte: TABELA, graus: 0, rad: '0', cos: '1', sen: '0', tg: '0' },
  { id: 'T02', fonte: TABELA, graus: 30, rad: 'pi/6', cos: 'sqrt(3)/2', sen: '1/2', tg: 'sqrt(3)/3' },
  {
    id: 'T03', fonte: `${TABELA}; ${CICLO}`, graus: 45, rad: 'pi/4', cos: 'sqrt(2)/2', sen: 'sqrt(2)/2', tg: '1',
    erroNoSlide: { descricao: 'No ciclo, 45° aparece como π/6.', rad: 'pi/6' },
  },
  {
    id: 'T04', fonte: `${TABELA}; ${CICLO}`, graus: 60, rad: 'pi/3', cos: '1/2', sen: 'sqrt(3)/2', tg: 'sqrt(3)',
    erroNoSlide: { descricao: 'No ciclo, 60° aparece como π/4.', rad: 'pi/4' },
  },
  { id: 'T05', fonte: TABELA, graus: 90, rad: 'pi/2', cos: '0', sen: '1', tg: 'indefinida' },
  {
    id: 'T06', fonte: CICLO, graus: 135, rad: '3*pi/4', cos: '-sqrt(2)/2', sen: 'sqrt(2)/2', tg: '-1',
    erroNoSlide: { descricao: 'No ciclo, o ponto de 135° aparece como (−√2/2, √2/4).', sen: 'sqrt(2)/4' },
  },
  { id: 'T07', fonte: TABELA, graus: 180, rad: 'pi', cos: '-1', sen: '0', tg: '0' },
  { id: 'T08', fonte: TABELA, graus: 270, rad: '3*pi/2', cos: '0', sen: '-1', tg: 'indefinida' },
  {
    id: 'T09', fonte: CICLO, graus: 300, rad: '5*pi/3', cos: '1/2', sen: '-sqrt(3)/2', tg: '-sqrt(3)',
    erroNoSlide: { descricao: 'No ciclo, o ponto de 300° aparece como (2/2, −√3/2).', cos: '2/2' },
  },
  {
    id: 'T10', fonte: CICLO, graus: 330, rad: '11*pi/6', cos: 'sqrt(3)/2', sen: '-1/2', tg: '-sqrt(3)/3',
    erroNoSlide: { descricao: 'No ciclo, 11π/6 está rotulado como 130°.', graus: 130 },
  },
  { id: 'T11', fonte: TABELA, graus: 360, rad: '2*pi', cos: '1', sen: '0', tg: '0' },
];

// ─── Aula 2 — Limites ──────────────────────────────────────────────────────────

export type ValorLimite = number | '+∞' | '-∞' | 'oscila';
export type Descontinuidade = 'removível' | 'infinita' | 'salto' | 'essencial';

export interface CasoLimite {
  id: string;
  fonte: string;
  f: string;
  /** Ponto do limite; Infinity ou -Infinity para limite no infinito. */
  a: number;
  esquerda?: ValorLimite;
  direita?: ValorLimite;
  limite: ValorLimite | 'não existe';
  /** Classificação da Aula 2, quadro 9. Ausente quando f é contínua em a (e no infinito). */
  descontinuidade?: Descontinuidade;
  nota?: string;
}

export const limites: CasoLimite[] = [
  {
    id: 'L01', fonte: 'Aula 2, quadro 5 (fatoração)', f: '(x^2 - 4)/(x - 2)', a: 2,
    esquerda: 4, direita: 4, limite: 4, descontinuidade: 'removível', nota: 'f(2) é 0/0, mas o limite existe.',
  },
  { id: 'L02', fonte: 'Aula 2, quadro 5 (racionalização)', f: '(sqrt(x + 1) - 1)/x', a: 0, limite: 0.5, descontinuidade: 'removível' },
  { id: 'L03', fonte: 'Aula 2, quadro 7', f: 'sen(x)/x', a: 0, limite: 1, descontinuidade: 'removível' },
  { id: 'L04', fonte: 'Aula 2, quadro 7', f: '(1 - cos(x))/x', a: 0, limite: 0, descontinuidade: 'removível' },
  { id: 'L05', fonte: 'Aula 2, quadro 7', f: '(1 - cos(x))/x^2', a: 0, limite: 0.5, descontinuidade: 'removível' },
  { id: 'L06', fonte: 'Aula 2, quadro 7', f: '(e^x - 1)/x', a: 0, limite: 1, descontinuidade: 'removível' },
  { id: 'L07', fonte: 'Aula 2, quadro 7 (com a = 2, o limite é ln 2)', f: '(2^x - 1)/x', a: 0, limite: Math.LN2, descontinuidade: 'removível' },
  { id: 'L08', fonte: 'Aula 2, quadro 7', f: 'ln(1 + x)/x', a: 0, limite: 1, descontinuidade: 'removível' },
  { id: 'L09', fonte: 'Aula 2, quadro 7 (com α = 3)', f: '((1 + x)^3 - 1)/x', a: 0, limite: 3, descontinuidade: 'removível' },
  { id: 'L10', fonte: 'Aula 2, quadro 6', f: '1/x', a: Infinity, limite: 0 },
  { id: 'L11', fonte: 'Aula 2, quadro 6 (graus iguais: razão dos coeficientes líderes)', f: '(3*x^2 + 1)/(2*x^2 - x)', a: Infinity, limite: 1.5 },
  { id: 'L12', fonte: 'Aula 2, quadro 6 (grau do numerador maior)', f: 'x^3/(x^2 + 1)', a: Infinity, limite: '+∞' },
  {
    id: 'L13', fonte: 'Aula 2, quadros 3 e 9 (salto)', f: 'abs(x)/x', a: 0,
    esquerda: -1, direita: 1, limite: 'não existe', descontinuidade: 'salto',
  },
  {
    id: 'L14', fonte: 'Aula 2, quadro 9 (infinita)', f: '1/x', a: 0,
    esquerda: '-∞', direita: '+∞', limite: 'não existe', descontinuidade: 'infinita',
  },
  {
    id: 'L15', fonte: 'Aula 2, quadro 9 (infinita, mesmo sinal dos dois lados)', f: '1/x^2', a: 0,
    esquerda: '+∞', direita: '+∞', limite: '+∞', descontinuidade: 'infinita',
    nota: 'Escreve-se lim = +∞, mas o limite não existe como número real.',
  },
  {
    id: 'L16', fonte: 'Aula 2, quadro 9 (essencial)', f: 'sen(1/x)', a: 0,
    esquerda: 'oscila', direita: 'oscila', limite: 'não existe', descontinuidade: 'essencial',
  },
  {
    id: 'L17', fonte: 'Tema: veículo acelera a 2 m/s² até t = 5 s e então freia a −3 m/s²', f: 'x < 5 ? 2 : -3', a: 5,
    esquerda: 2, direita: -3, limite: 'não existe', descontinuidade: 'salto',
    nota: 'A aceleração salta no instante em que o freio começa.',
  },
  {
    id: 'L18', fonte: 'Tema: velocidade do mesmo movimento, partindo do repouso', f: 'x < 5 ? 2*x : 10 - 3*(x - 5)', a: 5,
    esquerda: 10, direita: 10, limite: 10,
    nota: "Contínua em t = 5 s, mas com quina: v'(5) não existe (as derivadas laterais são 2 e −3).",
  },
];

// ─── Aula 3 — Derivadas ────────────────────────────────────────────────────────

export interface CasoDerivada {
  id: string;
  fonte: string;
  f: string;
  esperado: string;
  /** Regras da lista do projeto usadas no caso (vazio = derivada de tabela). */
  regras: RegraDerivacao[];
  /** Onde comparar; fora dele a função não existe ou explode. Padrão: [-3, 3]. */
  dominio?: Intervalo;
  erroNoSlide?: ErroNoSlide<CasoDerivada>;
}

export const derivadas: CasoDerivada[] = [
  { id: 'D01', fonte: 'Aula 3, quadro 2 (constante)', f: '7', esperado: '0', regras: ['constante'] },
  {
    id: 'D02', fonte: 'Aula 3, quadros 2 e 9 (potência)', f: 'x^3', esperado: '3*x^2', regras: ['potência'],
    erroNoSlide: { descricao: "Na tabela resumo, coluna da esquerda: (xⁿ)' = n·x⁻¹.", esperado: '3*x^(-1)' },
  },
  { id: 'D03', fonte: 'Aula 3, quadro 3 (potência com n fracionário)', f: 'sqrt(x)', esperado: '1/(2*sqrt(x))', regras: ['potência'], dominio: [0.1, 5] },
  { id: 'D04', fonte: 'Aula 3, quadro 3 (potência com n negativo)', f: '1/x', esperado: '-1/x^2', regras: ['potência'] },
  { id: 'D05', fonte: 'Aula 3, quadro 2 (soma e diferença)', f: 'x^3 - 4*x + 2', esperado: '3*x^2 - 4', regras: ['soma/subtração', 'potência', 'constante'] },
  { id: 'D06', fonte: 'Aula 3, quadro 2 (produto)', f: 'x^2*sen(x)', esperado: '2*x*sen(x) + x^2*cos(x)', regras: ['produto', 'potência'] },
  { id: 'D07', fonte: 'Aula 3, quadro 2 (quociente)', f: 'sen(x)/x', esperado: '(x*cos(x) - sen(x))/x^2', regras: ['quociente'] },
  { id: 'D08', fonte: 'Aula 3, quadro 3', f: 'e^x', esperado: 'e^x', regras: [] },
  { id: 'D09', fonte: 'Aula 3, quadro 3', f: '2^x', esperado: '2^x*ln(2)', regras: [] },
  { id: 'D10', fonte: 'Aula 3, quadro 3', f: 'ln(x)', esperado: '1/x', regras: [], dominio: [0.1, 5] },
  { id: 'D11', fonte: 'Aula 3, quadro 3', f: 'log(x, 10)', esperado: '1/(x*ln(10))', regras: [], dominio: [0.1, 5] },
  { id: 'D12', fonte: 'Aula 3, quadro 4', f: 'sen(x)', esperado: 'cos(x)', regras: [] },
  { id: 'D13', fonte: 'Aula 3, quadro 4', f: 'cos(x)', esperado: '-sen(x)', regras: [] },
  { id: 'D14', fonte: 'Aula 3, quadro 4', f: 'tg(x)', esperado: 'sec(x)^2', regras: [], dominio: [-1.4, 1.4] },
  { id: 'D15', fonte: 'Aula 3, quadro 4', f: 'cotg(x)', esperado: '-csc(x)^2', regras: [], dominio: [0.2, 3] },
  { id: 'D16', fonte: 'Aula 3, quadro 4', f: 'sec(x)', esperado: 'sec(x)*tg(x)', regras: [], dominio: [-1.4, 1.4] },
  { id: 'D17', fonte: 'Aula 3, quadro 4', f: 'csc(x)', esperado: '-csc(x)*cotg(x)', regras: [], dominio: [0.2, 3] },
  { id: 'D18', fonte: 'Aula 3, quadro 6, ex. 1', f: 'sen(3*x)', esperado: '3*cos(3*x)', regras: ['cadeia'] },
  { id: 'D19', fonte: 'Aula 3, quadro 6, ex. 2', f: 'cos(5*x^2)', esperado: '-10*x*sen(5*x^2)', regras: ['cadeia'] },
  { id: 'D20', fonte: 'Aula 3, quadro 6, ex. 3', f: 'tg(x^2 + 1)', esperado: '2*x*sec(x^2 + 1)^2', regras: ['cadeia'], dominio: [-0.7, 0.7] },
  { id: 'D21', fonte: 'Aula 3, quadro 6, ex. 4', f: 'e^(sen(x))', esperado: 'cos(x)*e^(sen(x))', regras: ['cadeia'] },
  { id: 'D22', fonte: 'Aula 3, quadro 6, ex. 5', f: 'ln(cos(x))', esperado: '-tg(x)', regras: ['cadeia'], dominio: [-1.4, 1.4] },
  { id: 'D23', fonte: 'Aula 3, quadro 6, ex. 6', f: 'sqrt(tg(x))', esperado: 'sec(x)^2/(2*sqrt(tg(x)))', regras: ['cadeia'], dominio: [0.05, 1.5] },
];

// ─── Aula 4 — Integrais ────────────────────────────────────────────────────────

export interface CasoIntegral {
  id: string;
  fonte: string;
  f: string;
  /** Uma primitiva de f; o + C fica implícito. */
  esperado: string;
  regras: RegraIntegracao[];
  dominio?: Intervalo;
  nota?: string;
  erroNoSlide?: ErroNoSlide<CasoIntegral>;
}

export const integrais: CasoIntegral[] = [
  { id: 'I01', fonte: 'Aula 4, quadro 3', f: '5', esperado: '5*x', regras: ['constante'] },
  { id: 'I02', fonte: 'Aula 4, quadro 3', f: 'x^3', esperado: 'x^4/4', regras: ['potência'] },
  {
    id: 'I03', fonte: 'Aula 4, quadro 3 (exceção n = −1)', f: '1/x', esperado: 'ln(abs(x))', regras: [],
    nota: 'A regra da potência não vale para n = −1. O módulo importa: o domínio inclui x < 0.',
  },
  { id: 'I04', fonte: 'Aula 4, quadro 2 (linearidade)', f: '3*x^2 - 4*x + 2', esperado: 'x^3 - 2*x^2 + 2*x', regras: ['soma/subtração', 'potência', 'constante'] },
  { id: 'I05', fonte: 'Aula 4, quadro 3', f: 'e^x', esperado: 'e^x', regras: ['exponencial'] },
  {
    id: 'I06', fonte: 'Aula 4, quadro 3', f: '2^x', esperado: '2^x/ln(2)', regras: ['exponencial'],
    erroNoSlide: { descricao: 'A linha da tabela traz aⁿ em vez de aˣ. A integral de aⁿ, que é constante, seria aⁿ·x + C.' },
  },
  { id: 'I07', fonte: 'Aula 4, quadros 3 e 9', f: 'sen(x)', esperado: '-cos(x)', regras: ['trigonométrica'] },
  { id: 'I08', fonte: 'Aula 4, quadros 3 e 9', f: 'cos(x)', esperado: 'sen(x)', regras: ['trigonométrica'] },
  { id: 'I09', fonte: 'Aula 4, quadros 3 e 9', f: 'sec(x)^2', esperado: 'tg(x)', regras: ['trigonométrica'], dominio: [-1.4, 1.4] },
  {
    id: 'I10', fonte: 'Aula 4, quadro 9', f: 'csc(x)^2', esperado: '-cotg(x)', regras: ['trigonométrica'], dominio: [0.2, 3],
    erroNoSlide: { descricao: 'No quadro 3, esta linha aparece como sec² x → −cotg x + C.', f: 'sec(x)^2' },
  },
  { id: 'I11', fonte: 'Aula 4, quadros 3 e 9', f: 'sec(x)*tg(x)', esperado: 'sec(x)', regras: ['trigonométrica'], dominio: [-1.4, 1.4] },
  { id: 'I12', fonte: 'Aula 4, quadros 3 e 9', f: 'csc(x)*cotg(x)', esperado: '-csc(x)', regras: ['trigonométrica'], dominio: [0.2, 3] },
  { id: 'I13', fonte: 'Aula 4, quadro 9', f: 'tg(x)', esperado: '-ln(abs(cos(x)))', regras: ['trigonométrica'], dominio: [-1.4, 1.4] },
  { id: 'I14', fonte: 'Aula 4, quadro 9', f: 'cotg(x)', esperado: 'ln(abs(sen(x)))', regras: ['trigonométrica'], dominio: [0.2, 3] },
  { id: 'I15', fonte: 'Aula 4, quadro 9', f: 'sec(x)', esperado: 'ln(abs(sec(x) + tg(x)))', regras: ['trigonométrica'], dominio: [-1.4, 1.4] },
  { id: 'I16', fonte: 'Aula 4, quadro 9', f: 'csc(x)', esperado: 'ln(abs(csc(x) - cotg(x)))', regras: ['trigonométrica'], dominio: [0.2, 3] },
  { id: 'I17', fonte: 'Aula 4, quadro 5 (exemplo)', f: '2*x*cos(x^2)', esperado: 'sen(x^2)', regras: ['substituição', 'trigonométrica'] },
  { id: 'I18', fonte: 'Substituição linear (u = 3x)', f: 'cos(3*x)', esperado: 'sen(3*x)/3', regras: ['substituição', 'trigonométrica'] },
  { id: 'I19', fonte: 'Substituição linear (u = −2x)', f: 'e^(-2*x)', esperado: '-e^(-2*x)/2', regras: ['substituição', 'exponencial'] },
];

/** Técnicas que estão na Aula 4 mas fora da lista do projeto. Não precisam ser implementadas. */
export const integraisForaDoEscopo: CasoIntegral[] = [
  { id: 'X01', fonte: 'Aula 4, quadro 6 (por partes)', f: 'x*e^x', esperado: 'e^x*(x - 1)', regras: [] },
  {
    id: 'X02', fonte: 'Aula 4, quadro 7 (frações parciais)', f: '(2*x + 3)/(x^2 - 1)',
    esperado: '5/2*ln(abs(x - 1)) - 1/2*ln(abs(x + 1))', regras: [],
    erroNoSlide: { descricao: 'O exemplo para em A·ln|x−1| + B·ln|x+1| + C sem calcular A = 5/2 e B = −1/2.' },
  },
];

export interface CasoIntegralDefinida {
  id: string;
  fonte: string;
  f: string;
  a: number;
  b: number;
  esperado: number | 'diverge';
  nota?: string;
  erroNoSlide?: ErroNoSlide<CasoIntegralDefinida>;
}

export const integraisDefinidas: CasoIntegralDefinida[] = [
  { id: 'ID01', fonte: 'Aula 4, quadro 10', f: 'sen(x)', a: 0, b: Math.PI, esperado: 2 },
  { id: 'ID02', fonte: 'Aula 4, quadro 10', f: '3*x^2 - 4*x + 2', a: 0, b: 2, esperado: 4 },
  { id: 'ID03', fonte: 'Aula 4, quadro 10 (limites trocados)', f: '3*x^2 - 4*x + 2', a: 2, b: 0, esperado: -4 },
  { id: 'ID04', fonte: 'Aula 4, quadro 3', f: '1/x', a: 1, b: Math.E, esperado: 1 },
  {
    id: 'ID05', fonte: 'Aula 4, quadro 10 ("área algébrica")', f: 'sen(x)', a: 0, b: 2 * Math.PI, esperado: 0,
    nota: 'A parte negativa subtrai. Em física, é o deslocamento: ida e volta se cancelam.',
  },
  {
    id: 'ID06', fonte: 'Área geométrica (distância percorrida)', f: 'abs(sen(x))', a: 0, b: 2 * Math.PI, esperado: 4,
    nota: 'Com |f| nada subtrai. Em física, é a distância percorrida.',
  },
  {
    id: 'ID07', fonte: 'Aula 4, quadro 10 (TFC sem a hipótese de continuidade)', f: '1/x^2', a: -1, b: 1, esperado: 'diverge',
    erroNoSlide: { descricao: 'O TFC do slide omite "f contínua em [a, b]". Aplicado assim mesmo, F(1) − F(−1) com F = −1/x dá −2.' },
  },
];
