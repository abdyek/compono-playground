# Building Compono for the playground

The playground runs Compono as WebAssembly. Each Compono version is a separate build in `public/compono/<id>/`, listed in `public/compono/versions.json`. Building is manual: run the script, check the result, commit it.

## How it fits together

```
wasm/ (Go)                       public/compono/<id>/            src/compono/ (TypeScript)
convert.go  Request -> Response  compono.wasm  the bridge +      worker.ts  loads wasm_exec.js and
main_js.go  componoConvert()                   Compono           compono.wasm, calls componoConvert
                                 wasm_exec.js  Go's JS runtime   runner.ts  one worker per version,
                                               for that build               timeouts, crashes
```

- `wasm/` is a Go module that imports `github.com/umono-cms/compono`. It has no fixed Compono version: the build script points it to the ref being built.
- `componoConvert(request)` takes and returns JSON. Its shapes are `Request` and `Response` in `wasm/convert.go` and the same types in `src/compono/types.ts`. Change both together.
- `wasm_exec.js` belongs to the Go version that built the `.wasm` file; they can't be mixed. The script copies it next to each build.

## Adding or updating a version

Requires Go (1.23+), git and Node.js.

```sh
scripts/build-wasm.sh <ref> [repo]
```

- `ref` is a tag (`v0.7.5`), a branch (`main`) or a commit.
- `repo` defaults to `https://github.com/umono-cms/compono.git`. A local clone works too, e.g. to try an unpublished branch: `scripts/build-wasm.sh my-branch ../compono`. Only committed changes are built.

The script:

1. clones `repo` and checks out `ref`,
2. copies `wasm/` to a temporary directory and points it to the clone (`go mod edit -replace`),
3. runs the bridge's Go tests against that Compono,
4. builds `public/compono/<id>/compono.wasm` with `GOOS=js GOARCH=wasm` and copies `wasm_exec.js` next to it,
5. adds or replaces the version in `public/compono/versions.json`.

A tag is published under its name: id and label `v0.7.5`. Anything else is published under the ref's name with the commit in its label: id `main`, label `main (5e0657f)`. Building `main` again replaces the previous `main` build.

Then check it and commit:

```sh
npm test           # runs the examples against the default version
npm run dev        # try the new version in the version picker
git add public/compono
git commit -m "build: update compono main to 5e0657f"
```

## The default version

`versions.json` has a `default`: the version a new visitor gets. The script sets it only when it is missing, so it stays `main` until you change it. When v0.7 is released, build the tag and set `"default"` to it by hand:

```json
{
  "default": "v0.7.0",
  "versions": [ ... ]
}
```

Versions are ordered branches first, then tags from newest to oldest. Removing a version is deleting its directory and its entry; share links made with it open with the default version and a notice.

## Compatibility

The bridge is written against the v0.7 API: `Convert(source, writer, opts...) ([]Diagnostic, error)`, `WithGlobalComponent(name, source)`, `WithContext(map[string]any)` and `*ComponoError`. Versions before v0.7 can't be built. If a later version changes this API, the bridge's tests fail in step 3 and the bridge has to be updated, keeping it buildable for the versions still listed.

The examples (`src/state/examples.ts`) are written for the default version, and `npm test` checks them against it. When the default changes (e.g. global parameter lines become `~ title = ""` in v0.7), update the examples and their snapshots (`npx vitest run -u`).

## Size

A build is about 5.4 MB, 1.4 MB gzipped. The server should compress `.wasm` files (see the README). TinyGo would make it smaller but supports less of the standard library and reflection that Compono's context uses, so the standard Go toolchain is used.
