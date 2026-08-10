/**
 * Top-level URL and source dispatch router.
 *
 * @module
 */

import { parseGitHubUrl } from "@fuzit/provider-github";

export type DispatchRouteTarget = "context" | "review" | "issue" | "local";

export interface DispatchRouteResult {
  readonly target: DispatchRouteTarget;
  readonly parsedSource?: unknown;
}

export function routeSourceInput(input: string): DispatchRouteResult {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const res = parseGitHubUrl(input);
    if (res.ok) {
      if (res.ref.kind === "github-pull-request")
        return { target: "review", parsedSource: res.ref };
      if (res.ref.kind === "github-issue")
        return { target: "issue", parsedSource: res.ref };
      return { target: "context", parsedSource: res.ref };
    }
  }
  return { target: "local" };
}
