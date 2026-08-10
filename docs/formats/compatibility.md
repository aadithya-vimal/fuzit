# Renderer compatibility

All renderers consume the same normalized bundle and security-filtered items.
Supported formats are Markdown (`.md`), JSON (`.json`), XML (`.xml`), and plain
text (`.txt`).

`--format auto` selects by output extension and is unavailable for stdout.
Explicit formats must match the output extension. Existing files are never
overwritten. Stdout remains available only to non-binary renderers.
