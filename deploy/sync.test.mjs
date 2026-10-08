import { describe, expect, it } from 'vitest'
import { buildPath } from '../scripts/lib/manifest.mjs'
import { desiredVersions, latestTag, plan } from './sync.mjs'

const bridge = 'b'.repeat(40)
const entry = (id, commit, b = bridge) => ({ id, label: id, ref: id, commit, bridge: b, path: buildPath(commit, b) })

describe('latestTag', () => {
  it('picks the newest stable tag', () => {
    expect(latestTag(['v0.1.0', 'v0.2.0-rc.1', 'v0.1.10', 'other'])).toBe('v0.1.10')
    expect(latestTag(['other'])).toBeUndefined()
  })
})

describe('desiredVersions', () => {
  it('wants main and the stable tags since v0.7.0', () => {
    const desired = desiredVersions('m1', { 'v0.6.0': 'a', 'v0.7.0': 'b', 'v0.7.1-rc.1': 'c', 'v0.8.0': 'd' })
    expect(desired.map((d) => d.id)).toEqual(['main', 'v0.7.0', 'v0.8.0'])
  })

  it('works without main', () => {
    expect(desiredVersions(undefined, { 'v0.7.0': 'b' }).map((d) => d.id)).toEqual(['v0.7.0'])
  })
})

describe('plan', () => {
  it('keeps up to date builds', () => {
    const manifest = { versions: [entry('main', 'm1'), entry('v0.7.0', 't1')] }
    const desired = desiredVersions('m1', { 'v0.7.0': 't1' })
    expect(plan(manifest, desired, bridge, [])).toEqual({ versions: manifest.versions, builds: [], skipped: [] })
  })

  it('builds a new main commit and drops deleted tags', () => {
    const old = entry('main', 'm1')
    const manifest = { versions: [old, entry('v0.7.0', 't1')] }
    const { versions, builds } = plan(manifest, desiredVersions('m2', {}), bridge, [])
    expect(versions).toEqual([])
    expect(builds).toEqual([{ id: 'main', ref: 'main', commit: 'm2', path: buildPath('m2', bridge), current: old }])
  })

  it('rebuilds everything for a new bridge', () => {
    const manifest = { versions: [entry('main', 'm1', 'old')] }
    const { builds } = plan(manifest, desiredVersions('m1', {}), bridge, [])
    expect(builds.map((b) => b.path)).toEqual([buildPath('m1', bridge)])
  })

  it('reuses the build of the same commit under another id', () => {
    const manifest = { versions: [entry('main', 'm1')] }
    const { versions, builds } = plan(manifest, desiredVersions('m1', { 'v0.7.0': 'm1' }), bridge, [])
    expect(builds).toEqual([])
    expect(versions.map((v) => [v.id, v.label, v.path])).toEqual([
      ['main', 'main', buildPath('m1', bridge)],
      ['v0.7.0', 'v0.7.0', buildPath('m1', bridge)],
    ])
  })

  it('keeps the current build when the new one failed recently', () => {
    const old = entry('main', 'm1')
    const { versions, builds, skipped } = plan({ versions: [old] }, desiredVersions('m2', {}), bridge, [
      buildPath('m2', bridge),
    ])
    expect(builds).toEqual([])
    expect(versions).toEqual([old])
    expect(skipped.map((s) => s.commit)).toEqual(['m2'])
  })
})
