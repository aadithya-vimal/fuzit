import { describe, it, expect } from "vitest";
import {
  activate,
  deactivate,
} from "../../apps/vscode-extension/src/extension.js";

describe("VS Code Extension Activation", () => {
  it("activates cleanly without automatic process spawning or background scanning", () => {
    const subscriptions: { dispose(): void }[] = [];
    const context = { subscriptions };

    const api = activate(context);

    expect(api.isActivated).toBe(true);
    expect(api.version).toBe("0.0.1");
    expect(subscriptions.length).toBeGreaterThan(0);

    deactivate();
    expect(api.isActivated).toBe(false);
  });
});
