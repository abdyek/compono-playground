#!/usr/bin/env bash
# Builds Compono for local development into public/compono/ and lists it in
# public/compono/versions.json. Production builds are made by deploy/sync.mjs.
#
# Usage: scripts/build-wasm.sh <ref> [repo]
#   ref   a tag (v0.7.5), a branch (main) or a commit
#   repo  a git URL or a local clone of Compono
#         (default: https://github.com/umono-cms/compono.git)
#
# A tag is listed as "v0.7.5". Anything else is listed under the ref's name
# with the short commit: "main (5e0657f)". Building a ref again replaces it.
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
	sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
	exit 1
fi

ref="$1"
repo="${2:-https://github.com/umono-cms/compono.git}"
root="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -d "$repo" ]]; then
	repo="$(cd "$repo" && pwd)"
fi

# The bridge is identified by its git tree; uncommitted changes make it "dev".
bridge="dev"
if git -C "$root" diff --quiet HEAD -- wasm 2>/dev/null; then
	bridge="$(git -C "$root" rev-parse HEAD:wasm)"
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "Fetching Compono $ref from $repo"
git clone --quiet "$repo" "$work/compono"
git -C "$work/compono" checkout --quiet "$ref" 2>/dev/null ||
	git -C "$work/compono" checkout --quiet "origin/$ref"
commit="$(git -C "$work/compono" rev-parse HEAD)"

id="$ref"
if ! git -C "$work/compono" show-ref --verify --quiet "refs/tags/$ref"; then
	id="$(printf '%s' "$ref" | tr -c 'A-Za-z0-9._-' '-')"
fi

echo "Compiling Compono $id at $commit"
"$root/scripts/compile-wasm.sh" "$work/compono" "$work/out"

node "$root/scripts/register-version.mjs" "$root/public/compono" "$work/out" \
	"$id" "$ref" "$commit" "$(go env GOVERSION)" "$bridge"
