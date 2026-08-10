# Exit Codes and Output Channels

Fuzit classifies process outcomes with stable exit codes:

| Outcome | Code | Meaning |
| --- | ---: | --- |
| Success | 0 | The requested operation completed. |
| Validation | 2 | Input, arguments, or configuration were invalid. |
| Environment | 3 | A required local capability or resource was unavailable. |
| Partial result | 4 | Usable output was produced with explicit diagnostics. |
| Internal error | 70 | Fuzit encountered an unexpected defect. |
| Cancelled | 130 | The operation was cancelled. |

Human-requested data is written to stdout. Human diagnostics are written to
stderr. In `--json` mode, structured machine output—including diagnostic
envelopes—uses stdout exclusively so it can be parsed without progress or
human-formatted noise.

Non-TTY and JSON output contains no ANSI control sequences. `--quiet`
suppresses informational human diagnostics but never hides warnings or errors
from machine output. Stack traces appear only with `--debug`.

Error messages and debug stacks redact common token, key, password, and secret
patterns. Redaction is defense in depth and does not make arbitrary sensitive
input safe to print.
