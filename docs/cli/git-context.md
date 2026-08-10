# Git context in bundles

`fuzit pack --git current|history|diff` adds explicit local Git identity and
working-change metadata. `history` adds bounded history; `diff` adds a bounded,
secret-filtered patch. Git context is opt-in and non-Git directories retain the
same bundle behavior with unavailable evidence.
