import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { html } from '@codemirror/lang-html'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { bracketMatching, syntaxHighlighting } from '@codemirror/language'
import { lintGutter, linter, lintKeymap } from '@codemirror/lint'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { EditorState, type Extension } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { classHighlighter } from '@lezer/highlight'
import { compono } from './compono-language'

export type EditorLanguage = 'compono' | 'json' | 'html'

// Colors come from CSS variables (src/style.css), so the editor follows the
// page's light and dark themes.
const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13.5px',
    color: 'var(--text)',
    backgroundColor: 'var(--editor-bg)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--mono)',
    lineHeight: '1.6',
  },
  '.cm-content': { caretColor: 'var(--text)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--text)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--text-faint)',
    border: 'none',
  },
  '.cm-activeLine': { backgroundColor: 'var(--active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--active-line)', color: 'var(--text-muted)' },
  '.cm-matchingBracket': { backgroundColor: 'var(--selection)', outline: 'none' },
  '.cm-selectionMatch': { backgroundColor: 'var(--selection-match)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
  },
  '.cm-diagnostic': { fontFamily: 'var(--sans)' },
  '.cm-panels': { backgroundColor: 'var(--surface)', color: 'var(--text)' },
})

const languages: Record<EditorLanguage, () => Extension> = {
  compono: () => compono,
  json: () => [json(), linter(jsonParseLinter(), { delay: 300 })],
  html: () => html(),
}

export function editorExtensions(language: EditorLanguage, readonly: boolean): Extension {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    history(),
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    lintGutter(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...lintKeymap,
      indentWithTab,
    ]),
    syntaxHighlighting(classHighlighter),
    theme,
    EditorView.lineWrapping,
    languages[language](),
    EditorState.readOnly.of(readonly),
    EditorView.editable.of(!readonly),
  ]
}
