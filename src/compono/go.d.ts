// Globals of the Go WASM runtime and the Compono bridge.

interface GoRuntime {
  importObject: WebAssembly.Imports
  run(instance: WebAssembly.Instance): Promise<void>
}

// Set by wasm_exec.js.
declare var Go: { new (): GoRuntime }

// Set by the WASM bridge (wasm/main_js.go).
declare var componoConvert: ((request: string) => string) | undefined
