#!/usr/bin/env bash
# Builds the Compono WASM bridge for a Compono ref and registers it in
# public/compono/versions.json.
#
# Usage: scripts/build-wasm.sh <ref> [repo]
#   ref   a tag (v0.7.5), a branch (main) or a commit
#   repo  a git URL or a local clone of Compono
#         (default: https://github.com/umono-cms/compono.git)
#
# A tag is published as "v0.7.5". Anything else is published under the ref's
# name with the short commit in parentheses: "main (5e0657f)".
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
	sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
	exit 1
fi

ref="$1"
repo="${2:-https://github.com/umono-cms/compono.git}"
root="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -d "$repo" ]]; then
	repo="$(cd "$repo" && pwd)"
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "Fetching Compono $ref from $repo"
git clone --quiet "$repo" "$work/compono"
git -C "$work/compono" checkout --quiet "$ref" 2>/dev/null ||
	git -C "$work/compono" checkout --quiet "origin/$ref"

commit="$(git -C "$work/compono" rev-parse HEAD)"
short="$(git -C "$work/compono" rev-parse --short=7 HEAD)"

if git -C "$work/compono" show-ref --verify --quiet "refs/tags/$ref"; then
	id="$ref"
	label="$ref"
else
	id="$(printf '%s' "$ref" | tr -c 'A-Za-z0-9._-' '-')"
	label="$ref ($short)"
fi

cp -r "$root/wasm" "$work/bridge"
cd "$work/bridge"
go mod edit -replace "github.com/umono-cms/compono=$work/compono"
go mod tidy

echo "Testing the bridge against $label"
go test ./...

out="$root/public/compono/$id"
mkdir -p "$out"

echo "Building $out/compono.wasm"
GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o "$out/compono.wasm" .

goroot="$(go env GOROOT)"
if [[ -f "$goroot/lib/wasm/wasm_exec.js" ]]; then
	cp "$goroot/lib/wasm/wasm_exec.js" "$out/wasm_exec.js"
else
	cp "$goroot/misc/wasm/wasm_exec.js" "$out/wasm_exec.js"
fi

node "$root/scripts/register-version.mjs" "$root/public/compono/versions.json" \
	"$id" "$label" "$ref" "$commit" "$(go env GOVERSION)"

echo "Done: $label -> public/compono/$id"
