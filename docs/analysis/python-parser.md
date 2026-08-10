# Python parser adapter

The versioned Python adapter performs bounded, non-executing syntax validation
and emits normalized file and module/package records. It accepts ordinary and
namespace-package paths, relative imports, decorators, Unicode identifiers,
functions, classes, tests, and route syntax without importing modules or
running repository code.

Malformed input produces bounded partial diagnostics containing structural
locations rather than source text. Files larger than four MiB fail explicitly.
Normalized Python symbol and import extraction is added separately so the
adapter contract remains independent of repository-controlled Python tooling.

Normalized extraction covers functions, classes, methods, tests, model/schema
candidates, route decorators, imports, and from-imports. Aliases do not change
module identity. Known canonical modules may resolve to stable file identities;
dynamic import helpers remain explicitly unresolved with inferred provenance.
