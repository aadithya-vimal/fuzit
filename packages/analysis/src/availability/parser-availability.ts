import {
  parseNormalizedAnalysis,
  type NormalizedAnalysis,
} from "@fuzit/schemas";

export const PARSER_AVAILABILITY_DIAGNOSTICS = Object.freeze({
  missing: "ANALYSIS_PARSER_MISSING: optional parser unavailable",
  crash: "ANALYSIS_PARSER_CRASH: parser failed safely",
  timeout: "ANALYSIS_PARSER_TIMEOUT: parser exceeded bounded duration",
  syntax: "ANALYSIS_SYNTAX_ERROR: parser returned partial syntax results",
  unsupported: "ANALYSIS_FEATURE_UNSUPPORTED: feature is not supported",
  partial: "ANALYSIS_PARTIAL_RESULT: parser returned incomplete analysis",
});

export interface SafeParserOptions {
  readonly parserIdentity: string;
  readonly timeoutMs: number;
  readonly independentAnalysis: NormalizedAnalysis;
  readonly parse?:
    (() => NormalizedAnalysis | Promise<NormalizedAnalysis>) | null;
}

function mergeById<T extends { readonly id: string }>(
  independent: readonly T[],
  parsed: readonly T[],
): T[] {
  return [
    ...new Map(
      [...independent, ...parsed].map((item) => [item.id, item]),
    ).values(),
  ].sort((left, right) => left.id.localeCompare(right.id));
}

function partial(
  independent: NormalizedAnalysis,
  diagnostic: string,
): NormalizedAnalysis {
  return parseNormalizedAnalysis({
    ...independent,
    completeness: "partial",
    diagnostics: [...independent.diagnostics, diagnostic].slice(0, 128),
  });
}

export async function runParserSafely(
  options: SafeParserOptions,
): Promise<NormalizedAnalysis> {
  if (!options.parse) {
    return partial(
      options.independentAnalysis,
      PARSER_AVAILABILITY_DIAGNOSTICS.missing,
    );
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error("bounded parser timeout")),
        options.timeoutMs,
      );
    });
    const parsed = await Promise.race([
      Promise.resolve().then(options.parse),
      timedOut,
    ]);
    if (timeout) clearTimeout(timeout);
    const syntaxPartial =
      parsed.completeness === "partial" &&
      parsed.diagnostics.some((diagnostic) =>
        /(?:SYNTAX|syntax diagnostic)/u.test(diagnostic),
      );
    return parseNormalizedAnalysis({
      ...parsed,
      files: mergeById(options.independentAnalysis.files, parsed.files),
      modules: mergeById(options.independentAnalysis.modules, parsed.modules),
      symbols: mergeById(options.independentAnalysis.symbols, parsed.symbols),
      relationships: mergeById(
        options.independentAnalysis.relationships,
        parsed.relationships,
      ),
      completeness:
        options.independentAnalysis.completeness === "partial" ||
        parsed.completeness !== "complete"
          ? "partial"
          : "complete",
      diagnostics: [
        ...options.independentAnalysis.diagnostics,
        ...parsed.diagnostics,
        ...(parsed.completeness === "partial"
          ? [
              syntaxPartial
                ? PARSER_AVAILABILITY_DIAGNOSTICS.syntax
                : PARSER_AVAILABILITY_DIAGNOSTICS.partial,
            ]
          : []),
      ].slice(0, 128),
    });
  } catch (error) {
    if (timeout) clearTimeout(timeout);
    return partial(
      options.independentAnalysis,
      error instanceof Error && error.message === "bounded parser timeout"
        ? PARSER_AVAILABILITY_DIAGNOSTICS.timeout
        : PARSER_AVAILABILITY_DIAGNOSTICS.crash,
    );
  }
}

export function markUnsupportedFeature(
  analysis: NormalizedAnalysis,
): NormalizedAnalysis {
  return partial(analysis, PARSER_AVAILABILITY_DIAGNOSTICS.unsupported);
}
