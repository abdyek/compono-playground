#!/usr/bin/env node
// Keeps play.compono.md up to date. A systemd timer runs it every few minutes
// (see docs/DEPLOY.md). Each run:
//
// 1. fetches the playground (the clone this file is in) and Compono,
// 2. deploys the newest playground release tag if it isn't deployed yet,
// 3. builds the Compono versions the deployed release is missing: main's
//    newest commit and every release tag since v0.7.0.
//
// Layout of the data directory:
//
//   repos/compono/       clone of Compono
//   sources/<tag>/       source of a playground release (its WASM bridge)
//   releases/<tag>/      a built release; compono/ holds its Compono builds
//   current              symlink to the release nginx serves
//   tmp/                 work in progress
//   state.json           recently failed builds, builds waiting to be deleted
//
// Everything is replaced atomically (rename), so a visitor never sees a half
// written file. Logs go to stdout and stderr, so to the journal.
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  buildPath,
  compareTagsDesc,
  isStableTag,
  MANIFEST,
  readManifest,
  sortVersions,
  tagAtLeast,
  versionLabel,
  writeManifest,
} from '../scripts/lib/manifest.mjs'

/** The oldest Compono the bridge can build (it needs Convert's diagnostics). */
export const MIN_COMPONO = 'v0.7.0'
/** How long an unlisted build is kept for pages that are still open. */
const GRACE_MS = 60 * 60 * 1000
/** How long a failed build isn't tried again. */
const RETRY_FAILED_MS = 6 * 60 * 60 * 1000
/** A lock older than this is from a run that died. */
const STALE_LOCK_MS = 2 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Planning (pure)

/** The newest stable tag, or undefined. */
export function latestTag(tags) {
  return tags.filter(isStableTag).sort(compareTagsDesc)[0]
}

/**
 * The Compono versions to serve: main and every stable tag since MIN_COMPONO.
 * tags maps a tag to its commit.
 */
export function desiredVersions(mainCommit, tags) {
  const desired = mainCommit ? [{ id: 'main', ref: 'main', commit: mainCommit }] : []
  for (const [tag, commit] of Object.entries(tags)) {
    if (isStableTag(tag) && tagAtLeast(tag, MIN_COMPONO)) {
      desired.push({ id: tag, ref: tag, commit })
    }
  }
  return desired
}

/**
 * Compares a release's manifest with the desired versions. Returns the
 * versions that need no build, the builds to make and the skipped ones. A build that failed
 * recently (blocked lists build paths) isn't tried; the version it would
 * replace is kept. Versions that aren't desired anymore are dropped.
 */
export function plan(manifest, desired, bridge, blocked) {
  const versions = []
  const builds = []
  const skipped = []
  for (const d of desired) {
    const target = buildPath(d.commit, bridge)
    const current = manifest.versions.find((v) => v.id === d.id)
    if (current?.path === target) {
      versions.push(current)
      continue
    }
    // The same commit is already built for another id (a tag on main).
    const same = manifest.versions.find((v) => v.path === target)
    if (same) {
      versions.push({ ...same, id: d.id, ref: d.ref, label: versionLabel(d.id, d.commit) })
      continue
    }
    if (blocked.includes(target)) {
      if (current) versions.push(current)
      skipped.push({ ...d, path: target, current })
      continue
    }
    builds.push({ ...d, path: target, current })
  }
  return { versions, builds, skipped }
}

// ---------------------------------------------------------------------------
// Side effects

const log = (msg) => console.log(msg)

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opts }).trim()
}

/** Runs a command with its output in the log. */
function exec(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], ...opts })
}

function git(repo, ...args) {
  return run('git', ['-C', repo, ...args])
}

function fetch(repo) {
  git(repo, 'fetch', '--quiet', '--prune', '--prune-tags', '--tags', '--force', 'origin')
}

/** Tags of a repository with the commits they point to. */
function tagCommits(repo) {
  const tags = {}
  const out = git(repo, 'for-each-ref', '--format=%(refname:short) %(objectname) %(*objectname)', 'refs/tags')
  for (const line of out.split('\n').filter(Boolean)) {
    const [tag, object, peeled] = line.split(' ')
    tags[tag] = peeled || object
  }
  return tags
}

