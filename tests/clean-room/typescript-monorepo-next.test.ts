import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const cli = resolve("apps/cli/dist/bin.js");
let root: string;

function run(args: string[]) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    shell: false,
  });
  expect(result.stderr).not.toContain("SECRET_MONOREPO_VALUE");
  expect(result.status, result.stderr || result.stdout).toBe(0);
  return result.stdout;
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "fuzit-next-monorepo-"));
  for (const directory of [
    "apps/web/app",
    "packages/ui/src",
    "packages/private/src",
  ])
    await mkdir(join(root, directory), { recursive: true });
  await writeFile(
    join(root, "pnpm-workspace.yaml"),
    "packages:\n  - apps/*\n  - packages/*\n",
  );
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ private: true, workspaces: ["apps/*", "packages/*"] }),
  );
  await writeFile(
    join(root, "apps/web/package.json"),
    JSON.stringify({
      name: "web",
      dependencies: { "@fixture/ui": "workspace:*", next: "15.0.0" },
    }),
  );
  await writeFile(
    join(root, "apps/web/app/page.tsx"),
    'import { Button } from "@fixture/ui";\nexport default function Page() { return <Button />; }\n',
  );
  await writeFile(
    join(root, "packages/ui/package.json"),
    JSON.stringify({ name: "@fixture/ui" }),
  );
  await writeFile(
    join(root, "packages/ui/src/button.tsx"),
    "export function Button() { return <button>Safe</button>; }\n",
  );
  await writeFile(
    join(root, "packages/private/package.json"),
    JSON.stringify({ name: "@fixture/private" }),
  );
  await writeFile(
    join(root, "packages/private/src/key.ts"),
    'export const key = "SECRET_MONOREPO_VALUE";\n',
  );
  const initialized = spawnSync("git", ["init", "--quiet"], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  expect(initialized.status, initialized.stderr).toBe(0);
});

afterAll(async () => rm(root, { recursive: true, force: true }));

describe("TypeScript monorepo and Next.js App Router", () => {
  it("selects the canonical workspace root without inventing nested repositories", () => {
    const output = JSON.parse(
      run(["scan", "--root", root, "--list-roots"]),
    ) as { selectedRoot: string; nestedRoots: string[] };
    expect(output).toEqual(
      expect.objectContaining({ selectedRoot: ".", nestedRoots: [] }),
    );
  });

  it("keeps task context budgeted and within the web/UI boundary", async () => {
    const output = join(root, "context.md");
    run([
      "context",
      "--root",
      root,
      "--task",
      "fix the App Router page button",
      "--profile",
      "bug-fix",
      "--budget-tokens",
      "800",
      "--format",
      "markdown",
      "--output",
      output,
    ]);
    const context = await readFile(output, "utf8");
    expect(context).toContain("page.tsx");
    expect(context).toContain("button.tsx");
    expect(context).not.toContain("SECRET_MONOREPO_VALUE");
    expect(context.length).toBeLessThan(12_000);
  }, 20_000);

  it("processes an incremental watcher pass", () => {
    run(["watch", "--root", root, "--once"]);
  });
});
