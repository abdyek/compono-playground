import type { VersionManifest } from './types'

export function versionBaseURL(id: string): string {
  return new URL(`${import.meta.env.BASE_URL}compono/${id}/`, location.href).href
}

export async function loadManifest(): Promise<VersionManifest> {
  const res = await fetch(`${import.meta.env.BASE_URL}compono/versions.json`, { cache: 'no-cache' })
  if (!res.ok) {
    throw new Error(`Could not load the Compono versions (${res.status})`)
  }
  return res.json()
}
