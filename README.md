# [Compono Playground](https://play.compono.md)

A playground for [Compono](https://github.com/umono-cms/compono), the Markdown based semantic HTML DSL. Write a source, global components and a context, and see the output as rendered HTML and as raw HTML, together with Compono's diagnostics and fatal errors.

Compono runs in your browser: it is compiled to WebAssembly and the playground is a static site. Nothing you write leaves your browser unless you share a link.

## Features

- **Source, global components and context.** Globals are given to `Convert` with `WithGlobalComponent`, the context (a JSON object) with `WithContext`. JSON integers become Go `int`s; floats and `null` reach Compono as they are, so its own fatal error shows.
- **Diagnostics.** Each diagnostic shows its code, message, location and call chain. The dropped unit is underlined in its editor; clicking a diagnostic or a call in its chain selects it.
- **Fatal errors.** Errors returned by `Convert`, invalid context JSON, recovered panics and conversions that run longer than 5 seconds are shown in place of the output.
- **Output.** An unstyled preview in a sandboxed iframe that runs no scripts, and the exact HTML.
- **Versions.** Every Compono version the playground was built with can be picked. Tags are listed by name (`v0.7.5`), branches with their commit (`main (5e0657f)`).
- **Share links.** The whole input, with the version, is compressed into the link's hash. Your last input is also kept in the browser.

## Development

Requires Node.js 20.19+ and, for building Compono, Go 1.23+.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests; the example tests run the default WASM build
npm run build      # type checks and builds the static site into dist/
```

### Project layout

```
wasm/                  Go bridge between the playground and Compono, compiled to WASM
scripts/build-wasm.sh  Builds the bridge for a Compono ref into public/compono/<id>/
public/compono/        The WASM builds and versions.json, the list of versions
src/compono/           The Web Worker that runs a WASM build, and its client
src/editor/            CodeMirror setup and the Compono highlighter
src/state/             The playground's state, examples and share links
src/components/        The UI
```

## Compono versions

The WASM builds are committed in `public/compono/`. To add or update a version, see [docs/WASM.md](docs/WASM.md). In short:

```sh
scripts/build-wasm.sh main      # main (abc1234)
scripts/build-wasm.sh v0.7.5    # v0.7.5
```

The bridge uses the API of Compono v0.7 (`Convert` returning diagnostics), so versions before v0.7 can't be built.

## Deployment

`npm run build` produces a static site in `dist/`; serve it as it is. With nginx:

```nginx
server {
    server_name play.compono.md;
    root /var/www/compono-playground;

    gzip on;
    gzip_types application/wasm application/javascript text/css application/json image/svg+xml;

    # Hashed file names; they never change.
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # A rebuild of a version keeps its path, so revalidate.
    location /compono/ {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

`.wasm` files must be served as `application/wasm`. nginx's `mime.types` has it since 1.21.0; on older versions add it there. A WASM build is about 5.4 MB, 1.4 MB gzipped.

## License

[MIT](LICENSE)
