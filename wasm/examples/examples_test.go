package examples

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func write(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestLoad(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "0002_with_scope/input.comp"), "\n{{ LAYOUT }}\n\n")
	write(t, filepath.Join(dir, "0002_with_scope/global/LAYOUT.comp"), "{{ CARD }}\n\n")
	write(t, filepath.Join(dir, "0002_with_scope/global/LAYOUT/.isolated"), "")
	write(t, filepath.Join(dir, "0002_with_scope/global/LAYOUT/CARD.comp"), "  card  \n")
	write(t, filepath.Join(dir, "0002_with_scope/global/LAYOUT/CARD/DEEP.comp"), "deep")
	write(t, filepath.Join(dir, "0002_with_scope/global/A.comp"), "a")
	write(t, filepath.Join(dir, "0001_basic_case/input.comp"), "# Hi")
	write(t, filepath.Join(dir, "0001_basic_case/context.json"), "{\n  \"a\": 1\n}\n")
	write(t, filepath.Join(dir, "unnumbered/input.comp"), "x")
	write(t, filepath.Join(dir, "README.md"), "not a case")

	got, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	want := []Example{
		{ID: "0001_basic_case", Number: 1, Title: "basic case", Source: "# Hi", Globals: []Global{}, Context: "{\n  \"a\": 1\n}"},
		{ID: "0002_with_scope", Number: 2, Title: "with scope", Source: "{{ LAYOUT }}", Globals: []Global{
			{Name: "A", Source: "a", Globals: []Global{}},
			{Name: "LAYOUT", Source: "{{ CARD }}", Isolated: true, Globals: []Global{
				{Name: "CARD", Source: "  card", Globals: []Global{
					{Name: "DEEP", Source: "deep", Globals: []Global{}},
				}},
			}},
		}},
		{ID: "unnumbered", Title: "unnumbered", Source: "x", Globals: []Global{}},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got  %+v\nwant %+v", got, want)
	}
}

func TestLoadMissingDir(t *testing.T) {
	got, err := Load(filepath.Join(t.TempDir(), "testdata"))
	if err != nil || got == nil || len(got) != 0 {
		t.Fatalf("expected no examples, got %v, %v", got, err)
	}
}

func TestLoadMissingInput(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "0001_broken/output.golden"), "")
	if _, err := Load(dir); err == nil {
		t.Fatal("expected an error for a case without input.comp")
	}
}
