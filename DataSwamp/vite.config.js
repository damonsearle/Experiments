import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Relative base, so the build works wherever it is served from — repo root, a Pages
// subpath, or a local preview — without needing to know the deploy path up front.
export default defineConfig({
  resolve: { dedupe: ['three'] },
  server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  base: './',
});
