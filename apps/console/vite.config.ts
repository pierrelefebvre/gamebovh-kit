import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Chemins relatifs : la console peut être servie depuis un sous-dossier.
  base: './',
  // Le fichier .env est à la racine du monorepo.
  envDir: repoRoot,
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: true,
    port: 5173,
    fs: { allow: [repoRoot] },
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,
  },
});
