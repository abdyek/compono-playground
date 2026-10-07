//go:build js && wasm

package main

import (
	"encoding/json"
	"syscall/js"
)

// main exposes componoConvert(requestJSON) -> responseJSON on the global
// object and keeps the program alive for later calls.
func main() {
	js.Global().Set("componoConvert", js.FuncOf(func(_ js.Value, args []js.Value) any {
		var req Request
		if len(args) != 1 || args[0].Type() != js.TypeString {
			return encode(Response{Fatal: &Fatal{Kind: "input", Message: "componoConvert expects a JSON string"}})
		}
		if err := json.Unmarshal([]byte(args[0].String()), &req); err != nil {
			return encode(Response{Fatal: &Fatal{Kind: "input", Message: "invalid request: " + err.Error()}})
		}
		return encode(Convert(req))
	}))
	select {}
}

func encode(res Response) string {
	out, err := json.Marshal(res)
	if err != nil {
		out, _ = json.Marshal(Response{Fatal: &Fatal{Kind: "panic", Message: err.Error()}})
	}
	return string(out)
}
