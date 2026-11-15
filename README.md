# Projeto Final de CDI — AP2 (2026.2)
**UNICATÓLICA RN | Bacharelado em Engenharia de Software**  
**Disciplina:** Cálculo Diferencial e Integral I  
**Turma:** [Turma A / B]  
**Docente:** [Nome da Professora]  
**Integrantes da Equipe:**
- [Nome do Aluno 1] — Matrícula: [0000000]

---

## 1. Problema Concreto e Justificativa Matemática

### 1.1. Contexto: Dinâmica Veicular e Travessia Segura de Lombada
O projeto aborda a modelagem física e matemática da aproximação, frenagem e transposição de um obstáculo viário (lombada redutora de velocidade a $62\text{ m}$ do ponto inicial de observação), integrando de forma transversal os conteúdos das **Aulas 1 a 4**.

```
  Marco 0 m                      Marco 20 m                     Marco 62 m
 (Vê a lombada)                 (Freio entra)                   (Lombada)
     🚗 ───────────────────────────── 🚗 ─────────────────────────── 🚗 ────►
       [ 1 s de reação a 20 m/s ]     [ Frenagem a = −4 m/s² ]
```

### 1.2. Equacionamento e Justificativas Matemáticas nas 4 Aulas

1. **Aula 1 — Funções (Geometria e Trajetória):**
   - O movimento é modelado como uma função por partes no domínio temporal $t \ge 0$:
     $$s(t) = \begin{cases} 20t, & 0 \le t < 1 \text{ (MRU durante o tempo de reação)} \\ -2t^2 + 24t - 2, & 1 \le t \le 4 \text{ (MRUV durante a frenagem)} \end{cases}$$
   - **Domínio físico:** $[0, 4]\text{ s}$.
   - **Imagem:** $[0, 62]\text{ m}$. Em $t = 1\text{ s}$, $s(1) = 20\text{ m}$. Em $t = 4\text{ s}$, $s(4) = -2(16) + 24(4) - 2 = 62\text{ m}$ (chegada exata à lombada).

2. **Aula 2 — Limites e Continuidade (Impacto e Conforto):**
   - A aceleração salta bruscamente de $0$ para $-4\text{ m/s}^2$ no acionamento do pedal:
     $$\lim_{t \to 1^-} a(t) = 0 \quad \ne \quad \lim_{t \to 1^+} a(t) = -4$$
     *Interpretação prática:* Há uma descontinuidade de salto na aceleração ($a(t)$ não tem limite em $t=1$), o que causa um "tranco" (variação súbita de inércia).
   - A velocidade, por sua vez, é contínua em $t = 1\text{ s}$:
     $$\lim_{t \to 1^-} v(t) = \lim_{t \to 1^-} 20 = 20\text{ m/s}$$
     $$\lim_{t \to 1^+} v(t) = \lim_{t \to 1^+} (24 - 4t) = 20\text{ m/s}$$
     Como $\lim_{t \to 1^-} v(t) = \lim_{t \to 1^+} v(t) = v(1) = 20\text{ m/s}$, a velocidade é contínua, garantindo que o carro não sofra teletransporte de momento linear.

3. **Aula 3 — Derivadas (Taxas de Variação e Velocidade Instantânea):**
   - A velocidade instantânea é a derivada da posição temporal:
     $$v(t) = \frac{d}{dt}[s(t)] = \frac{d}{dt}[-2t^2 + 24t - 2] = -4t + 24$$
   - Em $t = 1\text{ s}$ (início do freio): $v(1) = 20\text{ m/s}$ ($72\text{ km/h}$).
   - Em $t = 4\text{ s}$ (ao tocar a lombada): $v(4) = -4(4) + 24 = 8\text{ m/s}$ ($28{,}8\text{ km/h}$).
   - A derivada segunda fornece a desaceleração imposta pelo freio:
     $$a(t) = \frac{d}{dt}[v(t)] = -4\text{ m/s}^2$$

