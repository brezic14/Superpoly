import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // Laisse socket.io passer par Vite en dev si besoin.
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      // API REST (salon + jeu) : redirige vers l'Express local en dev.
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
