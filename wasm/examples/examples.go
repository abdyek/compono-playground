// Package examples reads Compono's golden test cases (testdata/) as the
// playground's examples.
//
// A case is a directory named NNNN_name with:
//
//	input.comp      the source
//	output.golden   the HTML, output.diag the diagnostics (not read here)
//	context.json    the context, if any
//	global/         the global components: NAME.comp, and NAME/ for the
//	                sub-components of NAME, with .isolated if NAME is isolated
//
// The source and the globals are trimmed as Compono's golden test does.
package examples

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// File is the JSON written next to a build.
type File struct {
	Examples []Example `json:"examples"`
}

// Example is a golden case in the shape of the playground's input.
type Example struct {
	// ID is the name of the case's directory.
	ID     string `json:"id"`
	Number int    `json:"number"`
	Title  string `json:"title"`
	Source string `json:"source"`
	// Globals has the shape of the bridge's Global.
	Globals []Global `json:"globals"`
	// Context is the JSON text of context.json, or "" without one.
	Context string `json:"context"`
}

// Global is a global component with its sub-components.
type Global struct {
	Name     string   `json:"name"`
	Source   string   `json:"source"`
	Isolated bool     `json:"isolated,omitempty"`
	Globals  []Global `json:"globals,omitempty"`
}

var caseName = regexp.MustCompile(`^(\d+)_(.+)$`)

// Load reads the cases in dir in the order of their names. A missing dir has
// no cases.
func Load(dir string) ([]Example, error) {
	entries, err := os.ReadDir(dir)
	if errors.Is(err, fs.ErrNotExist) {
		return []Example{}, nil
	}
	if err != nil {
		return nil, err
	}
	examples := []Example{}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		ex, err := loadCase(filepath.Join(dir, e.Name()))
		if err != nil {
			return nil, fmt.Errorf("case %s: %w", e.Name(), err)
		}
		examples = append(examples, ex)
	}
	return examples, nil
}

func loadCase(dir string) (Example, error) {
	id := filepath.Base(dir)
	ex := Example{ID: id, Title: id}
	if m := caseName.FindStringSubmatch(id); m != nil {
		ex.Number, _ = strconv.Atoi(m[1])
		ex.Title = strings.ReplaceAll(m[2], "_", " ")
	}

	input, err := os.ReadFile(filepath.Join(dir, "input.comp"))
	if err != nil {
		return Example{}, err
	}
	ex.Source = strings.TrimSpace(string(input))

	if ex.Globals, err = loadGlobals(filepath.Join(dir, "global")); err != nil {
		return Example{}, err
	}

	context, err := os.ReadFile(filepath.Join(dir, "context.json"))
	switch {
	case err == nil:
		ex.Context = strings.TrimSpace(string(context))
	case !errors.Is(err, fs.ErrNotExist):
		return Example{}, err
	}
	return ex, nil
}

// loadGlobals reads the globals of a scope directory, in the order of their
// names.
func loadGlobals(dir string) ([]Global, error) {
	files, err := filepath.Glob(filepath.Join(dir, "*.comp"))
	if err != nil {
		return nil, err
	}
	globals := []Global{}
	for _, path := range files {
		name := strings.TrimSuffix(filepath.Base(path), ".comp")
		src, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		sub := filepath.Join(dir, name)
		subs, err := loadGlobals(sub)
		if err != nil {
			return nil, err
		}
		g := Global{Name: name, Source: strings.TrimRight(string(src), " \t\r\n"), Globals: subs}
		if _, err := os.Stat(filepath.Join(sub, ".isolated")); err == nil {
			g.Isolated = true
		}
		globals = append(globals, g)
	}
	return globals, nil
}
