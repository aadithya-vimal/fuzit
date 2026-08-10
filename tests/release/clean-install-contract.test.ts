import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const scriptPath = resolve(
  import.meta.dirname,
  "../../scripts/package-smoke.mjs",
);

describe("clean CLI installation contract", () => {
  it("exercises every V1-133 command through the installed CLI", async () => {
    const source = await readFile(scriptPath, "utf8");
    for (const command of [
      '"--help"',
      '"--version"',
      '"doctor"',
      '"scan"',
      '"pack"',
      '"context"',
      '"watch"',
      '"graph"',
      '"snapshot"',
      '"diff"',
      '"plugin"',
      '"validate"',
    ]) {
      expect(source).toContain(command);
    }
    expect(source).toContain("shell: false");
    expect(source).toContain('"--offline"');
  });

  it("tests the invalid plugin partial-result path", async () => {
    const source = await readFile(scriptPath, "utf8");
    expect(source).toContain("acceptedStatuses: [2]");
    expect(source).toContain('await writeFile(invalidPlugin, "{}\\n")');
  });

  it("starts the packaged MCP server after V1-134", async () => {
    const source = await readFile(scriptPath, "utf8");
    expect(source).toContain('"mcp-server"');
    expect(source).toContain('method: "initialize"');
    expect(source).toContain('method: "tools/list"');
    expect(source).toContain("shell: false");
  });

  it("compiles a reference plugin against only the packaged SDK export", async () => {
    const source = await readFile(scriptPath, "utf8");
    expect(source).toContain('from "@fuzit/plugin-sdk"');
    expect(source).toContain('"@fuzit/plugin-sdk/extension-points"');
    expect(source).toContain('forbidden of ["plugin-host", "testing"');
    expect(source).toContain("acceptedStatuses: [2]");
  });
});
