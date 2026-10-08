// The versions manifest (compono/versions.json) lists the Compono builds a
// playground release serves:
//
//   { "versions": [{ id, label, ref, commit, go, bridge, path, builtAt }] }
//
// - id      what the version picker and share links use: "main", "v0.7.3"
// - label   what the picker shows: "main (5e0657f)", "v0.7.3"
// - commit  the Compono commit that was built
// - bridge  the git tree hash of the wasm/ bridge it was built with
// - path    its directory under compono/, unique per commit and bridge, so a
//           build never changes after it is published
//
// Branches come first, then tags from newest to oldest. The playground opens
// the newest tag by default, or the first version when there is no tag.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const MANIFEST = 'versions.json'

const TAG = /^v(\d+)\.(\d+)\.(\d+)$/

/** Whether ref is a stable release tag (v1.2.3). */
export function isStableTag(ref) {
  return TAG.test(ref)
}

/** Compares stable tags, newest first. */
export function compareTagsDesc(a, b) {
  const ma = a.match(TAG)
  const mb = b.match(TAG)
  for (let i = 1; i <= 3; i++) {
    const diff = Number(mb[i]) - Number(ma[i])
    if (diff !== 0) return diff
  }
  return 0
}

/** Whether tag is at least min; both are stable tags. */
export function tagAtLeast(tag, min) {
  return compareTagsDesc(tag, min) <= 0
}

/** Sorts versions: branches by id, then tags from newest to oldest. */
export function sortVersions(versions) {
  return [...versions].sort((a, b) => {
    const ta = isStableTag(a.id)
    const tb = isStableTag(b.id)
    if (!ta && !tb) return a.id.localeCompare(b.id)
    if (!ta) return -1
    if (!tb) return 1
    return compareTagsDesc(a.id, b.id)
  })
}

/** The directory name of a build. */
export function buildPath(commit, bridge) {
  return `${commit.slice(0, 10)}-${bridge.slice(0, 10)}`
}

/** The label the version picker shows. */
export function versionLabel(id, commit) {
  return isStableTag(id) ? id : `${id} (${commit.slice(0, 7)})`
}

export function readManifest(dir) {
  const file = join(dir, MANIFEST)
  if (!existsSync(file)) {
    return { versions: [] }
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** Writes the manifest sorted, replacing the old one atomically. */
export function writeManifest(dir, manifest) {
  const file = join(dir, MANIFEST)
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify({ versions: sortVersions(manifest.versions) }, null, 2) + '\n')
  renameSync(tmp, file)
}
