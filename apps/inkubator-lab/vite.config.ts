import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath, URL} from 'node:url';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {alias: {'@': fileURLToPath(new URL('./src', import.meta.url))}},
  server: {host: '127.0.0.1', port: 5174, proxy: {'/v1': {target: process.env.INKUBATOR_API_ORIGIN || 'http://127.0.0.1:8788', changeOrigin: false}}},
  test: {environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}']},
  build: {target: 'es2022', outDir: '../../inkubator', emptyOutDir: true}
});
