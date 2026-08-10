# Safe Git execution

Git is invoked directly with argument arrays and `shell: false`. Credential
prompts are disabled. Output, runtime, and diagnostics are bounded; control
characters and credential-bearing URLs are sanitized. Cancellation terminates
the child process. No Git remote command is used.

Local verification, packaging, privacy, acceptance, and extension-audit
processes follow the same rule. On Windows, pnpm is invoked through the exact
Corepack/npm execution path with Node instead of handing a command string to a
shell. Spaces, quotes, metacharacters, Unicode, and malicious Git or plugin
arguments therefore remain literal argument values.
