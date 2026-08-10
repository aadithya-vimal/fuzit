export interface ScoringInput {
  readonly path: string;
  readonly explicitPaths: readonly string[];
  readonly generated: boolean;
  readonly category: "source" | "test" | "doc";
  readonly lifecycle: "active" | "deprecated" | "unknown";
  readonly trust: number;
}

export type LifecycleClass =
  | "active"
  | "generated"
  | "deprecated"
  | "legacy"
  | "experimental"
  | "vendored"
  | "test"
  | "configuration"
  | "documentation"
  | "unknown";

export interface LifecycleClassification {
  readonly lifecycle: LifecycleClass;
  readonly confidence: "high" | "medium" | "low";
  readonly evidence: readonly string[];
}

const matchesSegment = (path: string, segments: readonly string[]) =>
  path
    .replaceAll("\\", "/")
    .toLowerCase()
    .split("/")
    .some((segment) => segments.includes(segment));

/** Classifies only controlled path, annotation, and observed-activity evidence. */
export function classifyLifecycle(input: {
  readonly path: string;
  readonly generatedMarker?: boolean;
  readonly annotations?: readonly ("deprecated" | "legacy" | "experimental")[];
  readonly activityEvidence?: readonly string[];
}): LifecycleClassification {
  const path = input.path.replaceAll("\\", "/");
  const annotations = new Set(input.annotations ?? []);
  const result = (
    lifecycle: LifecycleClass,
    confidence: LifecycleClassification["confidence"],
    evidence: readonly string[],
  ): LifecycleClassification => ({ lifecycle, confidence, evidence });
  if (
    input.generatedMarker ||
    matchesSegment(path, ["generated", "dist", "build"])
  )
    return result("generated", "high", [
      input.generatedMarker ? "generated marker" : "generated path segment",
    ]);
  if (
    matchesSegment(path, ["vendor", "vendored", "third_party", "node_modules"])
  )
    return result("vendored", "high", ["vendored path segment"]);
  for (const lifecycle of ["deprecated", "legacy", "experimental"] as const)
    if (annotations.has(lifecycle))
      return result(lifecycle, "high", [`${lifecycle} annotation`]);
  if (/(^|\/)(test|tests|__tests__)(\/|$)|\.(test|spec)\.[^/]+$/i.test(path))
    return result("test", "high", ["test path convention"]);
  if (/(^|\/)(docs?|documentation)(\/|$)|\.(md|mdx|rst)$/i.test(path))
    return result("documentation", "high", ["documentation path convention"]);
  if (
    /(^|\/)(config|configuration)(\/|$)|(^|\/)[^./]+\.config\.[^/]+$/i.test(
      path,
    )
  )
    return result("configuration", "high", ["configuration path convention"]);
  if ((input.activityEvidence?.length ?? 0) > 0)
    return result("active", "medium", [...input.activityEvidence!].sort());
  return result("unknown", "low", ["no controlled lifecycle evidence"]);
}
export function scorePathLifecycle(input: ScoringInput) {
  const contributions = [
    {
      source: "explicit-path",
      value: input.explicitPaths.includes(input.path) ? 10 : 0,
      reason: "explicit task path",
    },
    {
      source: "generated",
      value: input.generated ? -4 : 0,
      reason: "generated content penalty",
    },
    {
      source: "test",
      value: input.category === "test" ? 2 : 0,
      reason: "test relevance",
    },
    {
      source: "lifecycle",
      value: input.lifecycle === "deprecated" ? -2 : 0,
      reason: `${input.lifecycle} lifecycle`,
    },
    { source: "trust", value: input.trust, reason: "source provenance trust" },
  ];
  return contributions;
}
