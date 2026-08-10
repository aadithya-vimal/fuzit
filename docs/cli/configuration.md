# Configuration

Fuzit loads configuration without executing code. The repository configuration
file is `fuzit.config.json` in the repository root.

The effective value of each setting is selected in this order, from lowest to
highest precedence:

1. built-in defaults;
2. repository `fuzit.config.json`;
3. approved environment variables;
4. explicit CLI overrides.

The supported repository keys are:

| Key | Type | Default |
| --- | --- | --- |
| `outputFormat` | `markdown`, `json`, `xml`, or `text` | `markdown` |
| `maxFiles` | positive integer | `120` |
| `diagnosticLevel` | `error`, `warning`, `info`, or `debug` | `info` |

Unknown keys and invalid values are rejected. The approved environment
variables are `FUZIT_OUTPUT_FORMAT`, `FUZIT_MAX_FILES`, and
`FUZIT_DIAGNOSTIC_LEVEL`. Other environment variables are ignored.

Use `fuzit config show --json` to print the effective configuration together
with the source of every value. This output never includes environment
variables other than the approved settings and never includes secret values.

Configuration outside the repository is rejected. JavaScript and TypeScript
configuration files are not loaded, and remote or plugin-provided
configuration is not supported.
