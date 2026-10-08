import { describe, expect, it } from 'vitest'
import { decodeSnapshot, encodeSnapshot, type Snapshot } from './share'

describe('share', () => {
  const snapshot: Snapshot = {
    version: 'main',
    source: '# Merhaba dünya 😀\n{{ PAGE }}',
    globals: [{ name: 'PAGE', source: 'title = ""\n# {{ title }}' }],
    context: '{"a/b": 1}',
  }

  it('round-trips a snapshot', async () => {
    const hash = await encodeSnapshot(snapshot)
    expect(hash).toMatch(/^#s=[A-Za-z0-9_-]+$/)
    expect(await decodeSnapshot(hash)).toEqual(snapshot)
  })

  it('rejects other hashes', async () => {
    expect(await decodeSnapshot('')).toBeNull()
    expect(await decodeSnapshot('#other')).toBeNull()
    expect(await decodeSnapshot('#s=not-deflate')).toBeNull()
  })
})
