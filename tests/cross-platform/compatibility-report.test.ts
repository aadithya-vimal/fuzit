import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("public compatibility evidence", () => {
  it("keeps unsupported native claims explicit after owner risk acceptance", async () => {
    const state = JSON.parse(
      await readFile(
        new URL("../../docs/release/release-state.json", import.meta.url),
        "utf8",
      ),
    ) as {
      publicationAuthorized: boolean;
      releaseBlockers: Array<{ id: string; status: string }>;
    };
    const matrix = await readFile(
      new URL("../../docs/reference/support-matrix.md", import.meta.url),
      "utf8",
    );
    expect(state.publicationAuthorized).toBe(true);
    expect(state.releaseBlockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "native-linux-host-validation",
          status: "accepted",
        }),
        expect.objectContaining({
          id: "native-macos-validation",
          status: "accepted",
        }),
      ]),
    );
    expect(matrix).toContain("Experimental; community validation pending");
    expect(matrix).toContain("not genuine native-Ubuntu release evidence");
  });
});