/** Extracts a commit of a repository into an empty directory. */
function extract(repo, commit, dir) {
  fs.mkdirSync(dir, { recursive: true })
  run('sh', ['-c', 'git -C "$1" archive "$2" | tar -x -C "$3"', 'sh', repo, commit, dir])
}

class Sync {
  constructor(data, playground, componoRepo) {
    this.data = data
    this.playground = playground
    this.compono = path.join(data, 'repos', 'compono')
    this.componoRepo = componoRepo
    this.statePath = path.join(data, 'state.json')
    this.state = fs.existsSync(this.statePath)
      ? JSON.parse(fs.readFileSync(this.statePath, 'utf8'))
      : { failed: {}, orphans: {} }
  }

  saveState() {
    const tmp = `${this.statePath}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2) + '\n')
    fs.renameSync(tmp, this.statePath)
  }

  tmpDir() {
    const dir = path.join(this.data, 'tmp', randomUUID())
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  currentRelease() {
    try {
      return path.basename(fs.readlinkSync(path.join(this.data, 'current')))
    } catch {
      return undefined
    }
  }

  async run({ selfUpdate }) {
    for (const dir of ['repos', 'sources', 'releases']) {
      fs.mkdirSync(path.join(this.data, dir), { recursive: true })
    }
    fs.rmSync(path.join(this.data, 'tmp'), { recursive: true, force: true })

    if (!fs.existsSync(this.compono)) {
      log(`Cloning Compono from ${this.componoRepo}`)
      run('git', ['clone', '--quiet', this.componoRepo, this.compono])
    }
    fetch(this.playground)
    fetch(this.compono)

    const release = latestTag(Object.keys(tagCommits(this.playground)))
    if (!release) {
      log('The playground has no release tag yet; nothing to deploy.')
      return 0
    }
    if (selfUpdate) {
      // The next run uses the sync script of the newest release.
      git(this.playground, 'checkout', '--quiet', '--detach', release)
    }

    const current = this.currentRelease()
    if (current === release) {
      this.syncCompono(release, path.join(this.data, 'releases', release))
    } else {
      this.deploy(release, current)
    }
    this.collectGarbage()
    this.saveState()
    fs.rmSync(path.join(this.data, 'tmp'), { recursive: true, force: true })
    // The rest was deployed; the failure marks the run (systemctl --failed).
    return this.buildFailed ? 1 : 0
  }

  /** Builds a playground release with its Compono builds and switches to it. */
  deploy(release, previous) {
    const site = path.join(this.data, 'releases', release)
    if (previous) {
      this.lastMain = readManifest(path.join(this.data, 'releases', previous, 'compono')).versions.find(
        (v) => v.id === 'main',
      )
    }
    if (!fs.existsSync(path.join(site, 'index.html'))) {
      log(`Building playground ${release}`)
      const src = path.join(this.data, 'sources', release)
      fs.rmSync(src, { recursive: true, force: true })
      extract(this.playground, release, src)
      exec('npm', ['ci', '--no-audit', '--no-fund'], { cwd: src })
      exec('npm', ['run', 'build'], { cwd: src, env: { ...process.env, PLAYGROUND_VERSION: release } })

      const staging = path.join(this.tmpDir(), 'site')
      fs.cpSync(path.join(src, 'dist'), staging, { recursive: true })
      fs.mkdirSync(path.join(staging, 'compono'))
      if (previous) {
        this.inherit(path.join(this.data, 'releases', previous), staging, this.bridgeOf(release))
      }
      fs.rmSync(path.join(src, 'node_modules'), { recursive: true, force: true })
      fs.rmSync(path.join(src, 'dist'), { recursive: true, force: true })
      fs.renameSync(staging, site)
    }

    this.syncCompono(release, site)

    const link = path.join(this.data, 'current.tmp')
    fs.rmSync(link, { force: true })
    fs.symlinkSync(path.join('releases', release), link)
    fs.renameSync(link, path.join(this.data, 'current'))
    log(`Deployed playground ${release}${previous ? ` (was ${previous})` : ''}`)

    // Keep the previous release for rolling back by hand; remove older ones.
    for (const dir of ['releases', 'sources']) {
      for (const name of fs.readdirSync(path.join(this.data, dir))) {
        if (name !== release && name !== previous) {
          fs.rmSync(path.join(this.data, dir, name), { recursive: true, force: true })
          log(`Removed ${dir}/${name}`)
        }
      }
    }
  }

  /**
   * Starts a new release from the previous one: its old asset files, so that
   * open pages can still load them, and its Compono builds that were built
   * with the same bridge.
   */
  inherit(previousSite, site, bridge) {
    const oldAssets = path.join(previousSite, 'assets')
    if (fs.existsSync(oldAssets)) {
      for (const name of fs.readdirSync(oldAssets)) {
        const to = path.join(site, 'assets', name)
        if (!fs.existsSync(to)) fs.copyFileSync(path.join(oldAssets, name), to)
      }
    }
    const oldCompono = path.join(previousSite, 'compono')
    const manifest = readManifest(oldCompono)
    manifest.versions = manifest.versions.filter((v) => v.bridge === bridge)
    for (const v of manifest.versions) {
      const to = path.join(site, 'compono', v.path)
      if (!fs.existsSync(to)) run('cp', ['-al', path.join(oldCompono, v.path), to])
    }
    writeManifest(path.join(site, 'compono'), manifest)
    log(`Reused ${manifest.versions.length} Compono build(s) of the previous release`)
  }

  bridgeOf(release) {
    return git(this.playground, 'rev-parse', `${release}:wasm`)
  }

  /** Builds the Compono versions a release is missing and lists them. */
  syncCompono(release, site) {
    const dir = path.join(site, 'compono')
    fs.mkdirSync(dir, { recursive: true })
    const bridge = this.bridgeOf(release)
    const manifest = readManifest(dir)
    const before = JSON.stringify(sortVersions(manifest.versions))

    let main
    try {
      main = git(this.compono, 'rev-parse', 'origin/main')
    } catch {
      log('Compono has no main branch; only its tags are built.')
    }
    const desired = desiredVersions(main, tagCommits(this.compono))
    const now = Date.now()
    for (const [p, at] of Object.entries(this.state.failed)) {
      if (now - at >= RETRY_FAILED_MS) delete this.state.failed[p]
    }
    const { versions, builds, skipped } = plan(manifest, desired, bridge, Object.keys(this.state.failed))
    for (const b of skipped) {
      const kept = b.current ? `; ${b.current.label} stays` : ''
      log(`Compono ${b.id} (${b.commit.slice(0, 7)}) failed to build recently and is not tried yet${kept}.`)
    }

    manifest.versions = versions
    for (const b of builds) {
      // Built a moment ago for another id (a tag on main's commit).
      const same = manifest.versions.find((v) => v.path === b.path)
      if (same) {
        manifest.versions.push({ ...same, id: b.id, ref: b.ref, label: versionLabel(b.id, b.commit) })
        continue
      }
      const built = this.build(release, b, dir, bridge)
      if (built) {
        manifest.versions.push(built)
      } else if (b.current) {
        manifest.versions.push(b.current)
      }
      // Publish each build as soon as it is ready.
      writeManifest(dir, manifest)
    }
    this.keepMainListed(release, manifest, dir, bridge)
    if (JSON.stringify(sortVersions(manifest.versions)) !== before || !fs.existsSync(path.join(dir, MANIFEST))) {
      writeManifest(dir, manifest)
    }
  }

  /**
   * A new release can't reuse builds of another bridge. If main's newest
   * commit doesn't build either, main's commit of the previous release is
   * built, so that main stays listed.
   */
  keepMainListed(release, manifest, dir, bridge) {
    const last = this.lastMain
    if (!last || manifest.versions.some((v) => v.id === 'main')) {
      return
    }
    const b = { id: 'main', ref: 'main', commit: last.commit, path: buildPath(last.commit, bridge) }
    if (b.path in this.state.failed) {
      return
    }
    log(`Main is not built for playground ${release}; building the previous release's main (${last.commit.slice(0, 7)})`)
    const same = manifest.versions.find((v) => v.path === b.path)
    const built = same ? { ...same, id: b.id, ref: b.ref, label: versionLabel(b.id, b.commit) } : this.build(release, b, dir, bridge)
    if (built) {
      manifest.versions.push(built)
      writeManifest(dir, manifest)
    }
  }

