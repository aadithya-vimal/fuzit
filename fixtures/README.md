# Test Fixtures

Fixtures are small, deterministic repository inputs used to prove Fuzit
behavior without downloading or copying real external repositories.

## Taxonomy

- `minimal-empty/`: an otherwise empty repository baseline. Its `.gitkeep`
  exists only so Git can retain the directory and is not product input.
- `repository-roots/simple/`: a stable explicit path inside this repository
  used by the root-resolution CLI proof. Its `.gitkeep` is not product input.
- `traversal/basic/`: a minimal authored tree for deterministic metadata-only
  path traversal; file contents are inert and are not read by traversal.
- Future language, malformed-input, security, and scale fixtures must be added
  only by the runbook commit that requires them.

## Safety and Licensing

Fixtures must be authored for Fuzit or generated from documented deterministic
instructions. Do not copy code from an external repository unless its license,
source, attribution, and redistribution terms have been reviewed and recorded.
Downloaded copyrighted repositories are forbidden as fixtures.

Real credentials, tokens, personal data, private paths, and production output
are forbidden. Security fixtures must use clearly inert synthetic values,
remain isolated from usable credentials, and document the detector behavior
they exercise.

Generated files and volatile values must be intentional and documented.
Golden-output normalization may touch only fields explicitly declared volatile;
it must never sort meaningful collections or erase meaningful differences.
