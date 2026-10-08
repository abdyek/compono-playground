<script setup lang="ts">
import { computed, ref } from 'vue'
import { examples } from '../state/examples'
import { input, loadExample, result, share, status, versions } from '../state/playground'

const copied = ref(false)
const shareError = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | undefined

async function onShare() {
  shareError.value = ''
  const url = await share()
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 2000)
  } catch {
    shareError.value = 'Copy the link from the address bar.'
  }
}

function onExample(e: Event) {
  const select = e.target as HTMLSelectElement
  const example = examples.find((ex) => ex.id === select.value)
  select.value = ''
  if (!example) {
    return
  }
  if (input.source.trim() && !confirm(`Replace your input with the "${example.title}" example?`)) {
    return
  }
  loadExample(example)
}

const statusText = computed(() => {
  switch (status.value) {
    case 'starting':
    case 'loading':
      return 'Loading Compono…'
    case 'converting':
      return 'Converting…'
    default:
      return result.value?.duration !== undefined ? `${result.value.duration.toFixed(1)} ms` : ''
  }
})

const currentVersion = computed(() => versions.value.find((v) => v.id === input.version))
</script>

<template>
  <header class="header">
    <h1 class="brand">
      Compono <span class="muted">Playground</span>
    </h1>

    <div class="controls">
      <label class="field">
        <span>Version</span>
        <select
          v-model="input.version"
          :disabled="versions.length === 0"
          :title="currentVersion ? `Commit ${currentVersion.commit}, built with ${currentVersion.go}` : undefined"
        >
          <option v-for="v in versions" :key="v.id" :value="v.id">{{ v.label }}</option>
        </select>
      </label>

      <label class="field">
        <span>Examples</span>
        <select value="" @change="onExample">
          <option value="" disabled>Load an example…</option>
          <option v-for="ex in examples" :key="ex.id" :value="ex.id">{{ ex.title }}</option>
        </select>
      </label>

      <button type="button" class="button primary" @click="onShare">
        {{ copied ? 'Link copied' : 'Share' }}
      </button>
      <span v-if="shareError" class="muted">{{ shareError }}</span>
    </div>

    <div class="end">
      <span class="status" aria-live="polite">{{ statusText }}</span>
      <a href="https://github.com/umono-cms/compono" target="_blank" rel="noopener noreferrer">Compono</a>
      <a href="https://github.com/umono-cms/compono-playground" target="_blank" rel="noopener noreferrer">GitHub</a>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: 16px 24px;
  flex-wrap: wrap;
  padding: 8px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.brand {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
}

.muted {
  color: var(--text-muted);
  font-weight: 400;
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.field {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 13px;
}

select {
  max-width: 220px;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
}

.button {
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  cursor: pointer;
}

.button.primary {
  min-width: 96px;
  border-color: var(--accent);
  background: var(--accent);
  color: var(--on-accent);
}

.end {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-left: auto;
  font-size: 13px;
}

.status {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
