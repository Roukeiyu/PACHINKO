import { defineConfig } from 'vite';

// Relative assets work both at /PACHINKO/ on GitHub Pages and on a local server.
// The leaderboard worker lives in worker/ and is deployed on its own. Vite does not bundle it.
export default defineConfig({
  base: './',
  server: { watch: { ignored: ['**/worker/**'] } },
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
