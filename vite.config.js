import { defineConfig } from 'vite';

// Relative assets work both at /PACHINKO/ on GitHub Pages and on a local server.
export default defineConfig({ base: './', build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } } });
