# Bounded Go analysis

Go analysis version 1 is deterministic and non-executing. It extracts package
and main-module identity, imports and aliases, functions, receiver methods,
interfaces, `_test.go` tests, build constraints, `go.mod` module/replacement
relations, and common HTTP registrations. Unknown packages remain unresolved.

The adapter never runs the Go command, builds packages, loads plugins, or
executes repository code. Malformed structural input produces bounded partial
diagnostics without source-content logging.
