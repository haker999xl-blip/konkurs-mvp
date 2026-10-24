import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
// API живёт в том же процессе: dev-сервер сам отвечает на /api/*.
import { apiPlugin } from './server/vite-plugin.js'

export default defineConfig({
  plugins: [react(), apiPlugin()],
})