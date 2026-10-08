<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FatalKind } from '../compono/types'
import { result, status } from '../state/playground'
import { previewDark } from '../state/preferences'
import CodeEditor from './CodeEditor.vue'

const tab = ref<'preview' | 'html'>('preview')
const copied = ref(false)

const html = computed(() => result.value?.html ?? '')
const fatal = computed(() => result.value?.fatal ?? null)

const fatalTitles: Record<FatalKind, string> = {
  input: 'Invalid context',
  compono: 'Fatal error',
  panic: 'Compono crashed',
  timeout: 'Conversion timed out',
  load: 'Compono could not be loaded',
}

// The output is shown unstyled: Compono is semantic and theme independent.
// The dark preview is the browser's own dark defaults, not a theme.
// The iframe runs no scripts; links open in a new tab.
const srcdoc = computed(
  () =>
    `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">` +
    `<meta name="color-scheme" content="${previewDark.value ? 'dark' : 'light'}">` +
    `</head><body>${html.value}</body></html>`,
)

function togglePreviewDark() {
  previewDark.value = !previewDark.value
}

async function copy() {
  try {
    await navigator.clipboard.writeText(html.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // The HTML tab can be selected and copied by hand.
  }
}
</script>

<template>
  <section class="panel" aria-label="Output">
    <div class="tabs" role="tablist">
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'preview'"
        :class="{ active: tab === 'preview' }"
        @click="tab = 'preview'"
      >
        Preview
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'html'"
        :class="{ active: tab === 'html' }"
        @click="tab = 'html'"
      >
        HTML
      </button>
      <span class="spacer" />
      <button
        v-if="tab === 'preview'"
        type="button"
        role="switch"
        class="switch"
        :aria-checked="previewDark"
        @click="togglePreviewDark"
      >
        <span class="track" aria-hidden="true"><span class="knob" /></span>
        Dark preview
      </button>
      <button v-if="html" type="button" class="copy" @click="copy">{{ copied ? 'Copied' : 'Copy HTML' }}</button>
    </div>

    <div v-if="fatal" class="fatal" role="alert">
      <strong>{{ fatalTitles[fatal.kind] }}</strong>
      <p class="fatal-message">{{ fatal.message }}</p>
      <p v-if="fatal.kind === 'compono'" class="fatal-note">
        <code>Convert</code> returned an error, so no output was written.
      </p>
      <p v-else-if="fatal.kind === 'panic'" class="fatal-note">
        This is a bug in Compono.
        <a href="https://github.com/umono-cms/compono/issues/new" target="_blank" rel="noopener noreferrer">
          Report it
        </a>
        with a share link of this input.
      </p>
      <details v-if="fatal.stack">
        <summary>Stack trace</summary>
        <pre>{{ fatal.stack }}</pre>
      </details>
    </div>

    <div v-else class="body">
      <p v-if="!result" class="empty">{{ status === 'idle' ? '' : 'Loading Compono…' }}</p>
      <p v-else-if="!html" class="empty">The output is empty.</p>
      <iframe
        v-else-if="tab === 'preview'"
        class="preview"
        :class="{ dark: previewDark }"
        title="Output preview"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        :srcdoc="srcdoc"
      />
      <CodeEditor v-else :model-value="html" language="html" readonly label="Output HTML" />
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--editor-bg);
}

.tabs {
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 0 8px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.tabs button[role='tab'] {
  padding: 8px 10px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}

.tabs button.active {
  color: var(--text);
  border-bottom-color: var(--accent);
}

.spacer {
  flex: 1;
}

.copy {
  align-self: center;
  padding: 2px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  font-size: 12px;
  cursor: pointer;
}

.body {
  flex: 1;
  min-height: 0;
}

.preview {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
  /* Same scheme as the document inside, so its canvas color shows. */
  color-scheme: light;
  background: Canvas;
}

.preview.dark {
  color-scheme: dark;
}

.switch {
  display: flex;
  align-items: center;
  gap: 6px;
  align-self: center;
  margin-right: 12px;
  padding: 2px 4px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}

.track {
  position: relative;
  width: 26px;
  height: 14px;
  border-radius: 7px;
  background: var(--border);
  transition: background 0.15s;
}

.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--surface);
  transition: transform 0.15s;
}

.switch[aria-checked='true'] .track {
  background: var(--accent);
}

.switch[aria-checked='true'] .knob {
  transform: translateX(12px);
}

.empty {
  margin: 0;
  padding: 16px;
  color: var(--text-muted);
}

.fatal {
  margin: 12px;
  padding: 12px 14px;
  border: 1px solid var(--error);
  border-radius: 8px;
  background: var(--error-soft);
  color: var(--text);
  overflow: auto;
}

.fatal strong {
  color: var(--error);
}

.fatal-message {
  margin: 6px 0 0;
  font-family: var(--mono);
  font-size: 13px;
  white-space: pre-wrap;
}

.fatal-note {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

details {
  margin-top: 8px;
  font-size: 12px;
}

pre {
  max-height: 300px;
  overflow: auto;
  font-family: var(--mono);
}
</style>