  /** Compiles one Compono version. Returns its manifest entry or null. */
  build(release, b, dir, bridge) {
    log(`Building Compono ${b.id} (${b.commit.slice(0, 7)}) for playground ${release}`)
    const work = this.tmpDir()
    try {
      extract(this.compono, b.commit, path.join(work, 'compono'))
      const compile = path.join(this.data, 'sources', release, 'scripts', 'compile-wasm.sh')
      exec(compile, [path.join(work, 'compono'), path.join(work, 'out')])
      fs.renameSync(path.join(work, 'out'), path.join(dir, b.path))
      log(`Built Compono ${b.id} (${b.commit.slice(0, 7)})`)
      return {
        id: b.id,
        label: versionLabel(b.id, b.commit),
        ref: b.ref,
        commit: b.commit,
        go: run('go', ['env', 'GOVERSION']),
        bridge,
        path: b.path,
        builtAt: new Date().toISOString(),
      }
    } catch (err) {
      console.error(`Building Compono ${b.id} (${b.commit.slice(0, 7)}) failed: ${err.message}`)
      console.error(`It is tried again in ${RETRY_FAILED_MS / 3600000} hours or when the commit or the bridge changes.`)
      this.state.failed[b.path] = Date.now()
      this.buildFailed = true
      return null
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  }

  /**
   * Deletes Compono builds that no manifest lists anymore, an hour after they
   * were unlisted, so that pages opened before can still load them.
   */
  collectGarbage() {
    const now = Date.now()
    const seen = new Set()
    for (const release of fs.readdirSync(path.join(this.data, 'releases'))) {
      const dir = path.join(this.data, 'releases', release, 'compono')
      if (!fs.existsSync(dir)) continue
      const listed = new Set(readManifest(dir).versions.map((v) => v.path))
      for (const name of fs.readdirSync(dir)) {
        if (name === MANIFEST || listed.has(name)) continue
        const key = `${release}/${name}`
        seen.add(key)
        const since = this.state.orphans[key] ?? (this.state.orphans[key] = now)
        if (now - since >= GRACE_MS) {
          fs.rmSync(path.join(dir, name), { recursive: true, force: true })
          delete this.state.orphans[key]
          seen.delete(key)
          log(`Removed the unlisted build releases/${key}/`)
        }
      }
    }
    for (const key of Object.keys(this.state.orphans)) {
      if (!seen.has(key)) delete this.state.orphans[key]
    }
  }
}

function lock(data) {
  const dir = path.join(data, 'sync.lock')
  try {
    fs.mkdirSync(dir)
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
    if (Date.now() - fs.statSync(dir).mtimeMs < STALE_LOCK_MS) {
      return null
    }
    log('Taking over a stale lock.')
  }
  return () => fs.rmSync(dir, { recursive: true, force: true })
}

async function main() {
  const data = path.resolve(process.env.COMPONO_PLAYGROUND_DATA ?? '/var/lib/compono-playground')
  const componoRepo = process.env.COMPONO_REPO ?? 'https://github.com/umono-cms/compono.git'
  const playground = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const selfUpdate = process.argv.includes('--self-update')

  fs.mkdirSync(data, { recursive: true })
  const unlock = lock(data)
  if (!unlock) {
    log('Another sync is running.')
    return
  }
  try {
    process.exitCode = await new Sync(data, playground, componoRepo).run({ selfUpdate })
  } finally {
    unlock()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.stack ?? err)
    process.exit(1)
  })
}
