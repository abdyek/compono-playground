<script setup lang="ts">
import { setDiagnostics, type Diagnostic as LintDiagnostic } from '@codemirror/lint'
import { EditorView } from '@codemirror/view'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Range } from '../compono/types'
import { toDocOffset } from '../editor/positions'
import { editorExtensions, type EditorLanguage } from '../editor/setup'

export interface EditorMark {
  range: Range
  message: string
  severity: 'error' | 'info'
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    language: EditorLanguage
    readonly?: boolean
    marks?: EditorMark[]
    label: string
  }>(),
  { readonly: false, marks: () => [] },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const host = ref<HTMLElement>()
let view: EditorView | undefined

function toLint(marks: EditorMark[]): LintDiagnostic[] {
  const doc = view!.state.doc
  return marks.map((m) => {
    const from = toDocOffset(doc, m.range.start)
    return {
      from,
      to: Math.max(from, toDocOffset(doc, m.range.end)),
      message: m.message,
      severity: m.severity,
    }
  })
}

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    doc: props.modelValue,
    extensions: [
      editorExtensions(props.language, props.readonly),
      EditorView.contentAttributes.of({ 'aria-label': props.label }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit('update:modelValue', update.state.doc.toString())
        }
      }),
    ],
  })
  view.dispatch(setDiagnostics(view.state, toLint(props.marks)))
})

onBeforeUnmount(() => view?.destroy())

watch(
  () => props.modelValue,
  (value) => {
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  },
)

watch(
  () => props.marks,
  (marks) => {
    if (view) {
      view.dispatch(setDiagnostics(view.state, toLint(marks)))
    }
  },
)

/** Selects a range, scrolls to it and focuses the editor. */
function reveal(range: Range) {
  if (!view) {
    return
  }
  const doc = view.state.doc
  const anchor = toDocOffset(doc, range.start)
  const head = Math.max(anchor, toDocOffset(doc, range.end))
  view.dispatch({
    selection: { anchor, head },
    effects: EditorView.scrollIntoView(anchor, { y: 'center' }),
  })
  view.focus()
}

defineExpose({ reveal })
</script>

<template>
  <div ref="host" class="code-editor" />
</template>

<style scoped>
.code-editor {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
</style>
