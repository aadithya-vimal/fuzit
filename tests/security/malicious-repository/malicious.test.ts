import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeRepositoryRelativePath } from "@fuzit/core";
import { loadEffectiveConfig } from "@fuzit/config";
import { runGit } from "@fuzit/git";
import { detectAndRedactCredentials } from "@fuzit/security";
import { readTextContent, resolveSymlinkSafely } from "@fuzit/scanner";

describe("malicious repository", () => {
  it("rejects path traversal", () =>
    expect(() => normalizeRepositoryRelativePath("../../outside")).toThrow());
  it("removes terminal escapes and line injection from Git output", async () => {
    const result = await runGit(
      ["-e", "process.stderr.write('\\u001b[31mEVIL\\nnext')"],
      { executable: process.execPath },
    );
    expect(result.stderr).not.toContain("\u001b");
    expect(result.stderr).not.toContain("\n");
  });
  it("redacts credential material", () => {
    const secret = ["SYNTHETIC", "TOKEN", "123456789012"].join("_");
    const result = detectAndRedactCredentials(`token=${secret}`, "fixture.txt");
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.content).not.toContain(secret);
  });
  it("does not follow a symlink escape", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-malicious-"));
    const outside = join(root, "..", `outside-${Date.now()}.txt`);
    await writeFile(outside, "outside");
    const link = join(root, "escape");
    try {
      await symlink(outside, link, "file");
      expect(
        await resolveSymlinkSafely(root, link, "escape" as never, {
          follow: true,
        }),
      ).toMatchObject({ followed: false, status: "outside-root" });
    } catch (error) {
      expect((error as NodeJS.ErrnoException).code).toMatch(/EPERM|EACCES/);
    }
  });
  it("bounds huge files and never extracts archive placeholders", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-huge-"));
    const path = join(root, "huge.txt");
    await writeFile(path, "x".repeat(10_000));
    expect(await readTextContent(path, { maximumBytes: 32 })).toMatchObject({
      bytesRead: 32,
      truncated: true,
    });
    const archive = await readTextContent(
      join(process.cwd(), "fixtures/malicious/archive.zip.placeholder"),
    );
    expect(archive.content).toContain("never be extracted");
  });
  it("rejects malformed configuration without leaking its value", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-config-abuse-"));
    const value = "private-malformed-value";
    await writeFile(
      join(root, "fuzit.config.json"),
      JSON.stringify({ maxFiles: value }),
    );
    let caught: unknown;
    try {
      await loadEffectiveConfig({ repositoryRoot: root });
    } catch (error) {
      caught = error;
    }
    expect(JSON.stringify(caught)).not.toContain(value);
  });
  it("treats deceptive names as inert text", async () => {
    expect(
      (
        await readTextContent(
          join(process.cwd(), "fixtures/malicious/deceptive-name.txt"),
        )
      ).status,
    ).toBe("complete");
  });
});
