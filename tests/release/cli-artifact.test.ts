import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createCanonicalTarGzip } from "../../scripts/build-cli-artifact.mjs";

const entries = [
  { path: "package/package.json", bytes: Buffer.from('{"private":true}\n') },
  { path: "package/dist/index.js", bytes: Buffer.from("export {};\n") },
  {
    path: "package/bin/fuzit.mjs",
    bytes: Buffer.from("#!/usr/bin/env node\n"),
  },
];

describe("private CLI artifact", () => {
  it("is byte-identical across builds and input ordering", () => {
    const first = createCanonicalTarGzip(entries);
    const second = createCanonicalTarGzip([...entries].reverse());
    expect(second).toEqual(first);
    expect(createHash("sha256").update(first).digest("hex")).toBe(
      createHash("sha256").update(second).digest("hex"),
    );
  });

  it("changes identity when canonical content changes", () => {
    const original = createCanonicalTarGzip(entries);
    const changed = createCanonicalTarGzip([
      ...entries.slice(0, 2),
      { ...entries[2], bytes: Buffer.from("#!/usr/bin/env node\nchanged\n") },
    ]);
    expect(changed).not.toEqual(original);
  });

  it("keeps canonical gzip headers independent of wall-clock time", () => {
    const bytes = createCanonicalTarGzip(entries);
    expect([...bytes.subarray(4, 8)]).toEqual([0, 0, 0, 0]);
  });

  it("rejects absolute and traversal paths", () => {
    expect(() =>
      createCanonicalTarGzip([{ path: "../secret", bytes: Buffer.from("x") }]),
    ).toThrow("unsafe artifact path");
    expect(() =>
      createCanonicalTarGzip([{ path: "C:/secret", bytes: Buffer.from("x") }]),
    ).toThrow("unsafe artifact path");
  });
});
