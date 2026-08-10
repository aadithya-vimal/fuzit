import { createHash } from "node:crypto";

export interface IndexIdentitySet {
  readonly effectiveConfiguration: string;
  readonly ignorePolicy: string;
  readonly securityPolicy: string;
  readonly parser: string;
  readonly analysis: string;
  readonly graph: string;
  readonly schema: string;
}

export interface IndexIdentityInput {
  readonly effectiveConfiguration: unknown;
  readonly ignorePolicy: unknown;
  readonly securityPolicy: unknown;
  readonly parser: unknown;
  readonly analysis: unknown;
  readonly graph: unknown;
  readonly schema: unknown;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function identity(domain: keyof IndexIdentitySet, value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value));
  if (serialized === undefined) {
    throw new Error(`Cannot create ${domain} identity from undefined input.`);
  }
  return `sha256:${createHash("sha256")
    .update(`fuzit-index:${domain}\0${serialized}`, "utf8")
    .digest("hex")}`;
}

export function createIndexIdentitySet(
  input: IndexIdentityInput,
): IndexIdentitySet {
  return {
    effectiveConfiguration: identity(
      "effectiveConfiguration",
      input.effectiveConfiguration,
    ),
    ignorePolicy: identity("ignorePolicy", input.ignorePolicy),
    securityPolicy: identity("securityPolicy", input.securityPolicy),
    parser: identity("parser", input.parser),
    analysis: identity("analysis", input.analysis),
    graph: identity("graph", input.graph),
    schema: identity("schema", input.schema),
  };
}
