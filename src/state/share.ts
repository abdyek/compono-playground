import type { GlobalComponent } from '../compono/types'

/** Everything needed to reproduce a conversion. */
export interface Snapshot {
  version: string
  source: string
  globals: GlobalComponent[]
  context: string
}

const HASH_PREFIX = '#s='
// 1: globals are [name, source]. 2: [name, source, isolated (0 or 1), sub-components].
const FORMAT = 2

type PackedGlobal = [string, string, 0 | 1, PackedGlobal[]]

function pack(globals: GlobalComponent[]): PackedGlobal[] {
  return globals.map((g) => [g.name, g.source, g.isolated ? 1 : 0, pack(g.globals ?? [])])
}

/** Unpacks the globals of a link, or returns null if they are malformed. */
function unpack(format: number, globals: unknown): GlobalComponent[] | null {
  if (!Array.isArray(globals)) {
    return null
  }
  const out: GlobalComponent[] = []
  for (const g of globals) {
    if (!Array.isArray(g) || typeof g[0] !== 'string' || typeof g[1] !== 'string') {
      return null
    }
    const global: GlobalComponent = { name: g[0], source: g[1] }
    if (format >= 2) {
      const sub = unpack(format, g[3])
      if ((g[2] !== 0 && g[2] !== 1) || sub === null) {
        return null
      }
      if (g[2] === 1) global.isolated = true
      if (sub.length) global.globals = sub
    }
    out.push(global)
  }
  return out
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

function toBase64URL(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64URL(text: string): Uint8Array {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

/** Encodes a snapshot as a URL hash (#s=...). */
export async function encodeSnapshot(s: Snapshot): Promise<string> {
  const json = JSON.stringify([FORMAT, s.version, s.source, pack(s.globals), s.context])
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw'))
  return HASH_PREFIX + toBase64URL(packed)
}

/** Decodes a URL hash made by encodeSnapshot. Returns null for any other hash. */
export async function decodeSnapshot(hash: string): Promise<Snapshot | null> {
  if (!hash.startsWith(HASH_PREFIX)) {
    return null
  }
  try {
    const json = await pipe(fromBase64URL(hash.slice(HASH_PREFIX.length)), new DecompressionStream('deflate-raw'))
    const [format, version, source, packed, context] = JSON.parse(new TextDecoder().decode(json))
    if (
      (format !== 1 && format !== FORMAT) ||
      typeof version !== 'string' ||
      typeof source !== 'string' ||
      typeof context !== 'string'
    ) {
      return null
    }
    const globals = unpack(format, packed)
    return globals && { version, source, globals, context }
  } catch {
    return null
  }
}
