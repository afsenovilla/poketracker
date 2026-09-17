import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En GitHub Pages la web vive en https://<usuario>.github.io/<repo>/
// El workflow pasa BASE_PATH=/<repo>/ al compilar.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: { quietDeps: true, silenceDeprecations: ['legacy-js-api', 'import', 'color-functions', 'global-builtin'] },
    },
  },
});
