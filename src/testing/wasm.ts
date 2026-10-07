// Loads a built Compono WASM bridge in Node for tests.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ConvertRequest, ConvertResponse, VersionManifest } from '../compono/types'

export async function loadDefaultBridge(): Promise<(req: ConvertRequest) => ConvertResponse> {
  const root = resolve(import.meta.dirname, '../../public/compono')
  const manifest = JSON.parse(readFileSync(`${root}/versions.json`, 'utf8')) as VersionManifest
  const dir = `${root}/${manifest.default}`
  await import(pathToFileURL(`${dir}/wasm_exec.js`).href)
  const go = new globalThis.Go()
  const { instance } = await WebAssembly.instantiate(readFileSync(`${dir}/compono.wasm`), go.importObject)
  void go.run(instance)
  return (req) => JSON.parse(globalThis.componoConvert!(JSON.stringify(req)))
}
