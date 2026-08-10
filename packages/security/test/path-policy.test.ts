import { describe, expect, it } from "vitest";

import { evaluateSensitivePath } from "../src/index.js";

describe("sensitive path policy", () => {
  it.each([".env", ".env.local", "config/.env.production"])(
    "blocks environment file %s",
    (path) => {
      expect(evaluateSensitivePath(path).excluded).toBe(true);
    },
  );

  it.each(["private.pem", "server.key", "certificates/client.p12"])(
    "blocks key or certificate %s",
    (path) => {
      expect(evaluateSensitivePath(path).excluded).toBe(true);
    },
  );

  it.each(["src/environment.ts", "src/monkey.ts", "docs/pem-format.md"])(
    "allows similarly named file %s",
    (path) => {
      expect(evaluateSensitivePath(path).excluded).toBe(false);
    },
  );

  it("requires unsafe acknowledgement for an exception", () => {
    expect(
      evaluateSensitivePath(".env.example", { allow: [".env.example"] })
        .excluded,
    ).toBe(true);
    expect(
      evaluateSensitivePath(".env.example", {
        allow: [".env.example"],
        unsafeAcknowledged: true,
      }).excluded,
    ).toBe(false);
  });
});
