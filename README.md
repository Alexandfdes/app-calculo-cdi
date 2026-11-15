# Cálculo CDI

App web da disciplina de Cálculo Diferencial e Integral: funções, limites, derivadas e integrais (indefinidas e definidas), com o passo a passo na notação da aula, um gráfico animado e a conta conferida. Tem também o conteúdo das quatro aulas e o exemplo do carro chegando na lombada, que atravessa as quatro.

O cálculo é simbólico e feito pelo próprio motor do projeto (`src/motor`). O math.js só lê o texto digitado; derivar, integrar, simplificar e calcular limites é código daqui.

## Como rodar

Precisa do Node.js 20.19 ou mais novo (testado no 22).

```bash
npm install
npm run dev        # abre em http://localhost:5173
```

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm test` | roda todos os testes (Vitest) |
| `npm run typecheck` | confere os tipos do TypeScript |
| `npm run build` | gera o site pronto em `dist/` |
| `npm run preview` | serve o `dist/` em http://localhost:4173 |

## Como entregar

O `npm run build` gera em `dist/` um site estático: um `index.html` e a pasta `assets/`. Não precisa de servidor próprio nem de banco de dados.

**Pelo GitHub Pages (recomendado).** O professor recebe um link e abre no navegador, inclusive no celular.

1. Rode `npm run build`.
2. Publique o conteúdo de `dist/` no GitHub Pages do repositório. Como o build usa caminhos relativos (`base: './'` no `vite.config.ts`), o site funciona no endereço `usuario.github.io/app-calculo-cdi/` sem mudar nada.

Netlify, Vercel ou qualquer outra hospedagem de site estático servem do mesmo jeito: basta enviar a pasta `dist/`.

**Por arquivo (.zip).** Funciona, mas tem uma pegadinha: abrir o `index.html` com dois cliques **não funciona**. O navegador bloqueia scripts de módulo abertos direto do disco (`file://`) e a página fica sem a calculadora. Quem receber o zip precisa servir a pasta, por exemplo:

```bash
npx serve dist          # ou: python -m http.server --directory dist
```

Se a entrega for só por arquivo, mande o código-fonte (sem `node_modules/`) com este README; `npm install` e `npm run dev` bastam.

## Como digitar

- Potência com `^`: `x^3`, `x^(1/2)`. Multiplicação com `*` ou colada: `2*x`, `2x`.
- Funções: `sen`, `cos`, `tg`, `cotg`, `sec`, `csc`, `ln`, `sqrt`, `abs`, `log(x, 10)`.
- Constantes: `e` e `pi`. Decimais com ponto: `2.5`.
- No limite, o ponto pode ser `inf` ou `-inf`, e a função pode ser por partes: `x < 5 ? 2*x : 10 - 3*(x - 5)`.

## Organização

```
src/motor/    o cálculo, sem nada de tela
  expressao.ts     leitura, escrita e valor numérico das expressões
  simplificar.ts   simplificação
  derivadas.ts     regras de derivação e passo a passo
  integrais.ts     integrais imediatas, substituição e reescrita do integrando
  definidas.ts     integral definida (TFC), descontinuidades e área com |f|
  limites.ts       limites laterais, no infinito, indeterminações
  funcoes.ts       modo Função: tipo, domínio, raízes (Aula 1)
  polinomios.ts    polinômios, divisão e fatoração
  numeros.ts       números escritos de forma exata (frações, raízes, π)
src/tela/     interface: calculadora, gráfico, conteúdo das aulas e laboratórios
testes/       testes do motor e da tela
```

## Testes

Os testes cobrem os exercícios dos slides, casos de borda e sorteios. Nos sorteios, cada derivada é comparada, em pontos sorteados, com a derivada calculada pelo math.js, e cada integral é conferida derivando a primitiva de volta. Durante o desenvolvimento, as derivadas e integrais também foram comparadas com o sympy (biblioteca Python de matemática simbólica), que é independente do motor.

## Limites conhecidos

O motor recusa com aviso, em vez de dar resposta errada, o que está fora do conteúdo das aulas:

- integrais que pedem integração por partes, identidades trigonométricas, frações parciais ou arco-tangente;
- limites em que os termos dominantes se cancelam, ou com oscilação no infinito, como x·sen x;
- funções com a variável na base e no expoente (xˣ) e exponenciais de base negativa.

Raiz de índice ímpar vale para x negativo (∛−8 = −2); raiz de índice par, não.
