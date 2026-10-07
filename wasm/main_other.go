//go:build !(js && wasm)

package main

import (
	"encoding/json"
	"fmt"
	"os"
)

// main reads a request as JSON from stdin and writes the response as JSON to
// stdout. It runs the bridge natively for debugging.
func main() {
	var req Request
	if err := json.NewDecoder(os.Stdin).Decode(&req); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(Convert(req)); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
