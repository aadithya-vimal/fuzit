import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("prepared contribution workflow", () => {
  it("covers terms, conduct, PR evidence, security, issues, and plugins", async () => {
    const [
      contributing,
      conduct,
      decision,
      pullRequest,
      bug,
      feature,
      plugins,
    ] = await Promise.all([
      readFile(resolve(root, "CONTRIBUTING.md"), "utf8"),
      readFile(resolve(root, "CODE_OF_CONDUCT.md"), "utf8"),
      readFile(resolve(root, "docs/decisions/CONTRIBUTION-TERMS.md"), "utf8"),
      readFile(resolve(root, ".github/PULL_REQUEST_TEMPLATE.md"), "utf8"),
      readFile(resolve(root, ".github/ISSUE_TEMPLATE/bug_report.yml"), "utf8"),
      readFile(
        resolve(root, ".github/ISSUE_TEMPLATE/feature_request.yml"),
        "utf8",
      ),
      readFile(resolve(root, "docs/integrations/plugins.md"), "utf8"),
    ]);
    expect(contributing).toMatch(/DCO|CLA/);
    expect(contributing).toContain("pnpm verify");
    expect(conduct).toContain("privacy and confidentiality");
    expect(decision).toContain("DCO-based open contributions under MIT");
    expect(contributing).toMatch(/no CLA or\s+copyright assignment/u);
    expect(pullRequest).toContain("Security and privacy");
    expect(bug).toContain("Follow SECURITY.md");
    expect(feature).toContain("Security and authority impact");
    expect(plugins).toContain("minimum authority");
    await expect(access(resolve(root, "SECURITY.md"))).resolves.toBeUndefined();
  });

  it("does not enable hosted workflows or assume public endpoints", async () => {
    const workflows = await readdir(resolve(root, ".github/workflows")).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      },
    );
    expect(workflows).toEqual([]);
    for (const path of [
      "CONTRIBUTING.md",
      "CODE_OF_CONDUCT.md",
      ".github/PULL_REQUEST_TEMPLATE.md",
      ".github/ISSUE_TEMPLATE/bug_report.yml",
      ".github/ISSUE_TEMPLATE/feature_request.yml",
    ]) {
      const source = await readFile(resolve(root, path), "utf8");
      expect(source).not.toMatch(
        /@[\w.-]+\.[A-Za-z]{2,}|\.v1-development|implementation-plan/,
      );
    }
  });
});
