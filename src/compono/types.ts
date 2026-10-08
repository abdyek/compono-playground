// The shapes exchanged with the WASM bridge (wasm/convert.go).

export interface GlobalComponent {
  name: string
  source: string
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

export interface ComponoVersion {
  id: string
  label: string
  ref: string
  commit: string
  go: string
  builtAt: string
}

export interface VersionManifest {
  default: string
  versions: ComponoVersion[]
}
