/// <reference lib="webworker" />
import type { ConvertResponse } from './types'
import type { WorkerRequest, WorkerResponse } from './protocol'

declare const self: DedicatedWorkerGlobalScope

function post(msg: WorkerResponse) {
  self.postMessage(msg)
}

// The Go runtime writes panics and fatal errors to console.log. They are
// captured while a conversion runs to explain a crash.
let output = ''
const consoleLog = console.log
console.log = (...args: unknown[]) => {
  output += args.join(' ') + '\n'
  consoleLog(...args)
}

async function load(base: string) {
  await import(/* @vite-ignore */ `${base}wasm_exec.js`)
  const go = new Go()
  const res = await fetch(`${base}compono.wasm`)
  if (!res.ok) {
    throw new Error(`Could not fetch compono.wasm (${res.status})`)
  }
  const { instance } = await WebAssembly.instantiate(await res.arrayBuffer(), go.importObject)
  void go.run(instance)
  if (typeof globalThis.componoConvert !== 'function') {
    throw new Error('compono.wasm did not register componoConvert')
  }
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === 'load') {
    try {
      await load(msg.base)
      post({ type: 'loaded' })
    } catch (err) {
      post({ type: 'load-failed', message: err instanceof Error ? err.message : String(err) })
    }
    return
  }

  output = ''
  const start = performance.now()
  try {
    const response = JSON.parse(globalThis.componoConvert!(JSON.stringify(msg.request))) as ConvertResponse
    post({ type: 'converted', id: msg.id, response, duration: performance.now() - start })
  } catch (err) {
    post({
      type: 'crashed',
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
      output,
    })
  }
}
