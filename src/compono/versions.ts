import type { ComponoVersion, VersionManifest } from './types'

export function versionBaseURL(version: ComponoVersion): string {
  return new URL(`${import.meta.env.BASE_URL}compono/${version.path}/`, location.href).href
}

const STABLE_TAG = /^v\d+\.\d+\.\d+$/

/** The newest release, or the first version (main) when there is none. */
export function defaultVersion(versions: ComponoVersion[]): ComponoVersion | undefined {
  return versions.find((v) => STABLE_TAG.test(v.id)) ?? versions[0]
}

export async function loadManifest(): Promise<VersionManifest> {
  const res = await fetch(`${import.meta.env.BASE_URL}compono/versions.json`, { cache: 'no-cache' })
  if (!res.ok) {
    throw new Error(`Could not load the Compono versions (${res.status})`)
  }
  const manifest = (await res.json()) as VersionManifest
  if (manifest.versions.length === 0) {
    throw new Error('No Compono version has been built yet.')
  }
  return manifest
}
