import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readTextContent } from "../src/index.js";

const roots: string[] = [];
async function file(bytes: Uint8Array) {
  const root = await mkdtemp(join(tmpdir(), "fuzit-content-"));
  roots.push(root);
  const path = join(root, "file");
  await writeFile(path, bytes);
  return path;
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((x) => rm(x, { recursive: true, force: true })),
  );
});
describe("bounded text content", () => {
  it("reads UTF-8", async () =>
    expect(
      readTextContent(await file(Buffer.from("hello"))),
    ).resolves.toMatchObject({ encoding: "utf-8", content: "hello" }));
  it("removes a UTF-8 BOM", async () =>
    expect(
      readTextContent(await file(Buffer.from([0xef, 0xbb, 0xbf, 0x61]))),
    ).resolves.toMatchObject({ content: "a" }));
  it("reads UTF-16", async () =>
    expect(
      readTextContent(await file(Buffer.from([0xff, 0xfe, 0x61, 0]))),
    ).resolves.toMatchObject({ encoding: "utf-16le", content: "a" }));
  it("omits invalid encoding", async () =>
    expect(
      readTextContent(await file(Buffer.from([0xc3, 0x28]))),
    ).resolves.toMatchObject({
      status: "omitted",
      encoding: "invalid",
      content: null,
    }));
  it("truncates large text", async () =>
    expect(
      readTextContent(await file(Buffer.from("abcdef")), { maximumBytes: 3 }),
    ).resolves.toMatchObject({
      status: "truncated",
      content: "abc",
      truncated: true,
    }));
  it("reports file changes during read", async () => {
    const path = await file(Buffer.from("before"));
    const result = await readTextContent(path);
    expect(["complete", "changed"]).toContain(result.status);
  });
  it("honors cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      readTextContent(await file(Buffer.from("x")), {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
