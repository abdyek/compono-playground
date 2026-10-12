import { describe, expect, it } from 'vitest'
import type { GlobalComponent } from '../compono/types'
import { addTo, findByPath, flatten, remove, toComponents, toEntries } from './globals'

const components: GlobalComponent[] = [
  { name: 'CARD', source: '# Root Card' },
  {
    name: 'LAYOUT',
    source: '{{ CARD }}',
    isolated: true,
    globals: [
      { name: 'CARD', source: '*Layout Card*', globals: [{ name: 'DEEP', source: 'deep' }] },
      { name: 'TABLE', source: '**Table**' },
    ],
  },
]

describe('globals', () => {
  it('round-trips components and leaves out unused scope fields', () => {
    expect(toComponents(toEntries(components))).toEqual(components)
    expect(toComponents(toEntries([{ name: 'A', source: 'a', isolated: false, globals: [] }]))).toEqual([
      { name: 'A', source: 'a' },
    ])
  })

  it('lists owners before their sub-components', () => {
    expect(flatten(toEntries(components)).map((s) => s.path.join('/'))).toEqual([
      'CARD',
      'LAYOUT',
      'LAYOUT/CARD',
      'LAYOUT/CARD/DEEP',
      'LAYOUT/TABLE',
    ])
  })

  it('finds a global by its scope path', () => {
    const entries = toEntries(components)
    expect(findByPath(entries, ['CARD'])?.source).toBe('# Root Card')
    expect(findByPath(entries, ['LAYOUT', 'CARD'])?.source).toBe('*Layout Card*')
    expect(findByPath(entries, ['LAYOUT', 'CARD', 'DEEP'])?.source).toBe('deep')
    expect(findByPath(entries, ['TABLE'])).toBeUndefined()
    expect(findByPath(entries, [])).toBeUndefined()
  })

  it('removes a global with its sub-components', () => {
    const entries = toEntries(components)
    expect(remove(entries, findByPath(entries, ['LAYOUT', 'CARD'])!.id)).toBe(true)
    expect(flatten(entries).map((s) => s.path.join('/'))).toEqual(['CARD', 'LAYOUT', 'LAYOUT/TABLE'])
    expect(remove(entries, -1)).toBe(false)
  })

  it('adds a global with a name that is free in its scope', () => {
    const scope = toEntries([{ name: 'SUB_2', source: '' }])
    expect(addTo(scope, 'SUB').name).toBe('SUB_3')
    expect(addTo(scope, 'SUB').name).toBe('SUB_4')
    expect(addTo([], 'GLOBAL').name).toBe('GLOBAL_1')
  })
})
