import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { dedupe: ['three'] },
  server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  base: '/Experiments/',
});
