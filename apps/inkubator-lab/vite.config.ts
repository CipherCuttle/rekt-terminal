import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath, URL} from 'node:url';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {alias: {'@': fileURLToPath(new URL('./src', import.meta.url))}},
  server: {host: '127.0.0.1', port: 5174},
  test: {environment: 'jsdom'},
  build: {target: 'es2022', outDir: '../../inkubator', emptyOutDir: true}
});
