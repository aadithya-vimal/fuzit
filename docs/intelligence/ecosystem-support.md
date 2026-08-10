# Ecosystem intelligence

Repository intelligence is local, deterministic, evidence-based, and detector-versioned. Manifest scripts and build plugins are metadata only: Fuzit never executes package scripts, repository modules, Python packaging hooks, Maven, Gradle, annotation processors, or the Go toolchain.

JavaScript workspace detection supports npm, pnpm, and Yarn markers; array and object workspace declarations; canonical nested package ownership; exports and entry points; production, development, peer, and optional dependencies; and scripts as inert metadata. Malformed manifests produce partial facts, and conflicting manager markers remain explicit conflicts.

React and Next.js detection requires declared dependencies. Normalized imports confirm React use; Next.js confirmation additionally accepts package-scoped configuration, normalized Next imports, App Router layout/page entries, or Pages Router entries. Dependency-only installations remain `declared`, version hints remain manifest strings, and filename lookalikes cannot create framework facts.

Express, Fastify, and NestJS detection likewise requires declared dependencies. Normalized imports, safely extracted route/API usage, and Nest CLI metadata can confirm use and provide attributable route evidence. Unused packages remain declared, while simultaneous confirmed server frameworks remain an explicit package-scoped conflict.

Vitest and Jest require dependency evidence and are confirmed through package-scoped configuration, normalized imports, inert script metadata, safely extracted global API use, or test layout. Mixed confirmed frameworks remain explicit conflicts; test-like paths without a declared framework do not create facts.

Spring Boot and JUnit detection requires manifest dependency evidence. Spring Boot is confirmed through framework annotations, controller routes, application configuration files, or entry-point classes. JUnit detection distinguishes JUnit 4 and JUnit 5, using test imports, annotations, or test source layout for confirmation. Unused dependencies remain declared.

Go module and workspace detection supports `go.mod` and `go.work` manifests, single-line and multiline `require`, `replace`, and `use` directives, module paths, and Go versions. Unsupported build directives or build tags produce explicit `unsupported-build-tag` diagnostics. Common Go HTTP frameworks and test packages (`testing`, `testify`) require module dependency evidence and are confirmed via imports, route usage, entry points, or `_test.go` layouts.


