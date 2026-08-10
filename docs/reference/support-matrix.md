# V1 support matrix

| Surface                  | Windows 11 24H2     | Ubuntu 24.04 LTS baseline | macOS 14 Sonoma baseline |
| ------------------------ | ------------------- | ------------------------- | ------------------------ |
| CLI and package binary   | Native verified     | Experimental; community validation pending | Experimental; community validation pending |
| MCP stdio server         | Native verified     | Experimental; community validation pending | Experimental; community validation pending |
| Graph and context engine | Native verified     | Experimental; community validation pending | Experimental; community validation pending |
| Watcher                  | Native verified     | Experimental; community validation pending | Experimental; community validation pending |
| Plugin host              | Native verified     | Experimental; community validation pending | Experimental; community validation pending |
| VS Code extension        | VS Code 1.90+       | Experimental; community validation pending | Experimental; community validation pending |
| Symlink fixtures         | Capability-detected | Experimental; community validation pending | Experimental; community validation pending |

The supported runtime is Node `>=24.0.0 <25.0.0`, pinned by `.nvmrc` to major 24. The package manager is exactly pnpm `11.9.0` through Corepack. Git 2.40 or
newer is assumed. Repository text is UTF-8 with LF normalization, process
arguments never require a shell, and paths are serialized as canonical
repository-relative forward-slash paths.

Host separator representation does not affect stable path or bundle identity.
Case is preserved; case-collision handling remains explicit and filesystem-aware.
Unicode normalization forms are likewise preserved rather than silently folded.
Host filesystem limits can still reject a path with an actionable error.

Optional parsers, native or WASM integrations, and extension-host features may
claim narrower support only after their own deterministic local evidence is
recorded. Unsupported optional capabilities fail closed or return an actionable
degraded-mode diagnostic; they do not weaken core CLI support.

The recorded WSL2 result uses Ubuntu 26.04 LTS, Linux-native Node `v24.19.0`,
pnpm `11.9.0`, and a clone on the Linux filesystem rather than `/mnt/c`. It is
compatibility evidence, not genuine native-Ubuntu release evidence. Native-host
Linux validation is community-validation-pending and is not claimed.

No genuine native macOS validation was performed. macOS support is experimental
and community-validation-pending.

Release status and accepted platform limitations are recorded in
[release-state.json](../release/release-state.json). The table distinguishes
intended baselines from observed evidence and does not claim native validation
where none was performed.

## Language and parser support

Support describes deterministic static extraction, not execution, compilation,
or full language-server semantics.

| Language | V1 level | Parser requirements and limits | Evidence |
| --- | --- | --- | --- |
| TypeScript and JavaScript | Bounded normalized syntax, symbols, imports/exports, calls, routes, and manifest/workspace facts | Bundled TypeScript syntax adapter; `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, and `.cjs`; maximum source size 4 MiB | [parser fixtures](../../tests/analysis/typescript-parser.test.ts), [symbol fixtures](../../tests/analysis/typescript-symbols.test.ts), [module fixtures](../../tests/analysis/typescript-modules.test.ts) |
| Python | Bounded normalized syntax, symbols, imports, calls, decorators/routes, requirements and `pyproject.toml` facts | Bundled syntax adapter; `.py`; maximum source size 4 MiB | [parser fixtures](../../tests/analysis/python-parser.test.ts), [symbol fixtures](../../tests/analysis/python-symbols.test.ts), [manifest fixtures](../../packages/analysis/test/ecosystem-manifests.test.ts) |
| Java | Bounded classes, methods, imports, annotations, calls, routes, Maven and Gradle facts | Bundled bounded adapter; `.java`; no JVM, Maven, or Gradle execution | [analysis fixtures](../../tests/analysis/java-analysis.test.ts), [manifest fixtures](../../packages/analysis/test/ecosystem-manifests.test.ts) |
| Go | Bounded declarations, imports, calls, routes, `go.mod` and `go.work` facts | Bundled bounded adapter; `.go`; no Go toolchain execution | [analysis fixtures](../../tests/analysis/go-analysis.test.ts), [manifest fixtures](../../packages/analysis/test/ecosystem-manifests.test.ts) |
| Other text and binary formats | Secure discovery, classification, bounded metadata, and context filtering only | No semantic parser claim; binary content is omitted | [classification fixtures](../../packages/scanner/test/classify-file.test.ts), [parser availability fixtures](../../tests/analysis/parser-availability.test.ts) |

Malformed syntax returns safe partial facts and bounded diagnostics. An absent,
crashed, timed-out, oversized, or unsupported parser preserves independent file,
Git, manifest, and configuration evidence and reports `partial` or `unsupported`;
it never executes a repository toolchain or invents missing relations.

Unsupported constructs include TypeScript type-checker semantics and transforms,
Python runtime imports and dynamic metaprogramming, Java annotation processing and
build-plugin execution, Go build-tag evaluation and code generation, and any
framework behavior requiring runtime execution. Raw ASTs are never persisted.

## Framework evidence support

Framework support means evidence-backed detection and normalized relationships,
not runtime compatibility certification.

| Ecosystem | Evidence-backed identities | Evidence |
| --- | --- | --- |
| JavaScript/TypeScript | React, Next.js, Express, Fastify, Vitest, Jest | [detector fixtures](../../packages/analysis/test/detectors.test.ts) |
| Python | FastAPI, Flask, Django | [detector fixtures](../../packages/analysis/test/detectors.test.ts) |
| Java | Spring Boot, JUnit 4 and 5 | [detector fixtures](../../packages/analysis/test/detectors.test.ts) |
| Go | Gin, standard `testing`, Testify | [detector fixtures](../../packages/analysis/test/detectors.test.ts) |

A dependency alone is `declared`; confirmation requires controlled import,
configuration, route, annotation, entry-point, test-layout, or API evidence.
Conflicting frameworks remain explicit. Lookalike filenames and unknown
identities do not create framework relations.

## Filesystem and degradation caveats

- Canonical repository-relative paths use forward slashes and preserve observed
  case and Unicode spelling. [Path fixtures](../../tests/cross-platform/path-normalization.test.ts)
- Case-only collisions, long paths, permissions, and read-only attributes remain
  host-capability dependent and produce structured diagnostics rather than
  coerced identities. [Permission fixtures](../../tests/cross-platform/permissions-locks.test.ts)
- Windows symlink creation may require Developer Mode or equivalent privilege;
  unavailable capability skips creation but never skips escape protection.
  [Compatibility fixtures](../../tests/cross-platform/compatibility.test.ts)
- Watcher event shapes vary by backend. Overflow or ambiguity requires canonical
  reconciliation; the guarantee is final-state equivalence, not event ordering.
  [Watcher fixtures](../../tests/cross-platform/watcher-semantics.test.ts)
- Cancellation may expose different native signal details while preserving exit
  code 130 and owned-resource cleanup. [Process fixtures](../../tests/cross-platform/process-cancellation.test.ts)
