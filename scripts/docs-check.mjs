import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDocsSite, publicDocPaths } from "./docs-build.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const forbidden = [
  /\.v1-development/i,
  /\.fuzit-development/i,
  /implementation-plan/i,
  /(?:[A-Z]:\\|\/Users\/|\/home\/)[^\s)]*/,
  /(?:google-analytics|googletagmanager|segment\.com|posthog|telemetry)/i,
  /<(?:script|img|link)[^>]+(?:src|href)=["']https?:\/\//i,
];

export const checkDocs = async ({ root = repositoryRoot } = {}) => {
  const navigationSource = await readFile(
    resolve(root, "docs/navigation.json"),
    "utf8",
  );
  const navigation = JSON.parse(navigationSource);
  if (
    navigation.schemaVersion !== 1 ||
    !Array.isArray(navigation.sections) ||
    navigation.sections.some(
      (section) =>
        typeof section.title !== "string" || typeof section.path !== "string",
    )
  ) {
    throw new Error("docs/navigation.json does not match schema version 1");
  }

  const paths = await publicDocPaths(root);
  const diagnostics = [];
  for (const path of paths) {
    const absolute = resolve(root, "docs", path);
    const source = await readFile(absolute, "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(source))
        diagnostics.push(`${path}: forbidden public reference`);
    }
    for (const match of source.matchAll(/```json\s*\n([\s\S]*?)```/g)) {
      try {
        JSON.parse(match[1]);
      } catch {
        diagnostics.push(`${path}: invalid JSON example`);
      }
    }
    for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1]?.split("#")[0];
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      try {
        await access(resolve(dirname(absolute), target));
      } catch {
        diagnostics.push(`${path}: broken link ${target}`);
      }
    }
  }
  if (diagnostics.length) throw new Error(diagnostics.sort().join("\n"));
  const built = await buildDocsSite({ root });
  return { pages: paths.length, output: built.output };
};

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await checkDocs();
  process.stdout.write(
    `${JSON.stringify({ pages: result.pages, status: "ok" })}\n`,
  );
}
