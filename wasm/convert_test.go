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
