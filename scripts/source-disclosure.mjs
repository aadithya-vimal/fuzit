import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const expression = (pattern) =>
  new RegExp(
    `^${pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replaceAll("**", "\u0000")
      .replaceAll("*", "[^/]*")
      .replaceAll("\u0000", ".*")}$`,
  );

export const classifyPath = (path, policy) => {
  for (const rule of policy.rules) {
    if (rule.patterns.some((pattern) => expression(pattern).test(path)))
      return rule.category;
  }
  throw new Error(`unclassified source path: ${path}`);
};

export const auditDisclosure = async (root = repositoryRoot) => {
  const policy = JSON.parse(
    await readFile(
      resolve(root, "docs/release/source-disclosure-policy.json"),
      "utf8",
    ),
  );
  const result = spawnSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0)
    throw new Error(`git ls-files failed with exit ${result.status}`);
  const counts = {
    public: 0,
    excluded: 0,
    generated: 0,
    "internal-only": 0,
    "legally-sensitive": 0,
  };
  for (const path of result.stdout.trim().split(/\r?\n/).filter(Boolean).sort())
    counts[classifyPath(path, policy)] += 1;
  for (const required of [
    "package.json",
    "pnpm-lock.yaml",
    "apps/cli/package.json",
    "docs/README.md",
    "specs/README.md",
  ]) {
    if (classifyPath(required, policy) !== "public")
      throw new Error(
        `required public build/use path is not public: ${required}`,
      );
  }
  return { schemaVersion: 1, status: policy.status, counts };
};

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.stdout.write(`${JSON.stringify(await auditDisclosure())}\n`);
}
