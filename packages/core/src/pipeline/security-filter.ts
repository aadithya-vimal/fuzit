import type { FileContextItem, SecurityFinding } from "@fuzit/schemas";
import {
  detectAndRedactCredentials,
  evaluateSensitivePath,
} from "@fuzit/security";

const filteredItems = new WeakSet<object>();
declare const securityFilteredBrand: unique symbol;

export interface SecurityFilteredItem extends FileContextItem {
  readonly findings: readonly SecurityFinding[];
  readonly [securityFilteredBrand]: true;
}

export type SecurityFilterResult =
  | {
      readonly status: "success";
      readonly item: SecurityFilteredItem;
    }
  | {
      readonly status: "omitted" | "partial";
      readonly path: string;
      readonly reason: string;
    };

export interface SecurityFilterInput {
  readonly path: string;
  readonly createItem: (
    content: string,
    findings: readonly SecurityFinding[],
  ) => FileContextItem;
  readonly readContent: () => Promise<string>;
  readonly detect?: typeof detectAndRedactCredentials;
}

export async function securityFilter(
  input: SecurityFilterInput,
): Promise<SecurityFilterResult> {
  if (evaluateSensitivePath(input.path).excluded) {
    return {
      status: "omitted",
      path: input.path,
      reason: "excluded-sensitive-path",
    };
  }

  let content: string;
  try {
    content = await input.readContent();
  } catch {
    return {
      status: "partial",
      path: input.path,
      reason: "content-read-failed",
    };
  }

  try {
    const filtered = (input.detect ?? detectAndRedactCredentials)(
      content,
      input.path,
    );
    const item = {
      ...input.createItem(filtered.content, filtered.findings),
      findings: filtered.findings,
    } as SecurityFilteredItem;
    filteredItems.add(item);
    return { status: "success", item };
  } catch {
    return {
      status: "partial",
      path: input.path,
      reason: "detector-failed-content-omitted",
    };
  }
}

export function assertSecurityFilteredItem(
  value: unknown,
): asserts value is SecurityFilteredItem {
  if (
    typeof value !== "object" ||
    value === null ||
    !filteredItems.has(value)
  ) {
    throw new TypeError("Renderer input must pass the security pipeline.");
  }
}

export function registerSecurityFilteredItem<T extends object>(item: T): T {
  filteredItems.add(item);
  return item;
}
