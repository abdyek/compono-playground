import { StreamLanguage, type StringStream } from '@codemirror/language'

// A highlighter for Compono sources. It only colors; Compono's own parser
// decides what the source means.

interface State {
  /** Inside a fenced code block. */
  fence: boolean
  /** Depth of {{ }} units the current position is in. */
  unit: number
  /** Depth of record braces inside a unit. */
  brace: number
  /** On a local component definition line (~ NAME ...). */
  def: boolean
  /** The definition line's name was read. */
  defNamed: boolean
  /** On a heading line. */
  heading: boolean
}

function expression(stream: StringStream, state: State): string | null {
  if (stream.eatSpace()) {
    return null
  }
  if (state.unit > 0 && state.brace === 0 && stream.match('}}')) {
    state.unit--
    return 'meta'
  }
  const ch = stream.peek()!
  if (ch === '{') {
    stream.next()
    state.brace++
    return 'bracket'
  }
  if (ch === '}') {
    stream.next()
    state.brace = Math.max(0, state.brace - 1)
    return 'bracket'
  }
  if ('[]()'.includes(ch)) {
    stream.next()
    return 'bracket'
  }
  if (stream.match(/^"(?:[^"]|"")*"?/)) {
    return 'string'
  }
  if (stream.match(/^-?\d+\b/)) {
    return 'number'
  }
  if (stream.match(/^(?:true|false)\b/)) {
    return 'bool'
  }
  if (stream.match(/^context(?=\s*\()/)) {
    return 'keyword'
  }
  if (stream.match(/^[A-Z][A-Z0-9_]*/)) {
    if (state.def && !state.defNamed) {
      state.defNamed = true
      return 'className'
    }
    return 'typeName'
  }
  if (stream.match(/^[a-z][a-z0-9-]*!?(?=\s*[=:])/)) {
    return 'propertyName'
  }
  if (stream.match(/^[a-z][a-z0-9-]*(?:\/[a-z0-9-]+)*/)) {
    return 'variableName'
  }
  stream.next()
  return '=:'.includes(ch) ? 'operator' : 'punctuation'
}

function text(stream: StringStream, state: State): string | null {
  if (stream.match('{{')) {
    state.unit++
    return 'meta'
  }
  const plain = state.heading ? 'heading' : null
  if (stream.match(/^\*\*(?:(?!\*\*|\{\{).)+\*\*/)) {
    return 'strong'
  }
  if (stream.match(/^\*[^*\s{](?:[^*{]*[^*\s{])?\*/)) {
    return 'emphasis'
  }
  if (stream.match(/^`[^`]*`/)) {
    return 'literal'
  }
  if (stream.match(/^\[[^\]]*\]\([^)]*\)/)) {
    return 'link'
  }
  if (!stream.match(/^[^{*`[]+/)) {
    stream.next()
  }
  return plain
}

export const compono = StreamLanguage.define<State>({
  name: 'compono',
  startState: () => ({ fence: false, unit: 0, brace: 0, def: false, defNamed: false, heading: false }),
  copyState: (s) => ({ ...s }),
  token(stream, state) {
    if (stream.sol()) {
      state.def = false
      state.defNamed = false
      state.heading = false
      if (state.fence) {
        if (stream.match(/^[ \t]*```[ \t]*$/)) {
          state.fence = false
          return 'meta'
        }
        stream.skipToEnd()
        return 'literal'
      }
      if (state.unit === 0) {
        if (stream.match(/^[ \t]*\/\/.*/)) {
          return 'comment'
        }
        if (stream.match(/^```.*$/)) {
          state.fence = true
          return 'meta'
        }
        if (stream.match(/^~(?=[ \t])/)) {
          state.def = true
          return 'keyword'
        }
        if (stream.match(/^#{1,6}(?= )/)) {
          state.heading = true
          return 'heading'
        }
      }
    }
    if (state.fence) {
      stream.skipToEnd()
      return 'literal'
    }
    if (state.unit > 0 || state.def) {
      return expression(stream, state)
    }
    return text(stream, state)
  },
  languageData: {
    commentTokens: { line: '//' },
    closeBrackets: { brackets: ['(', '[', '{', '"'] },
  },
})
