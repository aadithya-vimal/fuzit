# Fuzit V1 manual publication runbook

Release identity: version `0.0.1`, tag `v0.0.1`, branch `v1-completion`.
GitHub Actions are forbidden; every step is local and explicit.

Do not execute these steps while `public-package-dependency-closure` is open.
The three public npm artifacts must first pass a clean install without any
private internal workspace tarballs.

Use only the canonical artifacts produced under `artifacts/release/v0.0.1/`.
Verify `SHA256SUMS` before any upload.

1. Confirm the GitHub repository is ready for public disclosure, then change
   visibility in GitHub Settings → General → Danger Zone → Change repository
   visibility → Make public. Confirm the repository name when prompted.
2. Recheck registry identity without publishing:
   `npm view fuzit version`, `npm view @fuzit/mcp-server version`, and
   `npm view @fuzit/plugin-sdk version`. A new collision is a stop condition.
3. Authenticate as npm user `aadithyavimal` and complete npm 2FA. Publish the
   verified tarballs in dependency order:

   `npm publish artifacts/release/v0.0.1/fuzit-plugin-sdk-0.0.1.tgz --access public`

   `npm publish artifacts/release/v0.0.1/fuzit-mcp-server-0.0.1.tgz --access public`

   `npm publish artifacts/release/v0.0.1/fuzit-0.0.1.tgz --access public`
4. Authenticate `vsce` for publisher `fuzit`, then upload the verified VSIX:
   `pnpm exec vsce publish --packagePath artifacts/release/v0.0.1/fuzit-0.0.1.vsix --pat <owner-supplied-token>`.
5. Create and push the signed release identity locally:
   `git tag -a v0.0.1 -m "Fuzit v0.0.1" <release-commit>` then
   `git push origin v0.0.1`.
6. Create the GitHub Release from tag `v0.0.1`, attach every canonical artifact,
   `SHA256SUMS`, SBOM, artifact manifest, and release manifest. Use
   `gh release create v0.0.1 artifacts/release/v0.0.1/* --verify-tag --title "Fuzit v0.0.1" --notes-file CHANGELOG.md`.
7. Run public registry, Marketplace, repository, clean-install, CLI, MCP, and
   extension smoke verification. Record only observed results.

Native-host Linux and native macOS remain experimental and
community-validation-pending. WSL2 evidence must never be relabeled as native
Linux evidence. No formal legal/trademark clearance or registration is claimed.
