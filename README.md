# [Compono Playground](https://play.compono.md)

A playground for [Compono](https://github.com/umono-cms/compono), the Markdown based semantic HTML DSL. Write a source, global components and a context, and see the output as rendered HTML and as raw HTML, together with Compono's diagnostics and fatal errors.

Compono runs in your browser: it is compiled to WebAssembly and the playground is a static site. Nothing you write leaves your browser unless you share a link.

## Features

- **Source, global components and context.** Globals are given to `Convert` with `WithGlobalComponent`, the context (a JSON object) with `WithContext`. JSON integers become Go `int`s; floats and `null` reach Compono as they are, so its own fatal error shows.
- **Diagnostics.** Each diagnostic shows its code, message, location and call chain. The dropped unit is underlined in its editor; clicking a diagnostic or a call in its chain selects it.
- **Fatal errors.** Errors returned by `Convert`, invalid context JSON, recovered panics and conversions that run longer than 5 seconds are shown in place of the output.
- **Output.** An unstyled preview in a sandboxed iframe that runs no scripts, and the exact HTML. The preview can use the browser's dark defaults; the choice is remembered in the browser.
- **Versions.** Compono's newest main (`main (5e0657f)`) and every release since v0.7.0 (`v0.7.5`). New commits and tags are built automatically.
- **Share links.** The whole input, with the version, is compressed into the link's hash. Your last input is also kept in the browser.

## Development

Requires Node.js 20.19+ and Go 1.23+. Compono builds aren't in the repository; build one first:

```sh
npm install
scripts/build-wasm.sh main   # builds Compono's main into public/compono/
npm run dev                  # http://localhost:5173
npm test                     # unit tests; the example tests need a build
npm run build                # type checks and builds the static site into dist/
```

`scripts/build-wasm.sh` takes any Compono ref (`main`, `v0.7.5`, a commit) and optionally a repository or a local clone: `scripts/build-wasm.sh my-branch ../compono`. See [docs/WASM.md](docs/WASM.md).

### Project layout

```
wasm/                  Go bridge between the playground and Compono, compiled to WASM
scripts/               Building Compono (build-wasm.sh locally, compile-wasm.sh for both)
deploy/                The sync that deploys play.compono.md, its systemd units and nginx config
src/compono/           The Web Worker that runs a WASM build, and its client
src/editor/            CodeMirror setup and the Compono highlighter
src/state/             The playground's state, examples and share links
src/components/        The UI
```

## Compono versions

The version picker lists main first, then the release tags from newest to oldest. The playground opens the newest release, or main when there is none. The bridge uses the API of Compono v0.7 (`Convert` returning diagnostics), so versions before v0.7 aren't built.

## Deployment

play.compono.md deploys itself: a systemd timer polls Compono and the playground every 5 minutes, deploys new playground release tags, and builds Compono's newest main and every new release tag. See [docs/DEPLOY.md](docs/DEPLOY.md).

## License

[MIT](LICENSE)
