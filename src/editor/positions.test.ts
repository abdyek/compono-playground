import { Text } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { toDocOffset } from './positions'

const pos = (line: number, column: number) => ({ offset: 0, line, column })

describe('toDocOffset', () => {
  const doc = Text.of(['ab', 'ü😀x', ''])

  it('counts columns in runes', () => {
    expect(toDocOffset(doc, pos(1, 1))).toBe(0)
    expect(toDocOffset(doc, pos(1, 3))).toBe(2)
    // "ü" is one unit, "😀" is two.
    expect(toDocOffset(doc, pos(2, 3))).toBe(3 + 1 + 2)
    expect(toDocOffset(doc, pos(2, 4))).toBe(3 + 1 + 2 + 1)
  })

  it('clamps out of range positions', () => {
    expect(toDocOffset(doc, pos(1, 99))).toBe(2)
    expect(toDocOffset(doc, pos(9, 1))).toBe(doc.length)
    expect(toDocOffset(doc, pos(0, 0))).toBe(0)
  })
})
