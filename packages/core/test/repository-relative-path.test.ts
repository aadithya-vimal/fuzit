import { describe, expect, it } from "vitest";

import {
  normalizeRepositoryRelativePath,
  toRepositoryRelativePath,
} from "../src/index.js";

describe("canonical repository-relative paths", () => {
  it("normalizes a Windows drive path with preserved case", () => {
    expect(
      toRepositoryRelativePath(
        "C:\\Work\\Repository",
        "C:\\Work\\Repository\\Src\\MixedCase.ts",
      ),
    ).toBe("Src/MixedCase.ts");
  });

  it("normalizes a UNC path", () => {
    expect(
      toRepositoryRelativePath(
        "\\\\Server\\Share\\Repository",
        "\\\\Server\\Share\\Repository\\packages\\cli",
      ),
    ).toBe("packages/cli");
  });

  it("normalizes a POSIX path", () => {
    expect(
      toRepositoryRelativePath(
        "/workspace/repository",
        "/workspace/repository/src/index.ts",
      ),
    ).toBe("src/index.ts");
  });

  it("removes separators and dot segments", () => {
    expect(
      normalizeRepositoryRelativePath("src\\commands/./scan/../index.ts"),
    ).toBe("src/commands/index.ts");
    expect(normalizeRepositoryRelativePath(".")).toBe(".");
  });

  it("rejects an attempted repository escape", () => {
    expect(() =>
      normalizeRepositoryRelativePath("../private.txt"),
    ).toThrowError(
      expect.objectContaining({
        code: "PATH.ESCAPE",
      }),
    );
    expect(() =>
      toRepositoryRelativePath(
        "/workspace/repository",
        "/workspace/private.txt",
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "PATH.ESCAPE",
      }),
    );
  });

  it("preserves Unicode names", () => {
    expect(normalizeRepositoryRelativePath("文档/Überblick/Δοκιμή.ts")).toBe(
      "文档/Überblick/Δοκιμή.ts",
    );
  });
});
