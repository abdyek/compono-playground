import { beforeAll, describe, expect, it } from 'vitest'
import type { ConvertRequest, ConvertResponse } from '../compono/types'
import { loadDefaultBridge } from '../testing/wasm'
import { examples } from './examples'

let convert: (req: ConvertRequest) => ConvertResponse

beforeAll(async () => {
  convert = await loadDefaultBridge()
})

describe('examples', () => {
  for (const ex of examples) {
    it(ex.id, () => {
      const res = convert({ source: ex.source, globals: ex.globals, context: ex.context })
      if (ex.id === 'fatal') {
        expect(res.fatal?.kind).toBe('compono')
        return
      }
      expect(res.fatal).toBeNull()
      if (ex.id === 'diagnostics') {
        expect(res.diagnostics!.length).toBeGreaterThan(0)
      } else {
        expect(res.diagnostics).toEqual([])
      }
      expect(res.html).toMatchSnapshot()
    })
  }
})
