import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  server: {
    port: 3003,
    open: true
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html'
    }
  }
})
