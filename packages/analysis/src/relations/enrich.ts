import { createHash } from "node:crypto";
import {
  parseNormalizedAnalysis,
  type AnalysisEvidenceBasis,
  type AnalysisRelationship,
  type NormalizedAnalysis,
} from "@fuzit/schemas";

export type CrossLanguageRelationKind =
  "test" | "endpoint" | "schema" | "configuration-link";

export interface CrossLanguageRelationCandidate {
  readonly kind: CrossLanguageRelationKind;
  readonly sourceSymbolId: string;
  readonly targetId?: string | null;
  readonly unresolvedTarget?: string | null;
  readonly basis: AnalysisEvidenceBasis;
  readonly originIdentity: string;
  readonly frameworkIdentity?: string | null;
  readonly confidence: number;
}

const relationshipId = (identity: string) =>
  `analysis:relation:${createHash("sha256").update(identity).digest("hex")}`;

export function enrichCrossLanguageRelations(
  analysis: NormalizedAnalysis,
  candidates: readonly CrossLanguageRelationCandidate[],
): NormalizedAnalysis {
  const symbols = new Map(
    analysis.symbols.map((symbol) => [symbol.id, symbol]),
  );
  const validIds = new Set([
    ...analysis.files.map(({ id }) => id),
    ...analysis.modules.map(({ id }) => id),
    ...analysis.symbols.map(({ id }) => id),
  ]);
  const diagnostics = [...analysis.diagnostics];
  const accepted = candidates
    .filter((candidate) => {
      if (!symbols.has(candidate.sourceSymbolId)) {
        diagnostics.push("ANALYSIS_RELATION_SKIPPED: unknown source symbol");
        return false;
      }
      if (
        (candidate.kind === "endpoint" || candidate.kind === "schema") &&
        !candidate.frameworkIdentity
      ) {
        diagnostics.push(
          `ANALYSIS_RELATION_SKIPPED: ${candidate.kind} candidate lacks framework evidence`,
        );
        return false;
      }
      if (candidate.targetId && !validIds.has(candidate.targetId)) {
        diagnostics.push("ANALYSIS_RELATION_SKIPPED: unknown target identity");
        return false;
      }
      return true;
    })
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  const groups = new Map<string, Set<string>>();
  for (const candidate of accepted) {
    const key = `${candidate.kind}\0${candidate.sourceSymbolId}`;
    const targets = groups.get(key) ?? new Set<string>();
    targets.add(
      candidate.targetId ?? candidate.unresolvedTarget ?? "<unresolved>",
    );
    groups.set(key, targets);
  }
  const relationships: AnalysisRelationship[] = accepted.map((candidate) => {
    const source = symbols.get(candidate.sourceSymbolId)!;
    const ambiguous =
      (groups.get(`${candidate.kind}\0${candidate.sourceSymbolId}`)?.size ??
        0) > 1;
    const targetId = candidate.targetId ?? null;
    return {
      id: relationshipId(
        `${analysis.repositoryId}\0${candidate.kind}\0${candidate.sourceSymbolId}\0${targetId ?? candidate.unresolvedTarget}\0${candidate.originIdentity}`,
      ),
      repositoryId: analysis.repositoryId,
      kind: candidate.kind,
      sourceId: candidate.sourceSymbolId,
      targetId,
      unresolvedTarget: targetId
        ? null
        : (candidate.unresolvedTarget ?? "<unresolved>"),
      provenance: {
        sourceFileId: source.fileId,
        sourceSymbolId: source.id,
        range: source.range,
        basis: candidate.basis,
        parserIdentity: candidate.originIdentity,
        analysisIdentity: analysis.analysisIdentity,
        confidence: ambiguous
          ? Math.min(candidate.confidence, 0.5)
          : candidate.confidence,
        resolution: ambiguous
          ? "ambiguous"
          : targetId
            ? "resolved"
            : "unresolved",
      },
    };
  });
  return parseNormalizedAnalysis({
    ...analysis,
    relationships: [...analysis.relationships, ...relationships].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
    diagnostics: diagnostics.slice(0, 128),
    completeness:
      diagnostics.length > analysis.diagnostics.length &&
      analysis.completeness === "complete"
        ? "partial"
        : analysis.completeness,
  });
}
