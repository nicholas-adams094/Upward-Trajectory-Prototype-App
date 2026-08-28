import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The prototype is published to GitHub Pages at /<repo>/, so production builds
 * need that prefix. Override with BASE_PATH when deploying somewhere else.
 */
const REPO_BASE = '/Upward-Trajectory-Prototype-App/'

/**
 * GitHub Pages has no SPA rewrite, so a deep link like /engagements/e-marcus
 * would 404 on a hard refresh. Serving the same document as 404.html hands the
 * request back to the client router with the URL intact.
 */
function spaFallback() {
  return {
    name: 'spa-fallback-404',
    apply: 'build' as const,
    closeBundle() {
      const dist = resolve(__dirname, 'dist')
      copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
    },
  }
}

export default defineConfig(({ command }) => ({
  base: process.env.BASE_PATH ?? (command === 'build' ? REPO_BASE : '/'),
  plugins: [react(), tailwindcss(), spaFallback()],
  server: { port: 5173 },
}))
