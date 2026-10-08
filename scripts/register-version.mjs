// Adds or replaces a Compono version in the versions manifest.
//
// Usage: node scripts/register-version.mjs <manifest> <id> <label> <ref> <commit> <go>
//
// Branch builds come first, then tags from newest to oldest. The default
// version is kept; it is set only when the manifest has none.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const [manifestPath, id, label, ref, commit, go] = process.argv.slice(2)
if (!go) {
  console.error('usage: register-version.mjs <manifest> <id> <label> <ref> <commit> <go>')
  process.exit(1)
}

const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : { default: id, versions: [] }

const entry = { id, label, ref, commit, go, builtAt: new Date().toISOString() }
manifest.versions = manifest.versions.filter((v) => v.id !== id).concat(entry)

const tag = (v) => v.id.match(/^v(\d+)\.(\d+)\.(\d+)/)
manifest.versions.sort((a, b) => {
  const ta = tag(a)
  const tb = tag(b)
  if (!ta && !tb) return a.id.localeCompare(b.id)
  if (!ta) return -1
  if (!tb) return 1
  for (let i = 1; i <= 3; i++) {
    const diff = Number(tb[i]) - Number(ta[i])
    if (diff !== 0) return diff
  }
  return b.id.localeCompare(a.id)
})

if (!manifest.versions.some((v) => v.id === manifest.default)) {
  manifest.default = id
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
