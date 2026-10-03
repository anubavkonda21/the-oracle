import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the static build works from any path
  // (Vercel, Netlify, or a GitHub Pages project subfolder).
  base: './',
  server: {
    // Not Vite's default 5173, so this never collides with another local Vite project.
    port: 5273,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    // Phaser is a single large vendor module; it is expected to exceed the default 500 kB warning.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Vitest blanks out stylesheets by default. The design-token tests read the real CSS text.
    css: true,
  },
});
