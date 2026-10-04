import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  resolve: { dedupe: ['three'] },
  server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  build: { rollupOptions: { input: { game: fileURLToPath(new URL('./index.html', import.meta.url)), rex: fileURLToPath(new URL('./rex.html', import.meta.url)) } } },
});
