import { beforeAll, describe, expect, it } from 'vitest'
import type { ConvertRequest, ConvertResponse, Example } from '../compono/types'
import { hasLocalBuild, loadDefaultBridge } from '../testing/wasm'
import { exampleLabel, isUnchanged, neighbor, searchExamples, welcome } from './examples'

const golden = (number: number, name: string, source = '', more: Partial<Example> = {}): Example => ({
  id: `${String(number).padStart(4, '0')}_${name.replaceAll(' ', '_')}`,
  number,
  title: name,
  source,
  globals: [],
  context: '',
  ...more,
})

const list: Example[] = [
  welcome,
  golden(0, 'empty'),
  golden(1, 'basic', '# Hello'),
  golden(2, 'with global', '{{ HEADER }}', { globals: [{ name: 'HEADER', source: 'scope note' }] }),
  golden(494, 'scope readme example', '{{ CARD }}'),
  golden(495, 'context direct', '{{ context(app/version) }}', { context: '{"app/version": "1.2.3"}' }),
]

const ids = (examples: Example[]) => examples.map((ex) => ex.number)

describe('searchExamples', () => {
  it('returns every example for an empty query', () => {
    expect(searchExamples(list, '  ')).toBe(list)
  })

  it('finds by number, name and content, name matches first', () => {
    expect(ids(searchExamples(list, '494'))).toEqual([494])
    expect(ids(searchExamples(list, '#2'))).toEqual([2])
    expect(ids(searchExamples(list, 'SCOPE'))).toEqual([494, 2])
    expect(ids(searchExamples(list, 'app/version'))).toEqual([495])
    expect(ids(searchExamples(list, 'context 1.2.3'))).toEqual([495])
    expect(searchExamples(list, 'welcome')).toEqual([welcome])
    expect(ids(searchExamples(list, '#0'))).toEqual([0])
    expect(searchExamples(list, 'nothing-like-this')).toEqual([])
  })
})

describe('neighbor', () => {
  it('steps through the list and stops at the ends', () => {
    expect(neighbor(list, 'welcome', 1)?.id).toBe('0000_empty')
    expect(neighbor(list, '0494_scope_readme_example', -1)?.number).toBe(2)
    expect(neighbor(list, 'welcome', -1)).toBeUndefined()
    expect(neighbor(list, '0495_context_direct', 1)).toBeUndefined()
    expect(neighbor(list, '', 1)).toBeUndefined()
  })
})

describe('isUnchanged', () => {
  const ex = golden(3, 'scoped', 'x', {
    globals: [{ name: 'A', source: 'a', isolated: true, globals: [{ name: 'B', source: 'b' }] }],
  })

  it('ignores scope fields that change nothing', () => {
    const globals = [
      { name: 'A', source: 'a', isolated: true, globals: [{ name: 'B', source: 'b', isolated: false, globals: [] }] },
    ]
    expect(isUnchanged(ex, { source: 'x', globals, context: '' })).toBe(true)
  })

  it('sees any change', () => {
    expect(isUnchanged(ex, { source: 'y', globals: ex.globals, context: '' })).toBe(false)
    expect(isUnchanged(ex, { source: 'x', globals: ex.globals, context: '{}' })).toBe(false)
    expect(isUnchanged(ex, { source: 'x', globals: [{ ...ex.globals[0], isolated: false }], context: '' })).toBe(false)
  })
})

it('labels golden examples with their number', () => {
  expect(exampleLabel(list[4])).toBe('#494 scope readme example')
  expect(exampleLabel(list[1])).toBe('#0 empty')
  expect(exampleLabel(welcome)).toBe('Welcome to Compono')
})

let convert: (req: ConvertRequest) => ConvertResponse

// The welcome example needs a Compono build: scripts/build-wasm.sh main
describe.skipIf(!hasLocalBuild)('welcome', () => {
  beforeAll(async () => {
    convert = await loadDefaultBridge()
  })

  it('converts without diagnostics', () => {
    const res = convert({ source: welcome.source, globals: welcome.globals, context: welcome.context })
    expect(res.fatal).toBeNull()
    expect(res.diagnostics).toEqual([])
    expect(res.html).toMatchSnapshot()
  })
})
