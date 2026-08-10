import { describe, it, expect } from "vitest";
import { assertNoTokenInObject, resolveCredential } from "@fuzit/provider-github";

describe("GH-028: Adversarial Security & Privacy Hardening", () => {
  it("verifies token redaction against hostile secret strings in objects", () => {
    const secretToken = "ghp_adversarialSecretToken1234567890";
    const cred = resolveCredential({
      host: "github.com",
      env: { FUZIT_GITHUB_TOKEN: secretToken },
    });

    const safeDiagnostic = {
      host: cred.host,
      source: cred.source,
      authStatus: cred.isAuthenticated,
    };

    expect(() => assertNoTokenInObject(safeDiagnostic, "diagnostic")).not.toThrow();

    const leakedObj = { token: secretToken };
    expect(() => assertNoTokenInObject(leakedObj, "diagnostic")).toThrow();
  });
});
