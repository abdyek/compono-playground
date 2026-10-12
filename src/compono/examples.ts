import type { ComponoVersion, Example, ExampleFile } from './types'
import { versionBaseURL } from './versions'

const cache = new Map<string, Promise<Example[] | null>>()

/**
 * The golden examples of a build, or null for a build without examples.json
 * (one made before builds had examples). A build never changes, so it is
 * fetched once.
 */
export function loadGoldenExamples(version: ComponoVersion): Promise<Example[] | null> {
  let examples = cache.get(version.path)
  if (!examples) {
    examples = fetchExamples(version)
    cache.set(version.path, examples)
    // A failed fetch is tried again next time.
    examples.catch(() => cache.delete(version.path))
  }
  return examples
}

async function fetchExamples(version: ComponoVersion): Promise<Example[] | null> {
  const res = await fetch(`${versionBaseURL(version)}examples.json`)
  // A dev server answers a missing file with the page.
  if (res.status === 404 || (res.ok && !res.headers.get('content-type')?.includes('json'))) {
    return null
  }
  if (!res.ok) {
    throw new Error(`Could not load the examples of Compono ${version.label} (${res.status})`)
  }
  return ((await res.json()) as ExampleFile).examples
}
