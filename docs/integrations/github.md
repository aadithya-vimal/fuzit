# GitHub Integration Guide

## Overview
Fuzit supports direct read-only context extraction from GitHub.com and GitHub Enterprise repositories, pull requests, issues, review comments, and check runs.

## Supported Workflows
```bash
# Context extraction from GitHub URL
fuzit context https://github.com/OWNER/REPO --task "Understand architecture"

# PR review by URL
fuzit review https://github.com/OWNER/REPO/pull/123

# PR shorthand from local clone
fuzit pr 123

# Issue context
fuzit issue https://github.com/OWNER/REPO/issues/456
```

## Security & Authentication
- Environment variables: `FUZIT_GITHUB_TOKEN` (highest priority), `GH_TOKEN` (fallback).
- Local commands perform zero network calls by default unless explicitly enriched via `--enrich-github`.
- Tokens are never persisted to disk, process arguments, or logs.