4. **Aula 4 — Integrais (Trabalho e Deslocamento Acumulado):**
   - A distância percorrida durante a fase de frenagem ($t \in [1, 4]$) é a área sob a curva de velocidade pelo Teorema Fundamental do Cálculo:
     $$\Delta s = \int_{1}^{4} (24 - 4t)\,dt = \left[ 24t - 2t^2 \right]_{1}^{4}$$
     $$\Delta s = \left(24(4) - 2(4)^2\right) - \left(24(1) - 2(1)^2\right) = (96 - 32) - (24 - 2) = 64 - 22 = 42\text{ m}$$
   - Somando aos $20\text{ m}$ percorridos no $1\text{ s}$ de reação inicial:
     $$s_{\text{total}} = 20\text{ m} + 42\text{ m} = 62\text{ m}$$

---

## 2. Conteúdo Matemático Obrigatório — Quatro Módulos

O sistema implementa de forma completa, com motor simbólico próprio (`src/motor/`), os requisitos solicitados:

### Módulo 1 — Funções (Aula 1)
Identifica analiticamente o tipo, domínio, imagem, raízes, intercepto vertical e constrói tabela e gráfico animado.
Suporta mais de 5 tipos distintos:
1. **Constante:** $f(x) = 20$ (Domínio: $\mathbb{R}$, Imagem: $\{20\}$).
2. **Afim / Linear:** $f(x) = 20x$ e $f(x) = 20x + 100$ (Domínio: $\mathbb{R}$, Imagem: $\mathbb{R}$).
3. **Quadrática:** $f(x) = -2x^2 + 24x - 2$ (Vértice em $(6, 70)$, Imagem: $(-\infty, 70]$).
4. **Modular:** $f(x) = |x - 5|$ (Domínio: $\mathbb{R}$, Imagem: $[0, +\infty)$).
5. **Exponencial:** $f(x) = 80 \cdot (0.85)^x$ (Domínio: $\mathbb{R}$, Imagem: $(0, +\infty)$).
6. **Logarítmica:** $f(x) = \ln(x)$ (Domínio: $(0, +\infty)$, Imagem: $\mathbb{R}$).
7. **Trigonométrica:** $f(x) = \text{sen}(x)$, $\cos(x)$, $\text{tg}(x)$.

### Módulo 2 — Limites (Aula 2)
Cálculo analítico com passo a passo:
- **Limites Laterais e Continuidade:** Análise de funções por partes com identificação formal de descontinuidade de salto ou continuidade.
- **Indeterminações:** Resolução de $\frac{0}{0}$ e $\frac{\infty}{\infty}$ por fatoração de polinômios (Briot-Ruffini), multiplicação por conjugado de radicais e divisão por termo de maior grau.
- **Limites no Infinito:** Avaliação com sinal de aproximação para assíntotas horizontais.
- **Casos de Inexistência:** Detecção de limites laterais divergentes ($\lim_{x \to 0} \frac{1}{x} = \nexists$).

### Módulo 3 — Derivadas (Aula 3)
Diferenciação simbólica com demonstração pedagógica passo a passo das 6 regras clássicas:
1. **Regra da Constante:** $\frac{d}{dx}[c] = 0$.
2. **Regra da Potência:** $\frac{d}{dx}[x^n] = n x^{n-1}$.
3. **Regra da Soma e Subtração:** $(f \pm g)' = f' \pm g'$.
4. **Regra do Produto:** $(f \cdot g)' = f'g + fg'$.
5. **Regra do Quociente:** $\left(\frac{f}{g}\right)' = \frac{f'g - fg'}{g^2}$.
6. **Regra da Cadeia:** $\frac{d}{dx}[f(g(x))] = f'(g(x)) \cdot g'(x)$.

