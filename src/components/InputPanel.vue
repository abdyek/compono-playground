<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Diagnostic, Range } from '../compono/types'
import { findByPath, flatten, type GlobalEntry } from '../state/globals'
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

/** Every global, each owner followed by its sub-components. */
const scoped = computed(() => flatten(input.globals))

/** The tab a Compono source path ([] or [GLOBAL, ...SUB]) is edited in. */
function tabOf(source: string[]): Tab | undefined {
  if (source.length === 0) {
    return 'source'
  }
  return findByPath(input.globals, source)?.id
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

const activeGlobal = computed(() => scoped.value.find((s) => s.global.id === active.value)?.global)

// Loading an example or a link replaces the globals.
watch(
  () => scoped.value.map((s) => s.global.id),
  (ids) => {
    if (typeof active.value === 'number' && !ids.includes(active.value)) {
      active.value = 'source'
    }
  },
)

const nameIsValid = (name: string) => /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(name)

function onAddGlobal(owner?: GlobalEntry) {
  active.value = addGlobal(owner).id
}

function onRemoveGlobal(g: GlobalEntry) {
  const subs = flatten(g.globals).length
  const question = subs
    ? `Delete the global component ${g.name} and its ${subs === 1 ? 'sub-component' : `${subs} sub-components`}?`
    : `Delete the global component ${g.name}?`
  if ((subs || g.source.trim()) && !confirm(question)) {
    return
  }
  removeGlobal(g.id)
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
        v-for="{ global: g, path } in scoped"
        :key="g.id"
        type="button"
        role="tab"
        class="mono"
        :aria-selected="active === g.id"
        :class="{ active: active === g.id }"
        :title="`${path.length > 1 ? 'Sub-component' : 'Global component'} ${path.join(' › ')}${g.isolated ? ', isolated scope' : ''}`"
        @click="active = g.id"
      >
        <span v-if="path.length > 1" class="owners">{{ path.slice(0, -1).join(' › ') }} ›</span>
        {{ g.name || '(unnamed)' }}
        <svg v-if="g.isolated" class="lock" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.5" />
          <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
        </svg>
        <span v-if="marks.get(g.id)?.length" class="badge">{{ marks.get(g.id)!.length }}</span>
      </button>
      <button type="button" class="add" title="Add a global component" @click="onAddGlobal()">+ Global</button>
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
      <label
        title="WithIsolatedScope: calls in it and its sub-components resolve only to their locals, its sub-components and built-ins."
      >
        <input v-model="activeGlobal.isolated" type="checkbox" />
        Isolated
      </label>
      <button
        type="button"
        class="add-sub"
        title="Add a sub-component, visible only from this global and its other sub-components"
        @click="onAddGlobal(activeGlobal)"
      >
        + Sub-component
      </button>
      <button type="button" class="delete" @click="onRemoveGlobal(activeGlobal)">Delete</button>
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
        v-for="{ global: g, path } in scoped"
        v-show="active === g.id"
        :key="g.id"
        :ref="(el) => setEditor(g.id, el)"
        v-model="g.source"
        language="compono"
        :label="`Global component ${path.join(' › ')}`"
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

.owners {
  color: var(--text-muted);
}

.lock {
  width: 11px;
  height: 11px;
  color: var(--text-muted);
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

.toolbar input:not([type='checkbox']) {
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

.add-sub {
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  color: var(--accent);
  cursor: pointer;
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
