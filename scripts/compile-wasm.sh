#!/usr/bin/env bash
# Compiles the WASM bridge (wasm/ next to this script) against a Compono
# source tree. Runs the bridge's tests first.
#
# Usage: scripts/compile-wasm.sh <compono-dir> <out-dir>
#
# Writes <out-dir>/compono.wasm and the wasm_exec.js of the Go that built it.
set -euo pipefail

if [[ $# -ne 2 ]]; then
	sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'
	exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
compono="$(cd "$1" && pwd)"
mkdir -p "$2"
out="$(cd "$2" && pwd)"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

cp -r "$root/wasm" "$work/bridge"
cd "$work/bridge"
go mod edit -replace "github.com/umono-cms/compono=$compono"
go mod tidy

go test ./...
GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o "$out/compono.wasm" .

goroot="$(go env GOROOT)"
if [[ -f "$goroot/lib/wasm/wasm_exec.js" ]]; then
	cp "$goroot/lib/wasm/wasm_exec.js" "$out/wasm_exec.js"
else
	cp "$goroot/misc/wasm/wasm_exec.js" "$out/wasm_exec.js"
fi
