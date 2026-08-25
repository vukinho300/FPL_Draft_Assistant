import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

import { createFplHandler } from './api/fpl.ts'

const fplHandler = createFplHandler()

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'fpl-api-development-boundary',
      configureServer(server) {
        server.middlewares.use('/api/fpl', (request, response) => {
          void fplHandler(request, response)
        })
      },
    },
  ],
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/.vercel/**'],
  },
})
