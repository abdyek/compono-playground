package main

import (
	"strings"
	"testing"
)

func TestConvertRendersHTML(t *testing.T) {
	res := Convert(Request{Source: "{{ HELLO name = \"World\" }}\n\n~ HELLO name = \"\"\n# Hello, {{ name }}!"})
	if res.Fatal != nil {
		t.Fatalf("unexpected fatal: %+v", res.Fatal)
	}
	if res.HTML != "<h1>Hello, World!</h1>" {
		t.Fatalf("unexpected html: %q", res.HTML)
	}
	if res.Diagnostics == nil || len(res.Diagnostics) != 0 {
		t.Fatalf("expected empty non-nil diagnostics, got %#v", res.Diagnostics)
	}
}

func TestConvertReturnsDiagnosticsWithCalls(t *testing.T) {
	res := Convert(Request{
		Source:  "{{ PAGE }}",
		Globals: []Global{{Name: "PAGE", Source: "Hi {{ MISSING }}"}},
	})
	if res.Fatal != nil {
		t.Fatalf("unexpected fatal: %+v", res.Fatal)
	}
	if len(res.Diagnostics) != 1 {
		t.Fatalf("expected 1 diagnostic, got %#v", res.Diagnostics)
	}
	d := res.Diagnostics[0]
	if d.Code != "unknown-component" {
		t.Fatalf("unexpected code: %q", d.Code)
	}
	if len(d.Source) != 1 || d.Source[0] != "PAGE" {
		t.Fatalf("unexpected source: %#v", d.Source)
	}
	if d.Range.Start.Line != 1 || d.Range.Start.Column != 4 {
		t.Fatalf("unexpected range: %+v", d.Range)
	}
	if len(d.Calls) != 1 || d.Calls[0].Name != "PAGE" || d.Calls[0].Kind != "global" {
		t.Fatalf("unexpected calls: %#v", d.Calls)
	}
}

func TestConvertSubComponents(t *testing.T) {
	res := Convert(Request{
		Source: "{{ CARD }}\n\n{{ LAYOUT }}",
		Globals: []Global{
			{Name: "CARD", Source: "# Root Card"},
			{Name: "LAYOUT", Source: "## Layout\n{{ CARD }}\n{{ TABLE }}", Isolated: true, Globals: []Global{
				{Name: "CARD", Source: "*Layout Card*"},
				{Name: "TABLE", Source: "**Table**"},
			}},
		},
	})
	if res.Fatal != nil {
		t.Fatalf("unexpected fatal: %+v", res.Fatal)
	}
	want := "<h1>Root Card</h1><h2>Layout</h2><p><em>Layout Card</em></p><p><strong>Table</strong></p>"
	if res.HTML != want {
		t.Fatalf("unexpected html: %q", res.HTML)
	}
	if len(res.Diagnostics) != 0 {
		t.Fatalf("unexpected diagnostics: %#v", res.Diagnostics)
	}
}

func TestConvertIsolatedScope(t *testing.T) {
	// B is isolated, so the X of its owner A isn't visible from it.
	res := Convert(Request{
		Source: "{{ A }}",
		Globals: []Global{
			{Name: "A", Source: "{{ B }}", Globals: []Global{
				{Name: "B", Source: "{{ X }}", Isolated: true},
				{Name: "X", Source: "x from A"},
			}},
		},
	})
	if res.Fatal != nil {
		t.Fatalf("unexpected fatal: %+v", res.Fatal)
	}
	if len(res.Diagnostics) != 1 {
		t.Fatalf("expected 1 diagnostic, got %#v", res.Diagnostics)
	}
	d := res.Diagnostics[0]
	if d.Code != "unknown-component" || strings.Join(d.Source, "/") != "A/B" {
		t.Fatalf("unexpected diagnostic: %#v", d)
	}
	if len(d.Calls) != 2 || d.Calls[0].Name != "A" || d.Calls[1].Name != "B" || strings.Join(d.Calls[1].Source, "/") != "A" {
		t.Fatalf("unexpected calls: %#v", d.Calls)
	}
}

func TestConvertSubComponentIsNotVisibleFromSource(t *testing.T) {
	res := Convert(Request{
		Source:  "{{ SUB }}",
		Globals: []Global{{Name: "A", Source: "a", Globals: []Global{{Name: "SUB", Source: "sub"}}}},
	})
	if res.Fatal != nil {
		t.Fatalf("unexpected fatal: %+v", res.Fatal)
	}
	if len(res.Diagnostics) != 1 || res.Diagnostics[0].Code != "unknown-component" {
		t.Fatalf("expected an unknown component, got %#v", res.Diagnostics)
	}
}

func TestConvertContextIntegers(t *testing.T) {
	res := Convert(Request{
		Source:  "{{ context(app/version) }} {{ context(stats)[1] }}",
		Context: `{"app/version": "1.2.0", "stats": [10, 20]}`,
	})
	if res.Fatal != nil {
		t.Fatalf("unexpected fatal: %+v", res.Fatal)
	}
	if res.HTML != "<p>1.2.0 20</p>" {
		t.Fatalf("unexpected html: %q", res.HTML)
	}
}

func TestConvertFatals(t *testing.T) {
	tests := []struct {
		name string
		req  Request
		kind string
	}{
		{"float context", Request{Source: "x", Context: `{"a": 1.5}`}, "compono"},
		{"null context", Request{Source: "x", Context: `{"a": null}`}, "compono"},
		{"invalid json", Request{Source: "x", Context: `{"a": `}, "input"},
		{"trailing json", Request{Source: "x", Context: `{} {}`}, "input"},
		{"non-object context", Request{Source: "x", Context: `[1]`}, "input"},
		{"invalid global name", Request{Source: "x", Globals: []Global{{Name: "page", Source: "y"}}}, "compono"},
		{"duplicate global", Request{Source: "x", Globals: []Global{{Name: "A", Source: "y"}, {Name: "A", Source: "z"}}}, "compono"},
		{"duplicate sub-component", Request{Source: "x", Globals: []Global{{Name: "A", Source: "y", Globals: []Global{{Name: "B", Source: "1"}, {Name: "B", Source: "2"}}}}}, "compono"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := Convert(tt.req)
			if res.Fatal == nil {
				t.Fatalf("expected fatal, got %+v", res)
			}
			if res.Fatal.Kind != tt.kind {
				t.Fatalf("expected kind %q, got %+v", tt.kind, res.Fatal)
			}
			if res.HTML != "" || res.Diagnostics != nil {
				t.Fatalf("expected no output, got %+v", res)
			}
			if tt.kind == "compono" && res.Fatal.Code == 0 {
				t.Fatalf("expected a compono error code, got %+v", res.Fatal)
			}
			if strings.TrimSpace(res.Fatal.Message) == "" {
				t.Fatal("expected a message")
			}
		})
	}
}
