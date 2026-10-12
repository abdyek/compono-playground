package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/umono-cms/compono-playground/wasm/examples"
)

// TestGoldenExamples converts every example through the bridge and compares
// it with its case's output.golden and output.diag, so that an example shows
// what Compono's golden test expects. COMPONO_DIR is the Compono tree the
// bridge is built against; scripts/compile-wasm.sh sets it.
func TestGoldenExamples(t *testing.T) {
	dir := os.Getenv("COMPONO_DIR")
	if dir == "" {
		t.Skip("COMPONO_DIR is not set")
	}
	testdata := filepath.Join(dir, "testdata")
	list, err := examples.Load(testdata)
	if err != nil {
		t.Fatal(err)
	}
	for _, ex := range list {
		t.Run(ex.ID, func(t *testing.T) {
			res := Convert(Request{Source: ex.Source, Globals: bridgeGlobals(t, ex.Globals), Context: ex.Context})
			if res.Fatal != nil {
				t.Fatalf("fatal: %+v", res.Fatal)
			}
			if want := readTrimmed(t, filepath.Join(testdata, ex.ID, "output.golden")); res.HTML != want {
				t.Errorf("html:\n got %q\nwant %q", res.HTML, want)
			}
			if got, want := formatDiagnostics(res.Diagnostics), readTrimmed(t, filepath.Join(testdata, ex.ID, "output.diag")); got != want {
				t.Errorf("diagnostics:\n got %q\nwant %q", got, want)
			}
		})
	}
}

// bridgeGlobals converts globals through their JSON, the way the playground
// passes them on.
func bridgeGlobals(t *testing.T, globals []examples.Global) []Global {
	t.Helper()
	data, err := json.Marshal(globals)
	if err != nil {
		t.Fatal(err)
	}
	var out []Global
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

// readTrimmed returns the trimmed content of a file, or "" if it doesn't exist.
func readTrimmed(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return ""
	}
	if err != nil {
		t.Fatal(err)
	}
	return strings.TrimSpace(string(data))
}

// formatDiagnostics formats diagnostics as Compono's .diag golden files do:
// "<code> <source> <start>-<end> <calls>" per line.
func formatDiagnostics(diags []Diagnostic) string {
	lines := make([]string, 0, len(diags))
	for _, d := range diags {
		source := strings.Join(d.Source, "/")
		if source == "" {
			source = "-"
		}
		calls := make([]string, 0, len(d.Calls))
		for _, c := range d.Calls {
			calls = append(calls, c.Kind+":"+c.Name)
		}
		chain := strings.Join(calls, ">")
		if chain == "" {
			chain = "-"
		}
		lines = append(lines, fmt.Sprintf("%s %s %d:%d-%d:%d %s", d.Code, source,
			d.Range.Start.Line, d.Range.Start.Column, d.Range.End.Line, d.Range.End.Column, chain))
	}
	return strings.Join(lines, "\n")
}
