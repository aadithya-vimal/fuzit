# Example Configuration

The following is an illustrative target configuration. Exact fields may be reduced during initial implementation, but semantics and safe defaults should remain.

```ts
import { defineConfig } from '@fuzit/config';

export default defineConfig({
  roots: ['.'],
  discovery: {
    respectGitignore: true,
    ignoreFiles: ['.fuzitignore'],
    include: ['src/**', 'packages/**', 'docs/**', 'package.json', 'pnpm-lock.yaml'],
    exclude: ['**/dist/**', '**/coverage/**', '**/.next/**'],
    symlinks: 'metadata-only',
    maxFileBytes: 2_000_000,
  },
  security: {
    sensitivePaths: 'exclude',
    secretDetection: 'redact',
    externalTransmission: 'deny',
    unsafeOverrides: false,
  },
  output: {
    format: 'markdown',
    directory: '.fuzit/out',
    includeManifest: true,
    volatileFields: false,
  },
  profile: 'bug-fix',
  budget: {
    maxTokens: 24_000,
    maxBytes: 500_000,
    maxFiles: 120,
    preserveTaskAnchors: true,
  },
  git: {
    enabled: true,
    recentCommits: 30,
    includeDiff: true,
    sanitizeRemotes: true,
  },
  providers: {
    github: {
      enabled: false,
      network: 'explicit',
      records: ['pull-requests', 'issues', 'checks'],
    },
  },
  runtime: {
    enabled: false,
    collectors: [],
  },
  index: {
    directory: '.fuzit/index',
    incremental: true,
    retainContent: 'hash-and-approved-text',
  },
  diagnostics: {
    level: 'info',
    redact: true,
  },
});
```

## Precedence

1. Built-in defaults.
2. Global user configuration.
3. Workspace configuration.
4. Repository configuration.
5. Environment variables.
6. Command-line arguments.

`fuzit config explain` should show the effective value, source layer, validation result, and any policy restriction. A lower-trust repository configuration must not silently enable network, shell, runtime, credential, or unsafe filesystem access.
