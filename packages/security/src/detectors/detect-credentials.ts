import { createHash } from "node:crypto";

import type { SecurityFinding } from "@fuzit/schemas";

export interface DetectionResult {
  readonly content: string;
  readonly findings: readonly SecurityFinding[];
}

interface Pattern {
  readonly kind: string;
  readonly expression: RegExp;
  readonly confidence: number;
}

const patterns: readonly Pattern[] = [
  {
    kind: "api-key",
    expression:
      /\b(?:api[_-]?key|access[_-]?token|token|secret)\s*[:=]\s*(?:\r?\n\s*)?["']?([A-Za-z0-9_+/=-]{12,})["']?/gi,
    confidence: 0.9,
  },
  {
    kind: "bearer-token",
    expression:
      /\b(?:authorization\s*[:=]\s*)?bearer\s+([A-Za-z0-9._~+/=-]{16,})/gi,
    confidence: 0.9,
  },
  {
    kind: "url-credential",
    expression: /\b[a-z][a-z0-9+.-]*:\/\/([^:\s/@]+):([^@\s/]+)@/gi,
    confidence: 0.95,
  },
  {
    kind: "jwt",
    expression:
      /\bey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    confidence: 0.9,
  },
  {
    kind: "private-key",
    expression:
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    confidence: 1,
  },
  {
    kind: "certificate",
    expression: /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
    confidence: 0.95,
  },
  {
    kind: "connection-string",
    expression:
      /\b(?:server|host)\s*=\s*[^;\r\n]+;[^\r\n]*\b(?:password|pwd)\s*=\s*[^;\s]+/gi,
    confidence: 0.95,
  },
];

function fingerprint(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function entropy(value: string): number {
  const counts = new Map<string, number>();
  for (const character of value)
    counts.set(character, (counts.get(character) ?? 0) + 1);
  return [...counts.values()].reduce((sum, count) => {
    const probability = count / value.length;
    return sum - probability * Math.log2(probability);
  }, 0);
}

export function detectAndRedactCredentials(
  content: string,
  path = "unknown",
): DetectionResult {
  const matches: {
    start: number;
    end: number;
    value: string;
    kind: string;
    confidence: number;
  }[] = [];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern.expression)) {
      if (match.index === undefined) continue;
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        value: match[0],
        kind: pattern.kind,
        confidence: pattern.confidence,
      });
    }
  }

  const generic = /\b[A-Za-z0-9+/=_-]{24,}\b/g;
  for (const match of content.matchAll(generic)) {
    const candidate = match[0];
    if (
      match.index !== undefined &&
      entropy(candidate) >= 4 &&
      /[A-Z]/.test(candidate) &&
      /[a-z]/.test(candidate) &&
      /\d/.test(candidate) &&
      !/^[a-f\d]+$/i.test(candidate) &&
      !matches.some(
        ({ start, end }) => match.index! >= start && match.index! < end,
      )
    ) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        value: candidate,
        kind: "high-entropy",
        confidence: 0.65,
      });
    }
  }

  matches.sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  const nonOverlapping = matches.filter(
    (match, index, all) => index === 0 || match.start >= all[index - 1]!.end,
  );
  let redacted = content;
  for (const match of [...nonOverlapping].reverse()) {
    redacted =
      redacted.slice(0, match.start) +
      `[REDACTED:${match.kind}]` +
      redacted.slice(match.end);
  }

  return {
    content: redacted,
    findings: nonOverlapping.map((match) => ({
      schemaVersion: 1,
      id: `finding:${fingerprint(`${path}:${match.start}:${match.kind}`)}`,
      kind: match.kind,
      path,
      span: { start: match.start, end: match.end },
      fingerprint: fingerprint(match.value),
      sensitivity: "restricted",
      confidence: match.confidence,
    })),
  };
}
