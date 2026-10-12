import { describe, expect, it } from 'vitest'
import { decodeSnapshot, encodeSnapshot, type Snapshot } from './share'

/** A link hash of raw JSON, as an older or a broken encoder would make it. */
async function hashOf(json: string): Promise<string> {
  const out = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  const bytes = new Uint8Array(await new Response(out).arrayBuffer())
  return '#s=' + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

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

  it('round-trips sub-components and isolated scopes', async () => {
    const scoped: Snapshot = {
      ...snapshot,
      globals: [
        {
          name: 'LAYOUT',
          source: '{{ CARD }}',
          isolated: true,
          globals: [{ name: 'CARD', source: 'card', globals: [{ name: 'DEEP', source: 'deep', isolated: true }] }],
        },
        { name: 'CARD', source: 'root card' },
      ],
    }
    expect(await decodeSnapshot(await encodeSnapshot(scoped))).toEqual(scoped)
  })

  it('opens links of the first format', async () => {
    const json = JSON.stringify([1, 'main', '{{ PAGE }}', [['PAGE', 'page']], ''])
    expect(await decodeSnapshot(await hashOf(json))).toEqual({
      version: 'main',
      source: '{{ PAGE }}',
      globals: [{ name: 'PAGE', source: 'page' }],
      context: '',
    })
  })

  it('rejects malformed globals', async () => {
    expect(await decodeSnapshot(await hashOf(JSON.stringify([2, 'main', '', [['A', 'a']], ''])))).toBeNull()
    expect(await decodeSnapshot(await hashOf(JSON.stringify([2, 'main', '', [['A', 'a', 2, []]], ''])))).toBeNull()
    expect(
      await decodeSnapshot(await hashOf(JSON.stringify([2, 'main', '', [['A', 'a', 0, [['B']]]], '']))),
    ).toBeNull()
    expect(await decodeSnapshot(await hashOf(JSON.stringify([3, 'main', '', [], ''])))).toBeNull()
  })

  it('rejects other hashes', async () => {
    expect(await decodeSnapshot('')).toBeNull()
    expect(await decodeSnapshot('#other')).toBeNull()
    expect(await decodeSnapshot('#s=not-deflate')).toBeNull()
  })
})
