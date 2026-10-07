import type { ConvertRequest, ConvertResponse } from './types'

export type WorkerRequest =
  | { type: 'load'; base: string }
  | { type: 'convert'; id: number; request: ConvertRequest }

export type WorkerResponse =
  | { type: 'loaded' }
  | { type: 'load-failed'; message: string }
  | { type: 'converted'; id: number; response: ConvertResponse; duration: number }
  /** The Go program exited; the worker can't convert anymore. */
  | { type: 'crashed'; id: number; message: string; output: string }
