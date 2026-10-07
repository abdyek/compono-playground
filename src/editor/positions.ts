import type { Text } from '@codemirror/state'
import type { Position } from '../compono/types'

/**
 * Converts a Compono position (1-based line, 1-based column in runes) to an
 * offset in a CodeMirror document, whose columns are UTF-16 code units.
 */
export function toDocOffset(doc: Text, pos: Position): number {
  if (pos.line < 1) {
    return 0
  }
  if (pos.line > doc.lines) {
    return doc.length
  }
  const line = doc.line(pos.line)
  let units = 0
  for (let rune = 1; rune < pos.column && units < line.text.length; rune++) {
    units += line.text.codePointAt(units)! > 0xffff ? 2 : 1
  }
  return line.from + units
}
