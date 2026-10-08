// Loads a built Compono WASM bridge in Node for tests.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ConvertRequest, ConvertResponse, VersionManifest } from '../compono/types'
import { defaultVersion } from '../compono/versions'

const root = resolve(import.meta.dirname, '../../public/compono')

/** Whether a local build exists (scripts/build-wasm.sh). */
export const hasLocalBuild = existsSync(`${root}/versions.json`)

/** Loads the local build of the version the playground opens by default. */
export async function loadDefaultBridge(): Promise<(req: ConvertRequest) => ConvertResponse> {
  const manifest = JSON.parse(readFileSync(`${root}/versions.json`, 'utf8')) as VersionManifest
  const dir = `${root}/${defaultVersion(manifest.versions)!.path}`
  await import(pathToFileURL(`${dir}/wasm_exec.js`).href)
  const go = new globalThis.Go()
  const { instance } = await WebAssembly.instantiate(readFileSync(`${dir}/compono.wasm`), go.importObject)
  void go.run(instance)
  return (req) => JSON.parse(globalThis.componoConvert!(JSON.stringify(req)))
}
