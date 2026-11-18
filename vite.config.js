import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // REACT_APP_ is kept so the existing GLM_API_URL secret and .env keep working.
  envPrefix: ['VITE_', 'REACT_APP_'],
  build: {
    // `build/` is what both the GitHub Pages workflow and the AWS deploy publish.
    outDir: 'build',
  },
  server: { port: 3000 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}', 'scripts/**/*.test.js'],
  },
});
