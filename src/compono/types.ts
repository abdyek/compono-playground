// The shapes exchanged with the WASM bridge (wasm/convert.go).

export interface GlobalComponent {
  name: string
  source: string
  /** Given WithIsolatedScope: calls in it and its sub-components don't resolve outside its inner scope. */
  isolated?: boolean
  /** Its sub-components, its inner scope. */
  globals?: GlobalComponent[]
}

export interface ConvertRequest {
  source: string
  globals: GlobalComponent[]
  /** Context as JSON text. Blank means no context. */
  context: string
}

export interface Position {
  /** 0-based byte offset. */
  offset: number
  /** 1-based line. */
  line: number
  /** 1-based column counted in runes. */
  column: number
}

export interface Range {
  start: Position
  end: Position
}

export type CallKind = 'builtin' | 'global' | 'local'

export interface Call {
  name: string
  kind: CallKind
  /** Empty for the converted source, otherwise the global's scope path. */
  source: string[]
  range: Range
}

export interface Diagnostic {
  code: string
  message: string
  /** Empty for the converted source, otherwise the global's scope path. */
  source: string[]
  range: Range
  /** Calls around the dropped unit, outermost first. */
  calls: Call[]
}

export type FatalKind = 'input' | 'compono' | 'panic' | 'timeout' | 'load'

export interface Fatal {
  kind: FatalKind
  code?: number
  message: string
  stack?: string
}

export interface ConvertResponse {
  html: string
  diagnostics: Diagnostic[] | null
  fatal: Fatal | null
}

/** A Compono build. See scripts/lib/manifest.mjs. */
export interface ComponoVersion {
  id: string
  label: string
  ref: string
  commit: string
  go: string
  /** Git tree hash of the bridge it was built with. */
  bridge: string
  /** Its directory under compono/. */
  path: string
  builtAt: string
}

export interface VersionManifest {
  /** Branches first, then tags from newest to oldest. */
  versions: ComponoVersion[]
}

/** An example: a golden test case of a build (examples.json) or the welcome example. */
export interface Example {
  /** The golden case's directory name, or "welcome". */
  id: string
  /** The golden case's number. Unused for the welcome example. */
  number: number
  title: string
  source: string
  globals: GlobalComponent[]
  /** Context as JSON text. Blank means no context. */
  context: string
}

/** examples.json of a build, written by wasm/cmd/examples. */
export interface ExampleFile {
  examples: Example[]
}
