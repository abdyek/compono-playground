import { reactive, ref, shallowRef, watch } from 'vue'
import { ComponoRunner } from '../compono/runner'
import type { ComponoVersion, ConvertResponse } from '../compono/types'
import { defaultVersion, loadManifest } from '../compono/versions'
import { examples, type Example } from './examples'
import { decodeSnapshot, encodeSnapshot, type Snapshot } from './share'

export interface GlobalEntry {
  /** Stable key for the UI; not part of the conversion. */
  id: number
  name: string
  source: string
}

export interface Result extends ConvertResponse {
  duration?: number
}

const STORAGE_KEY = 'compono-playground'
const DEBOUNCE_MS = 200

let nextGlobalId = 1

export const input = reactive({
  version: '',
  source: '',
  globals: [] as GlobalEntry[],
  context: '',
})

export const versions = ref<ComponoVersion[]>([])
/** A problem with the playground itself, like a missing manifest. */
export const notice = ref('')
export const status = ref<'starting' | 'loading' | 'converting' | 'idle'>('starting')
export const result = shallowRef<Result | null>(null)

function toEntries(globals: { name: string; source: string }[]): GlobalEntry[] {
  return globals.map((g) => ({ id: nextGlobalId++, name: g.name, source: g.source }))
}

export function snapshot(): Snapshot {
  return {
    version: input.version,
    source: input.source,
    globals: input.globals.map(({ name, source }) => ({ name, source })),
    context: input.context,
  }
}

function apply(s: Omit<Snapshot, 'version'>) {
  input.source = s.source
  input.globals = toEntries(s.globals)
  input.context = s.context
}

export function loadExample(example: Example) {
  apply(example)
}

export function addGlobal(): GlobalEntry {
  const taken = new Set(input.globals.map((g) => g.name))
  let n = input.globals.length + 1
  while (taken.has(`GLOBAL_${n}`)) n++
  const entry: GlobalEntry = { id: nextGlobalId++, name: `GLOBAL_${n}`, source: '' }
  input.globals.push(entry)
  return entry
}

export function removeGlobal(id: number) {
  input.globals = input.globals.filter((g) => g.id !== id)
}

/** Puts a share link of the current input into the address bar and returns it. */
export async function share(): Promise<string> {
  const hash = await encodeSnapshot(snapshot())
  history.replaceState(null, '', hash)
  sharedHash = location.hash
  return location.href
}

function readStorage(): Snapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Snapshot) : null
  } catch {
    return null
  }
}

function writeStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()))
  } catch {
    // Storage is a convenience; the playground works without it.
  }
}

// The hash of a share link that is in the address bar. It is removed once the
// input changes, so the address bar never shows a link to another input.
let sharedHash = ''

function clearStaleShareLink() {
  if (sharedHash && location.hash === sharedHash) {
    history.replaceState(null, '', location.pathname + location.search)
  }
  sharedHash = ''
}

let runner: ComponoRunner | null = null
let timer: ReturnType<typeof setTimeout> | undefined

async function convert() {
  if (!input.version) {
    return
  }
  if (runner?.version.id !== input.version) {
    const version = versions.value.find((v) => v.id === input.version)
    if (!version) {
      return
    }
    runner?.dispose()
    runner = new ComponoRunner(version)
    status.value = 'loading'
    await runner.load()
  }
  const current = runner
  status.value = 'converting'
  const res = await current.convert({
    source: input.source,
    globals: input.globals.map(({ name, source }) => ({ name, source })),
    context: input.context,
  })
  if (res === null || current !== runner) {
    // A newer conversion replaced this one.
    return
  }
  result.value = { ...res.response, duration: res.duration }
  status.value = 'idle'
}

function schedule(delay = DEBOUNCE_MS) {
  clearTimeout(timer)
  timer = setTimeout(() => void convert(), delay)
}

let defaultVersionId = ''
// Set when the input is replaced by a share link, so that the change doesn't
// remove the link from the address bar.
let openingLink = false

function useVersion(wanted: string | undefined, fromLink: boolean) {
  if (wanted && versions.value.some((v) => v.id === wanted)) {
    input.version = wanted
    return
  }
  input.version = defaultVersionId
  if (fromLink && wanted) {
    const label = versions.value.find((v) => v.id === defaultVersionId)?.label ?? defaultVersionId
    notice.value = `This link was made with Compono ${wanted}, which isn't available anymore. It is shown with ${label}.`
  }
}

/** Opens the share link in the hash. Returns false if there is none. */
async function openLink(): Promise<boolean> {
  const hash = location.hash
  const s = await decodeSnapshot(hash)
  if (!s) {
    if (hash.startsWith('#s=')) {
      notice.value = 'The share link is broken, so it was not opened.'
    }
    return false
  }
  sharedHash = hash
  openingLink = true
  apply(s)
  useVersion(s.version, true)
  return true
}

export async function start() {
  try {
    const manifest = await loadManifest()
    versions.value = manifest.versions
    defaultVersionId = defaultVersion(manifest.versions)!.id
  } catch (err) {
    notice.value = err instanceof Error ? err.message : String(err)
    status.value = 'idle'
    return
  }

  if (!(await openLink())) {
    const stored = readStorage()
    if (stored) {
      apply(stored)
    } else {
      loadExample(examples[0])
    }
    useVersion(stored?.version, false)
  }
  openingLink = false

  // A share link pasted into the address bar of an open playground only
  // changes the hash.
  window.addEventListener('hashchange', () => void openLink())

  watch(
    input,
    () => {
      if (openingLink) {
        openingLink = false
      } else {
        clearStaleShareLink()
      }
      writeStorage()
      schedule()
    },
    { deep: true },
  )
  schedule(0)
}
