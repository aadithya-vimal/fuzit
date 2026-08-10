/**
 * Centralized Workspace Trust enforcement module.
 * All extension commands that read or write workspace state MUST call
 * `assertTrusted()` before any side-effectful operation.
 */

export interface TrustContext {
  readonly isTrusted: boolean;
  readonly workspaceRoot: string;
}

export interface TrustRefusal {
  readonly ok: false;
  readonly message: string;
}

export type TrustCheckResult = { ok: true } | TrustRefusal;

/**
 * Validate that a workspace context has Workspace Trust before executing any
 * command that reads or writes workspace state. Returns `{ ok: true }` when
 * safe to proceed, or a refusal with an actionable message.
 *
 * @param context - The trust context (isTrusted, workspaceRoot).
 * @param commandLabel - Human-readable label used in refusal messages.
 */
export function assertTrusted(
  context: TrustContext,
  commandLabel: string,
): TrustCheckResult {
  if (!context.isTrusted) {
    return {
      ok: false,
      message: `Workspace Trust is required to ${commandLabel}. Open the Trust dialog to allow Fuzit to operate in this workspace.`,
    };
  }
  if (!context.workspaceRoot || context.workspaceRoot.trim().length === 0) {
    return {
      ok: false,
      message: `No workspace root is available to ${commandLabel}. Open a folder in VS Code first.`,
    };
  }
  return { ok: true };
}

/**
 * Type guard — returns true when the result indicates a refusal.
 */
export function isTrustRefusal(
  result: TrustCheckResult,
): result is TrustRefusal {
  return !result.ok;
}
