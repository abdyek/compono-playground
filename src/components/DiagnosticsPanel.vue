<script setup lang="ts">
import { computed } from 'vue'
import type { Range } from '../compono/types'
import { result } from '../state/playground'
import RichMessage from './RichMessage.vue'

const emit = defineEmits<{ reveal: [source: string[], range: Range] }>()

const diagnostics = computed(() => result.value?.diagnostics ?? [])

function where(source: string[], range: Range) {
  const name = source.length ? source.join(' › ') : 'Source'
  return `${name} ${range.start.line}:${range.start.column}`
}
</script>

<template>
  <section class="panel" aria-label="Diagnostics">
    <h2 class="title">
      Diagnostics
      <span v-if="diagnostics.length" class="count">{{ diagnostics.length }}</span>
    </h2>
    <p v-if="!result || result.fatal" class="empty">
      {{ result?.fatal ? 'No diagnostics: the conversion stopped with a fatal error.' : '' }}
    </p>
    <p v-else-if="diagnostics.length === 0" class="empty">No diagnostics. Every unit was rendered.</p>
    <ol v-else class="list">
      <li v-for="(d, i) in diagnostics" :key="i" class="item">
        <button type="button" class="main" @click="emit('reveal', d.source, d.range)">
          <span class="code">{{ d.code }}</span>
          <RichMessage :text="d.message" class="message" />
          <span class="where">{{ where(d.source, d.range) }}</span>
        </button>
        <div v-if="d.calls.length" class="calls">
          <span class="via">via</span>
          <template v-for="(c, j) in d.calls" :key="j">
            <span v-if="j > 0" class="sep" aria-hidden="true">›</span>
            <button
              type="button"
              class="call"
              :title="`${c.kind} call at ${where(c.source, c.range)}`"
              @click="emit('reveal', c.source, c.range)"
            >
              {{ c.name }}<span class="kind">{{ c.kind }}</span>
            </button>
          </template>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--surface);
}

.title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--error-soft);
  color: var(--error);
  font-size: 11px;
  text-align: center;
}

.empty {
  margin: 0;
  padding: 10px 12px;
  color: var(--text-muted);
  font-size: 13px;
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}

.item {
  padding: 6px 12px 8px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.main {
  display: flex;
  align-items: baseline;
  gap: 4px 10px;
  flex-wrap: wrap;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
}

.item:hover {
  background: var(--active-line);
}

.code {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--error);
}

.message {
  flex: 1;
  min-width: 200px;
}

.where {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-muted);
}

.calls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.call {
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  font-family: var(--mono);
  font-size: 12px;
  cursor: pointer;
}

.kind {
  margin-left: 4px;
  color: var(--text-faint);
}
</style>
