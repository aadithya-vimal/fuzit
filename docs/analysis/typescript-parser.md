# TypeScript and JavaScript parser adapter

The versioned TypeScript compiler-API adapter parses TS, TSX, JS, JSX, ESM,
and CommonJS source without loading project modules or executing repository
code. A `tsconfig` is optional because this phase performs syntax parsing only.

The adapter emits normalized analysis records and never exposes or persists the
compiler AST. Syntax errors produce partial results with bounded diagnostics
containing only diagnostic codes and offsets. Unsupported extensions and files
larger than the documented four-MiB limit produce explicit safe results.

Symbol extraction covers functions, classes, interfaces, types, methods,
variables, exported declarations, test declarations, route candidates, and
schema candidates. Stable IDs include repository, path, symbol kind, name, and
source offset, so overloads, duplicate names, and nested declarations remain
distinct while unchanged content produces identical identities.

Module relationships resolve repository-relative files, configured path
aliases, package exports, and project-reference targets against an explicit
canonical known-file set. ESM, re-exports, named/default exports, and CommonJS
`require` calls retain parsed provenance. Dynamic expressions and missing or
ambiguous targets remain explicitly unresolved; no target is fabricated.
