import { fileURLToPath } from 'node:url';
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'waku/config';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        '@': srcDir,
      },
    },
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  },
});
