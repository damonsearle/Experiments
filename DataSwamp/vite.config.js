import { defineConfig } from 'vite';

// Relative base, so the build works wherever it is served from — repo root, a Pages
// subpath, or a local preview — without needing to know the deploy path up front.
export default defineConfig({
  base: './',
});
