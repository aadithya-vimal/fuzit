import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const surfaces = new Set(["npm", "repository", "docs", "vscode"]);

export function planReleaseRollback(input) {
  if (!input?.incidentId || !input?.defectiveVersion)
    throw new Error("rollback incidentId and defectiveVersion are required");
  const affected = [...new Set(input.affectedSurfaces ?? [])].sort();
  const unknown = affected.filter((surface) => !surfaces.has(surface));
  if (unknown.length > 0)
    throw new Error(`unsupported rollback surface: ${unknown.join(", ")}`);

  const steps = [
    {
      order: 1,
      owner: "release-owner",
      action: "freeze-guarded-release",
      mutation: "none",
    },
    {
      order: 2,
      owner: "security-owner",
      action: "classify-and-open-private-advisory-record",
      mutation: "internal-record-only",
    },
  ];
  if (affected.includes("npm"))
    steps.push({
      order: steps.length + 1,
      owner: "registry-owner",
      action: "deprecate-defective-version-and-select-prior-verified-package",
      mutation: "requires-separate-authorization",
    });
  if (affected.includes("vscode"))
    steps.push({
      order: steps.length + 1,
      owner: "publisher-owner",
      action: "withdraw-defective-vsix-and-restore-prior-verified-vsix",
      mutation: "requires-separate-authorization",
    });
  if (affected.includes("repository"))
    steps.push({
      order: steps.length + 1,
      owner: "repository-owner",
      action: "prepare-forward-revert-commit-without-history-rewrite",
      mutation: "local-preparation-only",
    });
  if (affected.includes("docs"))
    steps.push({
      order: steps.length + 1,
      owner: "docs-owner",
      action: "prepare-withdrawal-banner-and-compatible-version-guidance",
      mutation: "local-preparation-only",
    });
  if (input.schemaChanged === true)
    steps.push({
      order: steps.length + 1,
      owner: "data-owner",
      action: "verify-purge-and-rebuild-derived-index-with-compatible-cli",
      mutation: "derived-state-only",
    });
  steps.push({
    order: steps.length + 1,
    owner: "release-owner",
    action: "verify-replacement-and-issue-coordinated-communication",
    mutation: "requires-separate-authorization",
  });

  return {
    schemaVersion: 1,
    status: "planned",
    incidentId: input.incidentId,
    defectiveVersion: input.defectiveVersion,
    affectedSurfaces: affected,
    schemaChanged: input.schemaChanged === true,
    revokedArtifactPolicy: "deny-new-use-retain-hashes-and-advisory-evidence",
    repositoryDeletionPermitted: false,
    userConfigurationDeletionPermitted: false,
    historyRewritePermitted: false,
    publicationActions: [],
    steps,
  };
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("usage: release-rollback <incident.json>");
  const input = JSON.parse(await readFile(resolve(inputPath), "utf8"));
  process.stdout.write(`${JSON.stringify(planReleaseRollback(input))}\n`);
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await main();
}
