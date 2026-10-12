// Command examples writes Compono's golden test cases as the playground's
// examples.
//
// Usage: examples <compono-dir> <out-file>
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/umono-cms/compono-playground/wasm/examples"
)

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "usage: examples <compono-dir> <out-file>")
		os.Exit(2)
	}
	list, err := examples.Load(filepath.Join(os.Args[1], "testdata"))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	out, err := json.Marshal(examples.File{Examples: list})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := os.WriteFile(os.Args[2], out, 0o644); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
