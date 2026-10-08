# Building Compono for the playground

The playground runs Compono as WebAssembly. Builds aren't in the repository: in production `deploy/sync.mjs` makes them ([DEPLOY.md](DEPLOY.md)), locally `scripts/build-wasm.sh` does.

## How it fits together

```
wasm/ (Go)                       compono/<path>/                 src/compono/ (TypeScript)
convert.go  Request -> Response  compono.wasm  the bridge +      worker.ts  loads wasm_exec.js and
main_js.go  componoConvert()                   Compono           compono.wasm, calls componoConvert
                                 wasm_exec.js  Go's JS runtime   runner.ts  one worker per version,
                                               for that build               timeouts, crashes
```

- `wasm/` is a Go module that imports `github.com/umono-cms/compono`. It has no fixed Compono version: the build points it to the Compono tree being built (`go mod edit -replace`).
- `componoConvert(request)` takes and returns JSON. Its shapes are `Request` and `Response` in `wasm/convert.go` and the same types in `src/compono/types.ts`. Change both together.
- `wasm_exec.js` belongs to the Go version that built the `.wasm` file; they can't be mixed. Each build has its own copy.

## The manifest

`compono/versions.json` lists the builds a playground serves ([scripts/lib/manifest.mjs](../scripts/lib/manifest.mjs)):

```json
{
  "versions": [
    {
      "id": "main",
      "label": "main (5e0657f)",
      "ref": "main",
      "commit": "5e0657ff3f76ee75773601cd4df2a3f371205c05",
      "go": "go1.26.0",
      "bridge": "2c414f68f8a179f0b86b619831c218523573a228",
      "path": "5e0657ff3f-2c414f68f8",
      "builtAt": "2026-10-08T09:35:05.074Z"
    }
  ]
}
```

- `id` is what the version picker and share links use. A tag is listed by its name (`v0.7.5`), anything else with its commit (`main (5e0657f)`).
- `bridge` is the git tree hash of `wasm/` the build was made with. The frontend and the bridge are released together, so a playground release only serves builds of its own bridge.
- `path` is named after the Compono commit and the bridge. A published build never changes, so it can be cached for good, and a tag on main's commit shares main's build.
- Branches come first, then tags from newest to oldest. The playground opens the newest tag, or the first version when there is no tag.

## Building locally

Requires Go 1.23+, git and Node.js.

```sh
scripts/build-wasm.sh <ref> [repo]
```

- `ref` is a tag (`v0.7.5`), a branch (`main`) or a commit.
- `repo` defaults to `https://github.com/umono-cms/compono.git`. A local clone works too, e.g. to try an unpublished branch: `scripts/build-wasm.sh my-branch ../compono`. Only committed changes are built.

It clones `repo` at `ref`, compiles it with `scripts/compile-wasm.sh` into `public/compono/<path>/` and lists it in `public/compono/versions.json`, replacing an earlier build of the same id. With uncommitted changes in `wasm/` the bridge is listed as `dev`.

`scripts/compile-wasm.sh <compono-dir> <out-dir>` is the step both the local build and the deploy use: it points a copy of `wasm/` to a Compono tree, runs the bridge's Go tests against it, and builds `compono.wasm` with `GOOS=js GOARCH=wasm` next to `wasm_exec.js`.

## Compatibility

The bridge is written against the v0.7 API: `Convert(source, writer, opts...) ([]Diagnostic, error)`, `WithGlobalComponent(name, source)`, `WithContext(map[string]any)` and `*ComponoError`. Versions before v0.7 aren't built. If Compono changes this API, the bridge's tests fail, the deploy keeps the last build that worked and logs the failure, and the bridge has to be updated.

The examples (`src/state/examples.ts`) are written for the version the playground opens by default, and `npm test` checks them against the local build of that version. When its syntax changes (e.g. global parameter lines become `~ title = ""` in v0.7), update the examples and their snapshots (`npx vitest run -u`).

## Size

A build is about 5.4 MB, 1.4 MB gzipped. The web server should compress `.wasm` files; the configs in `deploy/` do ([Caddyfile](../deploy/Caddyfile), [nginx.conf](../deploy/nginx.conf)). TinyGo would make it smaller but supports less of the standard library and reflection that Compono's context uses, so the standard Go toolchain is used.
