import type { GlobalComponent } from '../compono/types'

/** A global component being edited, with its sub-components. */
export interface GlobalEntry {
  /** Stable key for the UI; not part of the conversion. */
  id: number
  name: string
  source: string
  isolated: boolean
  globals: GlobalEntry[]
}

/** A global and its scope path: the names of its owners and its own. */
export interface ScopedGlobal {
  global: GlobalEntry
  path: string[]
}

let nextId = 1

export function toEntries(globals: GlobalComponent[]): GlobalEntry[] {
  return globals.map((g) => ({
    id: nextId++,
    name: g.name,
    source: g.source,
    isolated: g.isolated ?? false,
    globals: toEntries(g.globals ?? []),
  }))
}

/** The globals as the bridge takes them. Scope fields are left out when unused. */
export function toComponents(entries: GlobalEntry[]): GlobalComponent[] {
  return entries.map((e) => {
    const g: GlobalComponent = { name: e.name, source: e.source }
    if (e.isolated) g.isolated = true
    if (e.globals.length) g.globals = toComponents(e.globals)
    return g
  })
}

/** Every global, each owner followed by its sub-components. */
export function flatten(entries: GlobalEntry[], owners: string[] = []): ScopedGlobal[] {
  return entries.flatMap((global) => {
    const path = [...owners, global.name]
    return [{ global, path }, ...flatten(global.globals, path)]
  })
}

/** The global at a scope path, like the source of a diagnostic. */
export function findByPath(entries: GlobalEntry[], path: string[]): GlobalEntry | undefined {
  let found: GlobalEntry | undefined
  let scope = entries
  for (const name of path) {
    found = scope.find((g) => g.name === name)
    if (!found) return undefined
    scope = found.globals
  }
  return found
}

/** Removes the global with id and its sub-components. Returns whether it was found. */
export function remove(entries: GlobalEntry[], id: number): boolean {
  const i = entries.findIndex((g) => g.id === id)
  if (i >= 0) {
    entries.splice(i, 1)
    return true
  }
  return entries.some((g) => remove(g.globals, id))
}

/** Adds a global to a scope with a name that is free in it. */
export function addTo(scope: GlobalEntry[], prefix: string): GlobalEntry {
  const taken = new Set(scope.map((g) => g.name))
  let n = scope.length + 1
  while (taken.has(`${prefix}_${n}`)) n++
  const entry: GlobalEntry = { id: nextId++, name: `${prefix}_${n}`, source: '', isolated: false, globals: [] }
  scope.push(entry)
  return entry
}
