# Fixture Policy

Fuzit tests use minimal, deterministic, reviewable fixtures. Each fixture must
have one stated purpose and contain only the files needed for that purpose.

## Sources and Licensing

Prefer fixtures authored in this repository. A fixture derived from external
material requires recorded provenance, license compatibility, attribution, and
redistribution approval before it is committed. Do not download real
repositories merely to improve test coverage.

## Synthetic Secrets

Never place a real credential in a fixture. Detector tests must use inert,
obviously synthetic values that cannot authenticate. Store only the smallest
pattern required to exercise the detector and explain why it is safe.

## Determinism

Tests copy fixtures to operating-system temporary directories and remove those
copies after use. Tests must not modify the canonical fixture.

Golden output may normalize line endings and machine-dependent paths only in
fields the test explicitly declares volatile. Normalizers must preserve array,
map, and record ordering unless ordering is itself a documented volatile
contract. Blanket snapshot rewriting, timestamp deletion, and generic value
scrubbing are forbidden.

The `minimal-empty` fixture uses `.gitkeep` solely to retain its directory in
Git. Consumers may ignore that marker when modeling an empty repository.
