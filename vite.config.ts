import { defineConfig } from 'vite';

// Caminhos relativos no build (./assets/…): o dist/ funciona em qualquer subpasta,
// como no GitHub Pages (usuario.github.io/app-calculo-cdi/), e não só na raiz do site.
export default defineConfig({
  base: './',
});
