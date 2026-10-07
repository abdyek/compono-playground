<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Diagnostic, Range } from '../compono/types'
import { addGlobal, input, removeGlobal, result } from '../state/playground'
import CodeEditor, { type EditorMark } from './CodeEditor.vue'

type Tab = 'source' | 'context' | number

const active = ref<Tab>('source')
// Not reactive: function refs run on every render.
const editors = new Map<Tab, InstanceType<typeof CodeEditor>>()

function setEditor(tab: Tab, el: unknown) {
  if (el) {
    editors.set(tab, el as InstanceType<typeof CodeEditor>)
  } else {
    editors.delete(tab)
  }
}

const diagnostics = computed<Diagnostic[]>(() => result.value?.diagnostics ?? [])

/** The tab a Compono source path ([] or [GLOBAL, ...]) is edited in. */
function tabOf(source: string[]): Tab | undefined {
  if (source.length === 0) {
    return 'source'
  }
  return input.globals.find((g) => g.name === source[0])?.id
}

const marks = computed(() => {
  const byTab = new Map<Tab, EditorMark[]>()
  for (const d of diagnostics.value) {
    const tab = tabOf(d.source)
    if (tab === undefined) continue
    const list = byTab.get(tab) ?? []
    list.push({ range: d.range, message: `${d.code}: ${d.message.replaceAll('**', '')}`, severity: 'error' })
    byTab.set(tab, list)
  }
  return byTab
})

const noMarks: EditorMark[] = []

const activeGlobal = computed(() => input.globals.find((g) => g.id === active.value))

// Loading an example or a link replaces the globals.
watch(
  () => input.globals.map((g) => g.id),
  (ids) => {
    if (typeof active.value === 'number' && !ids.includes(active.value)) {
      active.value = 'source'
    }
  },
)

const nameIsValid = (name: string) => /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(name)

function onAddGlobal() {
  active.value = addGlobal().id
}

function onRemoveGlobal(id: number) {
  const g = input.globals.find((g) => g.id === id)
  if (g && g.source.trim() && !confirm(`Delete the global component ${g.name}?`)) {
    return
  }
  removeGlobal(id)
  active.value = 'source'
}

/** Opens the editor of a source and selects a range in it. */
async function reveal(source: string[], range: Range) {
  const tab = tabOf(source)
  if (tab === undefined) {
    return
  }
  active.value = tab
  await nextTick()
  editors.get(tab)?.reveal(range)
}

defineExpose({ reveal })
</script>

<template>
  <section class="panel" aria-label="Input">
    <div class="tabs" role="tablist">
      <button
        type="button"
        role="tab"
        :aria-selected="active === 'source'"
        :class="{ active: active === 'source' }"
        @click="active = 'source'"
      >
        Source
        <span v-if="marks.get('source')?.length" class="badge">{{ marks.get('source')!.length }}</span>
      </button>
      <button
        v-for="g in input.globals"
        :key="g.id"
        type="button"
        role="tab"
        class="mono"
        :aria-selected="active === g.id"
        :class="{ active: active === g.id }"
        :title="`Global component ${g.name}`"
        @click="active = g.id"
      >
        {{ g.name || '(unnamed)' }}
        <span v-if="marks.get(g.id)?.length" class="badge">{{ marks.get(g.id)!.length }}</span>
      </button>
      <button type="button" class="add" title="Add a global component" @click="onAddGlobal">+ Global</button>
      <span class="spacer" />
      <button
        type="button"
        role="tab"
        :aria-selected="active === 'context'"
        :class="{ active: active === 'context' }"
        @click="active = 'context'"
      >
        Context
      </button>
    </div>

    <div v-if="activeGlobal" class="toolbar">
      <label>
        Name
        <input
          v-model.trim="activeGlobal.name"
          class="mono"
          spellcheck="false"
          :aria-invalid="!nameIsValid(activeGlobal.name)"
        />
      </label>
      <span v-if="!nameIsValid(activeGlobal.name)" class="hint error">Must be SCREAMING_SNAKE_CASE.</span>
      <span v-else class="hint">Its parameters are defined on its first line.</span>
      <button type="button" class="delete" @click="onRemoveGlobal(activeGlobal.id)">Delete</button>
    </div>
    <div v-else-if="active === 'context'" class="toolbar">
      <span class="hint">
        A JSON object given to <code>WithContext</code>, read with <code>context(key)</code>. Leave it empty for no
        context.
      </span>
    </div>

    <div class="editors">
      <CodeEditor
        v-show="active === 'source'"
        :ref="(el) => setEditor('source', el)"
        v-model="input.source"
        language="compono"
        label="Compono source"
        :marks="marks.get('source') ?? noMarks"
      />
      <CodeEditor
        v-for="g in input.globals"
        v-show="active === g.id"
        :key="g.id"
        :ref="(el) => setEditor(g.id, el)"
        v-model="g.source"
        language="compono"
        :label="`Global component ${g.name}`"
        :marks="marks.get(g.id) ?? noMarks"
      />
      <CodeEditor
        v-show="active === 'context'"
        :ref="(el) => setEditor('context', el)"
        v-model="input.context"
        language="json"
        label="Context JSON"
      />
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
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.tabs button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.tabs button.active {
  color: var(--text);
  border-bottom-color: var(--accent);
}

.tabs button.add {
  color: var(--accent);
}

.spacer {
  flex: 1;
}

.mono {
  font-family: var(--mono);
  font-size: 12.5px;
}

.badge {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--error-soft);
  color: var(--error);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.toolbar label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar input {
  width: 200px;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
}

.toolbar input[aria-invalid='true'] {
  border-color: var(--error);
}

.hint code {
  font-family: var(--mono);
}

.hint.error {
  color: var(--error);
}

.delete {
  margin-left: auto;
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  color: var(--error);
  cursor: pointer;
}

.editors {
  flex: 1;
  min-height: 0;
}
</style>
