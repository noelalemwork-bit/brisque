import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import { loadEnv as loadNoelEnv } from './src/server/env.js';

// Dev only: /moth proxies to the Moth API and adds MOTH_API_KEY from Noel/.env on the server side,
// so the browser can run live circuits without ever holding the key (and without CORS, which Moth
// restricts to its own origin). `vite build` output contains no key and no proxy.
loadNoelEnv();
const mothKey = process.env.MOTH_API_KEY;

// Quantum Forge (quantum.dev) loads its WebAssembly simulator at runtime from ./quantum-forge-qubit/.
// Serve it from node_modules in dev and copy only the qubit build (1.8 MB) into the bundle.
const FORGE_DIR = path.resolve('node_modules/quantum-forge/dist/quantum-forge-qubit');
const quantumForge = {
  name: 'brisque-quantum-forge',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const m = req.url?.split('?')[0].match(/\/quantum-forge-qubit\/(quantum-forge-web-[\w.-]+)$/);
      const file = m && path.join(FORGE_DIR, m[1]);
      if (!file || !fs.existsSync(file)) return next();
      res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'application/javascript');
      fs.createReadStream(file).pipe(res);
    });
  },
  writeBundle({ dir }) {
    fs.cpSync(FORGE_DIR, path.join(dir, 'quantum-forge-qubit'), { recursive: true, filter: (f) => !f.endsWith('.d.mts') });
  },
};

export default defineConfig({
  plugins: [quantumForge],
  base: './', // relative asset URLs: the build runs from any folder (itch.io zip, a page on your site)
  server: {
    port: 5180,
    strictPort: true,
    watch: { ignored: ['**/notebook/**', '**/release/**', '**/.scratch/**'] },
    proxy: {
      '/ws': { target: 'ws://localhost:8787', ws: true },
      '/moth': {
        target: 'https://api.mothquantum.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/moth/, '/api/v1'),
        headers: mothKey ? { Authorization: `Bearer ${mothKey}` } : {},
      },
    },
  },
  // `vite preview` would inherit server.proxy (key included); keep it a faithful static-hosting test
  preview: { port: 5190, strictPort: true, proxy: {} },
  define: { __MOTH_DEV_PROXY__: JSON.stringify(!!mothKey) },
  optimizeDeps: { exclude: ['quantum-forge'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
