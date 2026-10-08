import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// The playground's version: the release tag deploy/sync.mjs builds, or what
// git says about the working tree (v0.1.0-3-gabc1234-dirty).
function playgroundVersion(): string {
  if (process.env.PLAYGROUND_VERSION) {
    return process.env.PLAYGROUND_VERSION
  }
  try {
    return execSync('git describe --tags --always --dirty', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [vue()],
  define: {
    __PLAYGROUND_VERSION__: JSON.stringify(playgroundVersion()),
  },
  worker: {
    format: 'es',
  },
  build: {
    // CodeMirror with the HTML language (and its CSS and JS) is most of it.
    chunkSizeWarningLimit: 700,
  },
})
