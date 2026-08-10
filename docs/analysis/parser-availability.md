# Parser availability and partial results

All optional parser execution passes through a bounded failure boundary.
Missing adapters, crashes, timeouts, syntax failures, unsupported features, and
other partial results use stable non-sensitive diagnostic codes. Thrown parser
messages and repository source are never copied into diagnostics.

Independent normalized facts are merged by stable identity and survive parser
failure. Only parser-dependent output becomes incomplete. Timeouts are bounded,
diagnostics are capped, and successful parser collections are deterministically
ordered. This behavior allows secure context and pack operations to continue
with explicit partial completeness rather than fabricated success.
