import type { GlobalComponent } from '../compono/types'

/** Everything needed to reproduce a conversion. */
export interface Snapshot {
  version: string
  source: string
  globals: GlobalComponent[]
  context: string
}

const HASH_PREFIX = '#s='
const FORMAT = 1

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
  const json = JSON.stringify([FORMAT, s.version, s.source, s.globals.map((g) => [g.name, g.source]), s.context])
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
    const [format, version, source, globals, context] = JSON.parse(new TextDecoder().decode(json))
    if (
      format !== FORMAT ||
      typeof version !== 'string' ||
      typeof source !== 'string' ||
      typeof context !== 'string' ||
      !Array.isArray(globals) ||
      !globals.every((g) => Array.isArray(g) && typeof g[0] === 'string' && typeof g[1] === 'string')
    ) {
      return null
    }
    return {
      version,
      source,
      globals: globals.map(([name, source]: [string, string]) => ({ name, source })),
      context,
    }
  } catch {
    return null
  }
}
