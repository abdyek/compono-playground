<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Range } from './compono/types'
import AppHeader from './components/AppHeader.vue'
import DiagnosticsPanel from './components/DiagnosticsPanel.vue'
import InputPanel from './components/InputPanel.vue'
import OutputPanel from './components/OutputPanel.vue'
import { notice, start } from './state/playground'

const inputPanel = ref<InstanceType<typeof InputPanel>>()
const split = ref(50)
const main = ref<HTMLElement>()

function dismissNotice() {
  notice.value = ''
}

function reveal(source: string[], range: Range) {
  inputPanel.value?.reveal(source, range)
}

function startResize(e: PointerEvent) {
  const handle = e.currentTarget as HTMLElement
  handle.setPointerCapture(e.pointerId)
  const rect = main.value!.getBoundingClientRect()
  const move = (ev: PointerEvent) => {
    split.value = Math.min(80, Math.max(20, ((ev.clientX - rect.left) / rect.width) * 100))
  }
  const stop = () => {
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', stop)
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', stop)
}

function resizeWithKeys(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') split.value = Math.max(20, split.value - 2)
  if (e.key === 'ArrowRight') split.value = Math.min(80, split.value + 2)
}

onMounted(() => void start())
</script>

<template>
  <div class="app">
    <AppHeader />
    <p v-if="notice" class="notice" role="status">
      {{ notice }}
      <button type="button" aria-label="Dismiss" @click="dismissNotice">×</button>
    </p>
    <main ref="main" class="main" :style="{ '--split': `${split}%` }">
      <div class="left">
        <InputPanel ref="inputPanel" class="input" />
        <DiagnosticsPanel class="diagnostics" @reveal="reveal" />
      </div>
      <div
        class="splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        :aria-valuenow="Math.round(split)"
        tabindex="0"
        @pointerdown="startResize"
        @keydown="resizeWithKeys"
      />
      <OutputPanel class="right" />
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  padding: 6px 16px;
  background: var(--accent-soft);
  font-size: 13px;
}

.notice button {
  border: none;
  background: none;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--split) 6px 1fr;
}

.left {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.input {
  flex: 1 1 65%;
}

.diagnostics {
  flex: 0 1 35%;
  border-top: 1px solid var(--border);
}

.right {
  min-width: 0;
}

.splitter {
  cursor: col-resize;
  background: var(--border);
  touch-action: none;
}

.splitter:hover,
.splitter:focus-visible {
  background: var(--accent);
  outline: none;
}

@media (max-width: 800px) {
  .main {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .left {
    flex: none;
    height: 75vh;
  }

  .splitter {
    display: none;
  }

  .right {
    flex: none;
    height: 70vh;
    border-top: 1px solid var(--border);
  }
}
</style>
