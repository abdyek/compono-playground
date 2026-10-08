import { describe, expect, it } from 'vitest'
import { buildPath, compareTagsDesc, isStableTag, sortVersions, tagAtLeast, versionLabel } from './manifest.mjs'

describe('manifest', () => {
  it('recognizes stable tags', () => {
    expect(isStableTag('v0.7.3')).toBe(true)
    expect(isStableTag('v0.7.3-rc.1')).toBe(false)
    expect(isStableTag('main')).toBe(false)
  })

  it('compares tags numerically', () => {
    expect(['v0.7.2', 'v0.10.0', 'v0.7.10', 'v1.0.0'].sort(compareTagsDesc)).toEqual([
      'v1.0.0',
      'v0.10.0',
      'v0.7.10',
      'v0.7.2',
    ])
    expect(tagAtLeast('v0.7.0', 'v0.7.0')).toBe(true)
    expect(tagAtLeast('v0.6.9', 'v0.7.0')).toBe(false)
    expect(tagAtLeast('v0.10.0', 'v0.7.0')).toBe(true)
  })

  it('puts branches first, then tags from newest to oldest', () => {
    const ids = ['v0.7.2', 'main', 'v0.7.3', 'v0.8.0'].map((id) => ({ id }))
    expect(sortVersions(ids).map((v) => v.id)).toEqual(['main', 'v0.8.0', 'v0.7.3', 'v0.7.2'])
  })

  it('names builds and labels', () => {
    expect(buildPath('5e0657ff3f76ee75', '2c414f68f8a179f0')).toBe('5e0657ff3f-2c414f68f8')
    expect(versionLabel('main', '5e0657ff3f76')).toBe('main (5e0657f)')
    expect(versionLabel('v0.7.3', '5e0657ff3f76')).toBe('v0.7.3')
  })
})
