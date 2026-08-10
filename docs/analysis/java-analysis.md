# Bounded Java analysis

Java analysis is a deterministic, non-executing syntactic adapter. Version 1
extracts packages, imports, records, classes, interfaces, nested declarations,
methods, inheritance/implementation, tests, controller routes, and bounded
Maven/Gradle configuration relations. It does not invoke Maven, Gradle,
annotation processors, compiler plugins, class loaders, or repository code.

Unknown targets remain unresolved. Malformed brace structure produces a safe
partial diagnostic without embedding source content. Advanced Java semantics
outside this documented syntactic level are not guessed.
