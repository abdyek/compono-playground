import { reactive, ref, shallowRef, watch } from 'vue'
import { ComponoRunner } from '../compono/runner'
import { loadGoldenExamples } from '../compono/examples'
import type { ComponoVersion, ConvertResponse, Example } from '../compono/types'
import { defaultVersion, loadManifest } from '../compono/versions'
import { isUnchanged, welcome } from './examples'
import { addTo, remove, toComponents, toEntries, type GlobalEntry } from './globals'
import { decodeSnapshot, encodeSnapshot, type Snapshot } from './share'

export interface Result extends ConvertResponse {
  duration?: number
}

const STORAGE_KEY = 'compono-playground'
const DEBOUNCE_MS = 200

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

/** The welcome example, then the golden examples of the selected build. */
export const examples = shallowRef<Example[]>([welcome])
/** 'none' for a build without examples. */
export const examplesState = ref<'loading' | 'ready' | 'none' | 'failed'>('loading')
/** The id of the last loaded example, or '' after a share link. */
export const currentExample = ref('')
// The current example as it was loaded, to tell whether the input changed.
// Unknown after a reload until the examples are loaded.
let loaded: Example | undefined

/** What is kept in the browser: the last input and the example it came from. */
interface Stored extends Snapshot {
  example?: string
}

export function snapshot(): Snapshot {
  return {
    version: input.version,
    source: input.source,
    globals: toComponents(input.globals),
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
  currentExample.value = example.id
  loaded = example
}

/**
 * Whether loading an example would replace input of the user: anything but
 * the current example as it was loaded.
 */
export function hasOwnInput(): boolean {
  const current = loaded ?? examples.value.find((ex) => ex.id === currentExample.value)
  if (current && isUnchanged(current, snapshot())) {
    return false
  }
  return Boolean(input.source.trim() || input.globals.length || input.context.trim())
}

let examplesRequest = 0

/**
 * Loads the examples of the selected version. If the current example is
 * unchanged, it is reloaded as the new version has it.
 */
async function refreshExamples() {
  const version = versions.value.find((v) => v.id === input.version)
  if (!version) {
    return
  }
  const request = ++examplesRequest
  examplesState.value = 'loading'
  let golden: Example[] | null = null
  let failed = false
  try {
    golden = await loadGoldenExamples(version)
  } catch {
    failed = true
  }
  if (request !== examplesRequest) {
    // The version changed again.
    return
  }
  examples.value = [welcome, ...(golden ?? [])]
  examplesState.value = failed ? 'failed' : golden ? 'ready' : 'none'
  if (!golden) {
    // The id is kept for a version that has examples.
    return
  }
  const now = examples.value.find((ex) => ex.id === currentExample.value)
  if (!now) {
    currentExample.value = ''
    loaded = undefined
    return
  }
  if (isUnchanged(loaded ?? now, snapshot())) {
    if (!isUnchanged(now, snapshot())) apply(now)
    loaded = now
  }
}

/** Adds a global, or a sub-component to owner. */
export function addGlobal(owner?: GlobalEntry): GlobalEntry {
  return owner ? addTo(owner.globals, 'SUB') : addTo(input.globals, 'GLOBAL')
}

/** Removes a global with its sub-components. */
export function removeGlobal(id: number) {
  remove(input.globals, id)
}

/** Puts a share link of the current input into the address bar and returns it. */
export async function share(): Promise<string> {
  const hash = await encodeSnapshot(snapshot())
  history.replaceState(null, '', hash)
  sharedHash = location.hash
  return location.href
}

function readStorage(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}

function writeStorage() {
  try {
    const stored: Stored = { ...snapshot(), example: currentExample.value }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
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
    globals: toComponents(input.globals),
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
  currentExample.value = ''
  loaded = undefined
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
      currentExample.value = stored.example ?? ''
    } else {
      loadExample(welcome)
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
  watch(currentExample, writeStorage)
  watch(() => input.version, () => void refreshExamples(), { immediate: true })
  schedule(0)
}
