import type { ConvertRequest, ConvertResponse, Fatal } from './types'
import type { WorkerRequest, WorkerResponse } from './protocol'
import { versionBaseURL } from './versions'

export interface ConvertResult {
  response: ConvertResponse
  /** Milliseconds spent in Convert. Undefined when it didn't finish. */
  duration?: number
}

interface Job {
  id: number
  request: ConvertRequest
  resolve: (result: ConvertResult | null) => void
}

function fatal(f: Fatal): ConvertResult {
  return { response: { html: '', diagnostics: null, fatal: f } }
}

/**
 * Runs conversions of one Compono version in a Web Worker. One conversion runs
 * at a time; a conversion asked while another runs waits, and a newer one
 * replaces it (the replaced one resolves to null). A conversion that runs
 * longer than the timeout kills the worker; the next one starts a new worker.
 */
export class ComponoRunner {
  private worker: Worker | null = null
  private loading: Promise<Fatal | null> | null = null
  private running: Job | null = null
  private waiting: Job | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private nextId = 1

  constructor(
    readonly versionId: string,
    private readonly timeoutMs = 5000,
  ) {}

  convert(request: ConvertRequest): Promise<ConvertResult | null> {
    return new Promise((resolve) => {
      this.waiting?.resolve(null)
      this.waiting = { id: this.nextId++, request, resolve }
      void this.pump()
    })
  }

  /** Loads the worker ahead of the first conversion. */
  load(): Promise<Fatal | null> {
    if (!this.loading) {
      this.loading = this.start()
    }
    return this.loading
  }

  dispose() {
    clearTimeout(this.timer)
    this.worker?.terminate()
    this.worker = null
    this.loading = null
    this.running?.resolve(null)
    this.waiting?.resolve(null)
    this.running = this.waiting = null
  }

  private start(): Promise<Fatal | null> {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    this.worker = worker
    return new Promise((resolve) => {
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data
        switch (msg.type) {
          case 'loaded':
            resolve(null)
            break
          case 'load-failed':
            resolve({ kind: 'load', message: `Could not load Compono ${this.versionId}: ${msg.message}` })
            break
          case 'converted':
            this.finish(msg.id, { response: msg.response, duration: msg.duration })
            break
          case 'crashed':
            this.kill()
            this.finish(
              msg.id,
              fatal({
                kind: 'panic',
                message: `The Go program exited: ${msg.message}`,
                stack: msg.output.trim() || undefined,
              }),
            )
            break
        }
      }
      worker.onerror = (e) => {
        e.preventDefault()
        resolve({ kind: 'load', message: `Could not start the Compono worker: ${e.message}` })
      }
      worker.postMessage({ type: 'load', base: versionBaseURL(this.versionId) } satisfies WorkerRequest)
    })
  }

  private async pump() {
    if (this.running || !this.waiting) {
      return
    }
    const job = this.waiting
    this.waiting = null
    this.running = job

    const loadError = await this.load()
    if (this.running !== job) {
      return
    }
    if (loadError) {
      // Let a later conversion try loading again.
      this.kill()
      this.finish(job.id, fatal(loadError))
      return
    }

    this.timer = setTimeout(() => {
      this.kill()
      this.finish(
        job.id,
        fatal({
          kind: 'timeout',
          message: `The conversion didn't finish in ${this.timeoutMs / 1000} seconds and was stopped.`,
        }),
      )
    }, this.timeoutMs)
    this.worker!.postMessage({ type: 'convert', id: job.id, request: job.request } satisfies WorkerRequest)
  }

  private finish(id: number, result: ConvertResult) {
    if (this.running?.id !== id) {
      return
    }
    clearTimeout(this.timer)
    const job = this.running
    this.running = null
    job.resolve(result)
    void this.pump()
  }

  private kill() {
    clearTimeout(this.timer)
    this.worker?.terminate()
    this.worker = null
    this.loading = null
  }
}