### Módulo 4 — Integrais (Aula 4)
Cálculo analítico com resolução passo a passo:
- **Regras contempladas:**
  1. Constante: $\int k\,dx = kx + C$
  2. Potência: $\int x^n\,dx = \frac{x^{n+1}}{n+1} + C$
  3. Soma / Subtração: $\int (f \pm g)\,dx = \int f\,dx \pm \int g\,dx$
  4. Exponencial: $\int e^x\,dx = e^x + C$ e $\int a^x\,dx = \frac{a^x}{\ln a} + C$
  5. Trigonométrica: $\int \cos(x)\,dx = \text{sen}(x) + C$, $\int \sec^2(x)\,dx = \text{tg}(x) + C$
  6. Substituição ($u$-du): Reconhecimento automático de padrões $\int f(g(x)) g'(x)\,dx$.
- **Integrais Definidas e Impróprias:**
  - Aplicação do Teorema Fundamental do Cálculo: $\int_a^b f(x)\,dx = F(b) - F(a)$.
  - Cálculo de área líquida e área geométrica total ($\int |f(x)|\,dx$).
  - Suporte a limites infinitos ($-\infty$ a $+\infty$) com conferência de convergência.

---

## 3. Arquitetura da Solução e Tecnologias

```
app-calculo/
├── src/
│   ├── motor/               # Motor matemático simbólico próprio (puro, sem dependências de UI)
│   │   ├── expressao.ts     # AST própria, parser, avaliador e impressor matemático
│   │   ├── funcoes.ts       # Análise analítica de funções (Aula 1)
│   │   ├── limites.ts       # Limites algébricos, laterais e continuidade (Aula 2)
│   │   ├── derivadas.ts     # Diferenciação simbólica com regras e passos (Aula 3)
│   │   ├── integrais.ts     # Integrais indefinidas e substituição (Aula 4)
│   │   ├── definidas.ts     # Integrais definidas, TFC, descontinuidades e áreas
│   │   ├── simplificar.ts   # Simplificação de expressões algébricas
│   │   ├── polinomios.ts    # Divisão polinomial, raízes e Briot-Ruffini
│   │   └── numeros.ts       # Formatação exata (frações, radicais, múltiplos de π)
│   └── tela/                # Camada visual e simulação interativa
│       ├── main.ts          # Controlador principal da aplicação
│       ├── grafico.ts       # Renderizador de gráficos interativos e somas de Riemann (Canvas 2D)
│       ├── cena-do-carro.ts # Animação do cenário físico da lombada em Canvas
│       ├── laboratorios.ts  # Laboratórios interativos com controles deslizantes
│       ├── conteudos.ts     # Material teórico completo com exemplos didáticos
│       └── formula.ts       # Renderização de fórmulas matemáticas formatadas em HTML
└── testes/                  # Suíte de testes automatizados com Vitest
    ├── motor-funcoes.test.ts
    ├── motor-limites.test.ts
    ├── motor-derivadas.test.ts
    ├── motor-integrais.test.ts
    ├── casos-dos-slides.test.ts
    └── oraculo.ts           # Validador independente com math.js / sympy
```

- **Linguagem:** TypeScript 5.9 (modo estrito: `noUncheckedIndexedAccess: true`).
- **Build & Dev Server:** Vite 8.
- **Testes:** Vitest 5.1 (700 testes automatizados).
- **Sem frameworks pesados:** Implementado em Vanilla TypeScript sobre a DOM API e Canvas 2D nativo para máxima eficiência e independência de runtime.

---

## 4. Funcionamento, Validação e Bateria de Testes

A aplicação é validada por **700 testes automatizados**, cobrindo tanto casos analíticos fechados quanto testes estocásticos (aleatórios):

