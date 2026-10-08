// Moves a local build into public/compono/ and lists it in the manifest,
// replacing an earlier build of the same id.
//
// Usage: node scripts/register-version.mjs <compono-dir> <build-dir> <id> <ref> <commit> <go> <bridge>
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { buildPath, readManifest, versionLabel, writeManifest } from './lib/manifest.mjs'

const [dir, build, id, ref, commit, go, bridge] = process.argv.slice(2)
if (!bridge) {
  console.error('usage: register-version.mjs <compono-dir> <build-dir> <id> <ref> <commit> <go> <bridge>')
  process.exit(1)
}

mkdirSync(dir, { recursive: true })
const manifest = readManifest(dir)
const path = buildPath(commit, bridge)

const old = manifest.versions.find((v) => v.id === id)
manifest.versions = manifest.versions.filter((v) => v.id !== id)
if (old && old.path !== path && !manifest.versions.some((v) => v.path === old.path)) {
  rmSync(join(dir, old.path), { recursive: true, force: true })
}

rmSync(join(dir, path), { recursive: true, force: true })
// Copied, not renamed: the build is usually on another file system (/tmp).
cpSync(build, join(dir, path), { recursive: true })

manifest.versions.push({
  id,
  label: versionLabel(id, commit),
  ref,
  commit,
  go,
  bridge,
  path,
  builtAt: new Date().toISOString(),
})
writeManifest(dir, manifest)
console.log(`Listed ${versionLabel(id, commit)} at public/compono/${path}`)
if (!existsSync(join(dir, path, 'compono.wasm'))) {
  process.exit(1)
}
