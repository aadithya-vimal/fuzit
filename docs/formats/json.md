# JSON format

The JSON renderer emits the authoritative schema-versioned `ContextBundle`
without renderer-only semantic fields. Pretty output is the default; compact
output is available through the deterministic renderer option. Unsafe integers
are rejected rather than silently rounded.
