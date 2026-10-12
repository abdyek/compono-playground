import type { Example, GlobalComponent } from '../compono/types'

const lines = (...l: string[]) => l.join('\n')

/**
 * The first example, before the golden examples of the selected build. It is
 * written for the version the playground opens by default.
 */
export const welcome: Example = {
  id: 'welcome',
  number: 0,
  title: 'Welcome to Compono',
  source: lines(
    '// Comment lines like this one never reach the output.',
    '// Edit anything: the output on the right updates as you type.',
    '# Welcome to Compono',
    '',
    'Compono is **Markdown** with *components*. It writes semantic HTML and nothing else: no classes, no styles, no scripts.',
    '',
    '## Markdown',
    '',
    '- **Bold**, *italic* and `inline code`',
    '- [Links](https://github.com/umono-cms/compono), lists and quotes',
    '- Tables, code blocks and thematic breaks',
    '',
    '> Write the content once, show it with any theme.',
    '',
    '| Write      | Get      |',
    '| ---------- | -------- |',
    '| `**bold**` | **bold** |',
    '| `*italic*` | *italic* |',
    '',
    '```js',
    'console.log("Code blocks keep their language")',
    '```',
    '',
    '---',
    '',
    '## Components',
    '',
    'Define a component at the bottom of the source with `~`, then call it anywhere with `{{ }}`:',
    '',
    '{{ FEATURE title = "Reusable" text = "Define it once, call it anywhere." }}',
    '{{ FEATURE title = "Semantic" text = "Plain HTML that any theme can style." }}',
    '',
    "Built-in components do what Markdown can't, like a link that opens in a new tab: " +
      '{{ LINK text = "Compono on GitHub" url = "https://github.com/umono-cms/compono" new-tab = true }}',
    '',
    'Global components are given from outside the source (see the **SIGNATURE** tab), and the context injects data into the conversion (see **Context**):',
    '',
    '{{ SIGNATURE closing = "Happy writing" }}',
    '',
    '~ FEATURE title = "" text = ""',
    '### {{ title }}',
    '{{ text }}',
  ),
  globals: [
    {
      name: 'SIGNATURE',
      source: lines(
        '// A global component: given to the conversion, not defined in the source.',
        '~ closing = "Thanks for reading"',
        '{{ closing }}, **{{ context(site/author) }}**',
      ),
    },
  ],
  context: JSON.stringify({ 'site/author': 'Jane Doe' }, null, 2),
}

export function isWelcome(ex: Example): boolean {
  return ex.id === welcome.id
}

/** The label of an example in the picker. */
export function exampleLabel(ex: Example): string {
  return isWelcome(ex) ? ex.title : `#${ex.number} ${ex.title}`
}

function globalsText(globals: GlobalComponent[] = []): string {
  return globals.map((g) => `${g.name}\n${g.source}\n${globalsText(g.globals)}`).join('\n')
}

interface Indexed {
  example: Example
  /** Number, id and title, lowercased. */
  meta: string
  /** Everything else that is searched, lowercased. */
  content: string
}

const indexes = new WeakMap<Example[], Indexed[]>()

function indexOf(list: Example[]): Indexed[] {
  let index = indexes.get(list)
  if (!index) {
    index = list.map((example) => ({
      example,
      meta: `${isWelcome(example) ? '' : `#${example.number}`} ${example.id} ${example.title}`.toLowerCase(),
      content: `${example.source}\n${globalsText(example.globals)}\n${example.context}`.toLowerCase(),
    }))
    indexes.set(list, index)
  }
  return index
}

/**
 * The examples that contain every word of the query in their number, name or
 * content. Matches in the number or name come first; the order is otherwise
 * kept.
 */
export function searchExamples(list: Example[], query: string): Example[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return list
  }
  const byName: Example[] = []
  const byContent: Example[] = []
  for (const { example, meta, content } of indexOf(list)) {
    if (words.every((w) => meta.includes(w))) {
      byName.push(example)
    } else if (words.every((w) => meta.includes(w) || content.includes(w))) {
      byContent.push(example)
    }
  }
  return [...byName, ...byContent]
}

/** The example before (-1) or after (1) the one with id, or undefined at the ends. */
export function neighbor(list: Example[], id: string, step: -1 | 1): Example | undefined {
  const i = list.findIndex((ex) => ex.id === id)
  return i < 0 ? undefined : list[i + step]
}

/** Globals without the scope fields that change nothing. */
export function normalizeGlobals(globals: GlobalComponent[]): GlobalComponent[] {
  return globals.map((g) => {
    const out: GlobalComponent = { name: g.name, source: g.source }
    if (g.isolated) out.isolated = true
    if (g.globals?.length) out.globals = normalizeGlobals(g.globals)
    return out
  })
}

/** Whether an input is the example as it was loaded. */
export function isUnchanged(ex: Example, input: { source: string; globals: GlobalComponent[]; context: string }) {
  return (
    input.source === ex.source &&
    input.context === ex.context &&
    JSON.stringify(normalizeGlobals(input.globals)) === JSON.stringify(normalizeGlobals(ex.globals))
  )
}
