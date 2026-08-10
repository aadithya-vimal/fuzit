import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const patterns = [
  [
    "private-key",
    /-----BEGIN ([A-Z ]*PRIVATE KEY)-----[\s\S]{0,10000}?-----END \1-----/g,
  ],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/g],
  [
    "private-host",
    /https?:\/\/(?:localhost|127\.0\.0\.1|[^\s/]+\.(?:internal|corp|local))(?=[\s/:]|$)/gi,
  ],
];

const fingerprint = (value) =>
  createHash("sha256").update(value).digest("hex").slice(0, 16);

export const scanHistoryText = (text) => {
  const findings = [];
  for (const [category, pattern] of patterns) {
    for (const match of text.matchAll(pattern)) {
      findings.push({ category, fingerprint: fingerprint(match[0]) });
    }
  }
  return findings.sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      a.fingerprint.localeCompare(b.fingerprint),
  );
};

const scanHistoryDiff = (history) => {
  const findings = [];
  for (const match of history.matchAll(
    /^diff --git a\/(.+?) b\/(.+?)\r?\n([\s\S]*?)(?=^diff --git |$(?![\s\S]))/gm,
  )) {
    for (const finding of scanHistoryText(match[3])) {
      findings.push({ ...finding, path: match[2] });
    }
  }
  return findings;
};

const git = (root, args, input) => {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    input,
    maxBuffer: 256 * 1024 * 1024,
    shell: false,
  });
  if (result.status !== 0)
    throw new Error(`git ${args[0]} failed with exit ${result.status}`);
  return result.stdout;
};

export const auditHistory = (root = repositoryRoot) => {
  const head = git(root, ["rev-parse", "HEAD"]).trim();
  const commits = git(root, ["rev-list", "--all"])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  const history = git(root, [
    "log",
    "--all",
    "--format=commit:%H",
    "-p",
    "--no-ext-diff",
    "--text",
  ]);
  const findings = scanHistoryDiff(history);
  const objects = git(root, ["rev-list", "--objects", "--all"])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  const ids = objects.map((line) => line.split(" ", 1)[0]).join("\n");
  const sizes = git(
    root,
    ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
    `${ids}\n`,
  );
  const largeBlobs = sizes
    .trim()
    .split(/\r?\n/)
    .filter((line) => {
      const [, type, size] = line.split(" ");
      return type === "blob" && Number(size) > 5 * 1024 * 1024;
    }).length;
  const approvedFixturePaths = new Set([
    "packages/security/test/detectors.test.ts",
    "scripts/history-audit.test.mjs",
  ]);
  const approvedFixtures = findings.filter(
    ({ category, path }) =>
      category !== "private-host" && approvedFixturePaths.has(path),
  );
  const secretFindings = findings.filter(
    ({ category, path }) =>
      category !== "private-host" &&
      !(category !== "private-host" && approvedFixturePaths.has(path)),
  );
  if (secretFindings.length)
    throw new Error(
      `history audit found ${secretFindings.length} high-confidence secret finding(s)`,
    );
  return {
    schemaVersion: 1,
    tool: "fuzit-history-audit/1",
    head,
    commits: commits.length,
    highConfidenceSecrets: 0,
    approvedSecurityFixtureFindings: approvedFixtures.length,
    privateHostReferences: findings.filter(
      ({ category }) => category === "private-host",
    ).length,
    privateHostReviewPaths: [
      ...new Set(
        findings
          .filter(({ category }) => category === "private-host")
          .map(({ path }) => path),
      ),
    ].sort(),
    largeBlobs,
    fingerprints: [
      ...new Set(
        findings.map(
          ({ category, fingerprint: value }) => `${category}:${value}`,
        ),
      ),
    ].sort(),
  };
};

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.stdout.write(`${JSON.stringify(auditHistory())}\n`);
}
