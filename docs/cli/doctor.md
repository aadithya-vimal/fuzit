# Doctor

`fuzit doctor` performs read-only checks of the local environment. It reports:

- the active Node.js version;
- pnpm metadata available to the current process;
- Git availability and version;
- platform and architecture metadata;
- read and write access for the working directory;
- whether a Git repository can be detected; and
- whether the repository configuration is valid.
- built-in parser and local-index compatibility;
- daemon requirements; and
- optional MCP server and VS Code extension availability.

Use `fuzit doctor --json` for the versioned machine-readable report. The report
has `schemaVersion: 1`, an overall `ready` or `attention` status, and six
ordered checks. pnpm is queried with an executable and argument array when its
user-agent metadata is absent, including Windows shim environments. Human
output does not include repository or user paths.

Doctor does not install software, create configuration, modify the repository,
perform network checks, or print configuration values.