```bash
$ npm test

 ✓ testes/tela-formula.test.ts (6 tests)
 ✓ testes/motor-derivadas.test.ts (67 tests)
 ✓ testes/motor-limites.test.ts (97 tests)
 ✓ testes/casos-dos-slides.test.ts (108 tests)
 ✓ testes/tela-conteudo.test.ts (150 tests)
 ✓ testes/motor-integrais.test.ts (143 tests)
 ✓ testes/motor-funcoes.test.ts (127 tests)
 ✓ testes/motor-derivadas-aleatorio.test.ts (300 expressões aleatórias conferidas com oráculo)
 ✓ testes/motor-integrais-aleatorio.test.ts (300 expressões aleatórias conferidas com oráculo)

 Test Files  9 passed (9)
      Tests  700 passed (700)
```

### Oráculo e Verificação Cruzada
Para garantir que o motor simbólico próprio não cometa erros sutis:
- **Derivadas:** Cada resultado analítico é conferido por amostragem numérica de alta precisão contra o resultado do `mathjs` em centenas de pontos.
- **Integrais:** A primitiva gerada $F(x)$ é diferenciada automaticamente pelo motor de derivadas ($F'(x)$) e conferida contra o integrando original $f(x)$. Além disso, a integral definida é comparada com somas numéricas de Riemann com $n = 100.000$ subdivisões.

---

## 5. Instruções de Instalação e Execução

### Requisitos
- Node.js versão 20.19+ ou superior (recomendado Node 22).

### Comandos Principais

```bash
# 1. Instalar dependências
npm install

# 2. Executar em modo desenvolvimento (abre em http://localhost:5173)
npm run dev

# 3. Executar a suíte de testes automatizados
npm test

# 4. Validar tipos TypeScript
npm run typecheck

# 5. Compilar versão de produção
npm run build

# 6. Pré-visualizar a versão de produção localmente (http://localhost:4173)
npm run preview
```

### Hospedagem Online (GitHub Pages)
O projeto está configurado com caminhos relativos (`base: './'` em `vite.config.ts`), permitindo implantação direta e imediata no **GitHub Pages**, Vercel ou Netlify sem alterações de rota.

---

## 6. Registro de Prompts de IA e Validação Humana

Conforme exigido pelo **Critério 6 do Edital da AP2**, registramos abaixo o histórico dos prompts utilizados com assistentes de IA, seus resultados e as intervenções e validações humanas realizadas:

| Ferramenta | Objetivo | Prompt Utilizado | Resultado Gerado | Ajuste e Validação Humana Realizada |
|---|---|---|---|---|
| **Antigravity (Gemini / Claude)** | Modelagem do problema concreto transversal da lombada | *"Modelar a cinemática de um veículo que trafega a 20 m/s, tem tempo de reação de 1 s e desacelera com a = -4 m/s² até transpor uma lombada em 62 m, conectando funções, limites, derivadas e integrais."* | Esboço matemático com as funções por partes para posição $s(t)$, velocidade $v(t)$ e aceleração $a(t)$. | **Validação:** Conferência analítica manual dos limites laterais em $t = 1\text{ s}$ e cálculo do Teorema Fundamental do Cálculo para garantir que $\int_1^4 (24-4t)dt + 20 = 62\text{ m}$. Código implementado em `main.ts` e `cena-do-carro.ts`. |
| **Antigravity (Gemini / Claude)** | Implementação do motor de limites sem L'Hôpital | *"Implementar um algoritmo simbólico em TypeScript para resolver limites com indeterminação 0/0 e infinito/infinito através de fatoração por Briot-Ruffini e multiplicação pelo conjugado de radicais."* | Algoritmo inicial em `limites.ts` com funções de casamento de padrões para radicais e polinômios. | **Ajuste:** O modelo original entrava em recursão infinita ao simplificar expressões mistas. Foi adicionada trava de profundidade máxima de 60 iterações e regra de recusa explícita amigável quando o limite requer técnicas avançadas. |
| **Antigravity (Gemini / Claude)** | Motor de integração por substituição ($u$-du) | *"Criar uma rotina em TypeScript para detectar a regra da cadeia invertida (substituição u-du) em funções trigonométricas e potências compostas."* | Código gerador de substituição com cálculo automático de derivada interna $u'$. | **Ajuste:** Corrigido o tratamento de constantes multiplicativas residuais (ex.: $\int x \cos(x^2)\,dx = \frac{1}{2}\text{sen}(x^2) + C$). Adicionados 143 testes unitários no Vitest para validação. |
| **Antigravity (Gemini / Claude)** | Animação em Canvas 2D da suspensão do carro | *"Criar um componente em Canvas 2D no TypeScript que desenhe um veículo estilizado e anime a compressão das rodas ao passar pelo obstáculo, respeitando prefers-reduced-motion."* | Classe `CenaCarro` com renderização vetorial e interpolação de quadros por `requestAnimationFrame`. | **Validação:** Testado em múltiplos tamanhos de tela. Adicionada regra de acessibilidade para desativar animações pesadas caso o usuário configure o sistema operacional para reduzir movimentos. |
| **Antigravity (Gemini / Claude)** | Construção do oráculo de testes | *"Escrever uma suíte de testes comparativos no Vitest que sorteie 300 expressões aleatórias e confira o resultado do motor próprio com o mathjs."* | Arquivo `oraculo.ts` com gerador de expressões e conferência estocástica em amostras de Chebyshev/razão áurea. | **Validação:** Execução contínua no CI garantindo 100% de aprovação (700 testes). |

---

## 7. Exemplos de Entrada e Saída

### Exemplo 1: Estudo de Função (Aula 1)
- **Entrada:** `f(x) = -2*x^2 + 24*x - 2`
- **Saída do App:**
  - *Classificação:* Função Quadrática (Polinomial de grau 2)
  - *Domínio:* $\mathbb{R} = (-\infty, +\infty)$
  - *Vértice:* $(6, 70)$ — Ponto de Máximo
  - *Imagem:* $(-\infty, 70]$
  - *Intercepto $y$:* $(0, -2)$

### Exemplo 2: Limite Lateral e Descontinuidade (Aula 2)
- **Entrada:** `x < 1 ? 0 : -4` em $x \to 1$
- **Saída do App:**
  - $\lim_{x \to 1^-} f(x) = 0$
  - $\lim_{x \to 1^+} f(x) = -4$
  - *Conclusão:* Como os limites laterais são distintos, $\lim_{x \to 1} f(x) = \nexists$. A função possui descontinuidade de salto.

### Exemplo 3: Derivada com Regra da Cadeia (Aula 3)
- **Entrada:** `f(x) = sen(3*x^2 + 1)`
- **Passo a passo exibido:**
  1. Identifica a função externa $f(u) = \text{sen}(u)$ e interna $u(x) = 3x^2 + 1$.
  2. Derivada externa: $\frac{d}{du}[\text{sen}(u)] = \cos(u)$.
  3. Derivada interna: $\frac{d}{dx}[3x^2 + 1] = 6x$.
  4. Aplica $(f \circ u)' = f'(u) \cdot u'$:
  - **Resultado:** $6x \cos(3x^2 + 1)$.

### Exemplo 4: Integral Definida — Deslocamento na Frenagem (Aula 4)
- **Entrada:** $\int_{1}^{4} (24 - 4x)\,dx$
- **Passo a passo exibido:**
  1. Primitiva indefinida: $\int (24 - 4x)\,dx = 24x - 2x^2$.
  2. Aplicação do Teorema Fundamental do Cálculo em $[1, 4]$:
     $$F(4) = 24(4) - 2(4)^2 = 96 - 32 = 64$$
     $$F(1) = 24(1) - 2(1)^2 = 24 - 2 = 22$$
     $$F(4) - F(1) = 64 - 22 = 42$$
  - **Resultado:** $42$ (com representação da área sombreada no gráfico e aproximação pelas somas de Riemann).
