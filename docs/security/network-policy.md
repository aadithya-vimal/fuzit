# Network and privacy policy

Fuzit CLI v1 has no allowed network capability. DNS, HTTP, raw sockets,
telemetry, update checks, remote tokenizers, cloud APIs, and remote
configuration are absent. Tests replace socket and DNS entry points with
fail-closed guards while representative context and CLI workflows run.

The observed zero-network suite covers the CLI, the explicit no-daemon local
policy, MCP, the VS Code adapter, graph and context creation, plugin permission
decisions, and a packaging dry-run. Future release-only network actions such as
an owner-authorized branch push, registry publication, or release creation are
outside product execution, require separate credentials and explicit owner
authorization, and are never enabled by a normal Fuzit command.

The privacy gate also checks human, JSON, debug/error output and Git remote
configuration for protected fixture values, credential-bearing URLs, and
machine-specific temporary paths.
