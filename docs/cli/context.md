# Context

`fuzit context` builds a deterministic, local task-aware context bundle. It
requires a task, built-in profile, token budget, output format, and output path.
The command MUST use the shared scanner and effective ignore configuration.
Sensitive paths are omitted before content acquisition, and detected credentials
in otherwise allowable files are redacted before scoring or rendering.

Profile weights affect scorer contributions and deterministic ranking. Detailed
safe evidence is included only with `--explain`; it records weights, component
scores, decisions, budget exclusions, and redaction state without secret values.
The default path reports a valid local index as `used`. `--no-index` MUST NOT
read, create, or update index state and falls back to the same secure direct
scan.
