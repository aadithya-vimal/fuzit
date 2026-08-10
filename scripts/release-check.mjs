import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function validateReleasePolicy(input) {
  const errors = [];
  if (input.changesets.length === 0) errors.push("missing changeset");
  if (new Set(input.versions).size !== 1) errors.push("version mismatch");
  if (!input.changelog.includes(input.versions[0] ?? ""))
    errors.push("changelog version missing");
  if (
    !input.schemaPolicy.includes("rebuild") &&
    !input.schemaPolicy.includes("migration")
  )
    errors.push("schema bump lacks migration/rebuild note");
  if (input.unexpectedDirty.length > 0)
    errors.push(`unexpected dirty tree: ${input.unexpectedDirty.join(", ")}`);
  return errors;
}

export function findUnexpectedDirty(dirty, changed, preserved = []) {
  const allowed = new Set([...changed, ...preserved]);
  return dirty.filter((path) => !allowed.has(path));
}

export async function checkRepository(root = resolve(".")) {
  const packagePaths = [
    "apps/cli",
    ...(await readdir(resolve(root, "packages"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name !== "renderers")
      .map((entry) => `packages/${entry.name}`),
    ...(
      await readdir(resolve(root, "packages/renderers"), {
        withFileTypes: true,
      })
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => `packages/renderers/${entry.name}`),
  ];
  const versions = await Promise.all(
    packagePaths.map(
      async (path) =>
        JSON.parse(await readFile(resolve(root, path, "package.json"), "utf8"))
          .version,
    ),
  );
  const changesets = (await readdir(resolve(root, ".changeset"))).filter(
    (path) => path.endsWith(".md"),
  );
  const state = JSON.parse(
    await readFile(resolve(root, "docs/release/release-state.json"), "utf8"),
  );
  const preserved = (process.env.FUZIT_RELEASE_PRESERVED_PATHS ?? "")
    .split(";")
    .filter(Boolean);
  const dirty = execFileSync(
    "git",
    [
      "-c",
      "core.quotepath=false",
      "status",
      "--porcelain",
      "--untracked-files=all",
    ],
    { cwd: root, encoding: "utf8" },
  )
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => line.slice(3).replaceAll("\\", "/"));
  const errors = validateReleasePolicy({
    changesets,
    versions,
    changelog: await readFile(resolve(root, "CHANGELOG.md"), "utf8"),
    schemaPolicy: await readFile(
      resolve(root, "docs/release/schema-compatibility.md"),
      "utf8",
    ),
    unexpectedDirty: findUnexpectedDirty(dirty, [], preserved),
  });
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    versions: [...new Set(versions)],
    changesets: changesets.length,
    dirtyPaths: dirty.length,
    schemas: state.persistentSchemaVersions,
  };
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  process.stdout.write(`${JSON.stringify(await checkRepository())}\n`);
}
