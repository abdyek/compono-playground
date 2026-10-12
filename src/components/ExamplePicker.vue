<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { Example } from '../compono/types'
import { exampleLabel, isWelcome, neighbor, searchExamples } from '../state/examples'
import { currentExample, examples, examplesState, hasOwnInput, loadExample } from '../state/playground'

const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const search = ref<HTMLInputElement>()
const list = ref<HTMLElement>()

const open = ref(false)
const query = ref('')
const highlight = ref(0)

const current = computed(() => examples.value.find((ex) => ex.id === currentExample.value))
const previous = computed(() => neighbor(examples.value, currentExample.value, -1))
const next = computed(() => neighbor(examples.value, currentExample.value, 1))
const results = computed(() => searchExamples(examples.value, query.value))

const note = computed(() => {
  switch (examplesState.value) {
    case 'loading':
      return 'Loading the golden examples of this version…'
    case 'none':
      return 'This build has no golden examples.'
    case 'failed':
      return 'Could not load the golden examples of this version.'
    default: {
      const total = examples.value.length - 1
      if (!query.value.trim()) {
        return `${total} golden tests of this Compono version`
      }
      return `${results.value.filter((ex) => !isWelcome(ex)).length} of ${total} golden tests match`
    }
  }
})

/** Loads an example, asking first if it would replace input of the user. */
function go(ex: Example | undefined) {
  if (!ex) {
    return
  }
  if (hasOwnInput() && !confirm(`Replace your input with the "${exampleLabel(ex)}" example?`)) {
    return
  }
  loadExample(ex)
}

function scrollToHighlight(block: ScrollLogicalPosition = 'nearest') {
  list.value?.querySelector<HTMLElement>(`[data-index="${highlight.value}"]`)?.scrollIntoView({ block })
}

async function show() {
  open.value = true
  const i = results.value.findIndex((ex) => ex.id === currentExample.value)
  highlight.value = Math.max(i, 0)
  await nextTick()
  search.value?.focus()
  search.value?.select()
  scrollToHighlight('center')
}

function hide(focusTrigger = true) {
  open.value = false
  if (focusTrigger) trigger.value?.focus()
}

function choose(ex: Example | undefined) {
  hide()
  go(ex)
}

watch(query, async () => {
  highlight.value = 0
  await nextTick()
  if (list.value) list.value.scrollTop = 0
})

function onKeydown(e: KeyboardEvent) {
  const last = results.value.length - 1
  switch (e.key) {
    case 'ArrowDown':
      highlight.value = Math.min(highlight.value + 1, last)
      break
    case 'ArrowUp':
      highlight.value = Math.max(highlight.value - 1, 0)
      break
    case 'PageDown':
      highlight.value = Math.min(highlight.value + 10, last)
      break
    case 'PageUp':
      highlight.value = Math.max(highlight.value - 10, 0)
      break
    case 'Enter':
      choose(results.value[highlight.value])
      break
    case 'Escape':
      hide()
      break
    default:
      return
  }
  e.preventDefault()
  void nextTick(() => scrollToHighlight())
}

function onPointerdown(e: PointerEvent) {
  if (open.value && !root.value?.contains(e.target as Node)) {
    hide(false)
  }
}

document.addEventListener('pointerdown', onPointerdown)
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerdown))
</script>

<template>
  <div ref="root" class="picker">
    <span class="caption">Examples</span>
    <div class="group">
      <button
        type="button"
        class="step"
        :disabled="!previous"
        :title="previous ? `Previous: ${exampleLabel(previous)}` : 'Previous example'"
        aria-label="Previous example"
        @click="go(previous)"
      >
        ‹
      </button>
      <button
        ref="trigger"
        type="button"
        class="current"
        aria-haspopup="dialog"
        :aria-expanded="open"
        :title="current ? exampleLabel(current) : undefined"
        @click="open ? hide() : show()"
      >
        <span class="label">{{ current ? exampleLabel(current) : 'Load an example…' }}</span>
        <span class="caret" aria-hidden="true">▾</span>
      </button>
      <button
        type="button"
        class="step"
        :disabled="!next"
        :title="next ? `Next: ${exampleLabel(next)}` : 'Next example'"
        aria-label="Next example"
        @click="go(next)"
      >
        ›
      </button>
    </div>

    <div v-if="open" class="popover" role="dialog" aria-label="Examples">
      <input
        ref="search"
        v-model="query"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="example-list"
        :aria-activedescendant="results.length ? `example-${highlight}` : undefined"
        aria-expanded="true"
        placeholder="Search by number, name or content"
        spellcheck="false"
        @keydown="onKeydown"
      />
      <ul id="example-list" ref="list" class="list" role="listbox" aria-label="Examples">
        <li
          v-for="(ex, i) in results"
          :id="`example-${i}`"
          :key="ex.id"
          role="option"
          :data-index="i"
          :aria-selected="i === highlight"
          :class="{ highlighted: i === highlight, current: ex.id === currentExample }"
          @mousemove="highlight = i"
          @click="choose(ex)"
        >
          <span class="number">{{ isWelcome(ex) ? '★' : `#${ex.number}` }}</span>
          <span class="title">{{ ex.title }}</span>
        </li>
      </ul>
      <p v-if="!results.length" class="empty">No example matches “{{ query }}”.</p>
      <p class="note">{{ note }}</p>
    </div>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  font-size: 13px;
}

.caption {
  color: var(--text-muted);
}

.group {
  display: flex;
  align-items: stretch;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
}

.group button {
  border: none;
  background: none;
  color: var(--text);
  cursor: pointer;
}

.step {
  flex: none;
  width: 26px;
  font-size: 16px;
  line-height: 1;
}

.step:disabled {
  color: var(--text-faint);
  cursor: default;
}

.group .current {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 1 260px;
  min-width: 0;
  padding: 4px 8px;
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  font-size: 13px;
}

.label {
  flex: 1;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.caret {
  color: var(--text-muted);
  font-size: 11px;
}

.popover {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  width: 440px;
  max-width: calc(100vw - 32px);
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}

.popover input {
  margin: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
}

.popover input:focus {
  border-color: var(--accent);
  outline: none;
}

.list {
  max-height: min(420px, 60vh);
  margin: 0;
  padding: 0 4px 4px;
  overflow-y: auto;
  list-style: none;
}

.list li {
  display: flex;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.list li.highlighted {
  background: var(--accent-soft);
}

.list li.current .title {
  font-weight: 600;
}

.number {
  flex: none;
  min-width: 40px;
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty,
.note {
  margin: 0;
  padding: 6px 12px;
  color: var(--text-muted);
}

.note {
  border-top: 1px solid var(--border);
  font-size: 12px;
}
</style>
