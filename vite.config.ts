import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  worker: {
    format: 'es',
  },
  build: {
    // CodeMirror with the HTML language (and its CSS and JS) is most of it.
    chunkSizeWarningLimit: 700,
  },
})
