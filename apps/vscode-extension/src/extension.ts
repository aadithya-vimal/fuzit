export interface ExtensionContextLike {
  subscriptions: { dispose(): void }[];
}

export interface ExtensionApi {
  readonly version: string;
  readonly isActivated: boolean;
}

let activated = false;
const deactivationCleanups = new Set<() => void>();

export function registerDeactivationCleanup(cleanup: () => void): {
  dispose(): void;
} {
  deactivationCleanups.add(cleanup);
  return { dispose: () => deactivationCleanups.delete(cleanup) };
}

/**
 * Activate function called when VS Code extension is activated.
 * Bound to command execution only; performs no automatic process spawning or repo scanning.
 */
export function activate(context: ExtensionContextLike): ExtensionApi {
  activated = true;

  const statusDisposable = {
    dispose() {
      // Disposable cleanup
    },
  };

  context.subscriptions.push(statusDisposable);

  return {
    version: "0.0.1",
    get isActivated() {
      return activated;
    },
  };
}

/**
 * Deactivate function called when VS Code extension is deactivated.
 */
export function deactivate(): void {
  for (const cleanup of deactivationCleanups) cleanup();
  deactivationCleanups.clear();
  activated = false;
}
