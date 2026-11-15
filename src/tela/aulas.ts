/**
 * As duas vistas do app, trocadas pelo endereço: a calculadora (#calculadora, ou sem nada) e o
 * conteúdo das aulas (#funcoes, #limites, #derivadas, #integrais). Monta a aula escolhida e os
 * laboratórios dela, e leva os botões "Calcular" do texto para a calculadora. Como a troca é
 * pelo endereço, o botão Voltar do navegador e os links diretos para uma aula funcionam.
 */
import { AULAS, CONTAS, htmlDaAula } from './conteudos';
import type { Conta, IdAula } from './conteudos';
import { montarLaboratorio } from './laboratorios';
import type { Desmontar } from './laboratorios';

function elemento<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado na página.`);
  return el as T;
}

/**
 * Liga as abas; `aoCalcular` leva uma conta do texto para a calculadora. `irPara` troca de vista
 * na hora (o hashchange só chegaria depois), guardando a troca no histórico do navegador.
 */
export function iniciarConteudo(aoCalcular: (conta: Conta) => void): { irPara: (id: IdAula | 'calculadora') => void } {
  const calculadora = elemento<HTMLElement>('calculadora');
  const conteudo = elemento<HTMLElement>('conteudo');
  const aula = elemento<HTMLElement>('aula');
  const abas = elemento<HTMLElement>('abas-aulas');
  const vistaCalculadora = elemento<HTMLAnchorElement>('vista-calculadora');
  const vistaConteudo = elemento<HTMLAnchorElement>('vista-conteudo');
  let desmontar: Desmontar[] = [];
  let aberta: IdAula | null = null;

  aula.addEventListener('click', (ev) => {
    const botao = (ev.target as Element).closest<HTMLElement>('[data-conta]');
    const conta = botao ? CONTAS[Number(botao.dataset.conta)] : undefined;
    if (conta) aoCalcular(conta);
  });

  const abrir = (id: IdAula): void => {
    if (aberta === id) return;
    desmontar.forEach((d) => d());
    const escolhida = AULAS.find((a) => a.id === id)!;
    aula.innerHTML = htmlDaAula(escolhida);
    desmontar = Array.from(aula.querySelectorAll<HTMLElement>('[data-lab]')).map((el) => montarLaboratorio(el.dataset.lab, el, aoCalcular));
    aberta = id;
  };

  const mostrar = (): void => {
    const id = decodeURIComponent(location.hash.slice(1));
    const escolhida = AULAS.find((a) => a.id === id);
    calculadora.hidden = Boolean(escolhida);
    conteudo.hidden = !escolhida;
    if (escolhida) {
      vistaCalculadora.removeAttribute('aria-current');
      vistaConteudo.setAttribute('aria-current', 'page');
      vistaConteudo.href = `#${escolhida.id}`;
      abas.dataset.aula = escolhida.id;
      abas.querySelectorAll<HTMLAnchorElement>('a[data-aula]').forEach((a) => {
        if (a.dataset.aula === escolhida.id) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      abrir(escolhida.id);
      document.title = `${escolhida.titulo} · Cálculo CDI`;
    } else {
      vistaConteudo.removeAttribute('aria-current');
      vistaCalculadora.setAttribute('aria-current', 'page');
      document.title = 'Cálculo CDI · funções, limites, derivadas e integrais';
    }
    window.scrollTo({ top: 0 });
  };

  window.addEventListener('hashchange', mostrar);
  mostrar();
  return {
    irPara: (id) => {
      if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
      mostrar();
    },
  };
}
