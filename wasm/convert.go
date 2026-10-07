package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"runtime/debug"
	"strings"

	"github.com/umono-cms/compono"
)

// Request is a single conversion asked by the playground.
type Request struct {
	Source  string   `json:"source"`
	Globals []Global `json:"globals"`
	// Context is the context as JSON text. Blank means no context.
	Context string `json:"context"`
}

// Global is a global component given to the conversion.
type Global struct {
	Name   string `json:"name"`
	Source string `json:"source"`
}

// Response is the result of a conversion. Either Fatal is set and HTML is
// empty, or HTML and Diagnostics are the output of Convert.
type Response struct {
	HTML        string       `json:"html"`
	Diagnostics []Diagnostic `json:"diagnostics"`
	Fatal       *Fatal       `json:"fatal"`
}

// Fatal is an error that prevents any output.
type Fatal struct {
	// Kind is "input" for a context the playground can't read, "compono" for
	// an error returned by Convert and "panic" for a recovered panic.
	Kind string `json:"kind"`
	// Code is the compono.ErrorCode of a "compono" fatal.
	Code    int    `json:"code,omitempty"`
	Message string `json:"message"`
	// Stack is the stack trace of a "panic" fatal.
	Stack string `json:"stack,omitempty"`
}

type Position struct {
	Offset int `json:"offset"`
	Line   int `json:"line"`
	Column int `json:"column"`
}

type Range struct {
	Start Position `json:"start"`
	End   Position `json:"end"`
}

type Diagnostic struct {
	Code    string   `json:"code"`
	Message string   `json:"message"`
	Source  []string `json:"source"`
	Range   Range    `json:"range"`
	Calls   []Call   `json:"calls"`
}

type Call struct {
	Name   string   `json:"name"`
	Kind   string   `json:"kind"`
	Source []string `json:"source"`
	Range  Range    `json:"range"`
}

var c = compono.New()

// Convert runs a conversion and never panics.
func Convert(req Request) (res Response) {
	defer func() {
		if r := recover(); r != nil {
			res = Response{Fatal: &Fatal{
				Kind:    "panic",
				Message: fmt.Sprint(r),
				Stack:   string(debug.Stack()),
			}}
		}
	}()

	var opts []compono.ConvertOption
	for _, g := range req.Globals {
		opts = append(opts, compono.WithGlobalComponent(g.Name, []byte(g.Source)))
	}

	if strings.TrimSpace(req.Context) != "" {
		values, err := decodeContext(req.Context)
		if err != nil {
			return Response{Fatal: &Fatal{Kind: "input", Message: err.Error()}}
		}
		opts = append(opts, compono.WithContext(values))
	}

	var buf bytes.Buffer
	diags, err := c.Convert([]byte(req.Source), &buf, opts...)
	if err != nil {
		fatal := &Fatal{Kind: "compono", Message: err.Error()}
		var ce *compono.ComponoError
		if errors.As(err, &ce) {
			fatal.Code = int(ce.Code)
		}
		return Response{Fatal: fatal}
	}

	res.HTML = buf.String()
	res.Diagnostics = make([]Diagnostic, 0, len(diags))
	for _, d := range diags {
		calls := make([]Call, 0, len(d.Calls))
		for _, call := range d.Calls {
			calls = append(calls, Call{
				Name:   call.Name,
				Kind:   string(call.Kind),
				Source: nonNil(call.Source),
				Range:  toRange(call.Range),
			})
		}
		res.Diagnostics = append(res.Diagnostics, Diagnostic{
			Code:    string(d.Code),
			Message: d.Message,
			Source:  nonNil(d.Source),
			Range:   toRange(d.Range),
			Calls:   calls,
		})
	}
	return res
}

// decodeContext reads the context JSON. It must be an object. Integers become
// int; any other number stays float64 and null stays nil, so that Compono
// itself reports them as unsupported.
func decodeContext(text string) (map[string]any, error) {
	dec := json.NewDecoder(strings.NewReader(text))
	dec.UseNumber()
	var raw any
	if err := dec.Decode(&raw); err != nil {
		return nil, fmt.Errorf("context is not valid JSON: %w", err)
	}
	if dec.More() {
		return nil, errors.New("context is not valid JSON: unexpected data after the top-level value")
	}
	obj, ok := raw.(map[string]any)
	if !ok {
		return nil, errors.New("context must be a JSON object")
	}
	return normalize(obj).(map[string]any), nil
}

func normalize(v any) any {
	switch v := v.(type) {
	case json.Number:
		if i, err := v.Int64(); err == nil {
			return int(i)
		}
		f, _ := v.Float64()
		return f
	case map[string]any:
		for k, item := range v {
			v[k] = normalize(item)
		}
		return v
	case []any:
		for i, item := range v {
			v[i] = normalize(item)
		}
		return v
	default:
		return v
	}
}

func toRange(r compono.Range) Range {
	return Range{
		Start: Position{Offset: r.Start.Offset, Line: r.Start.Line, Column: r.Start.Column},
		End:   Position{Offset: r.End.Offset, Line: r.End.Line, Column: r.End.Column},
	}
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
