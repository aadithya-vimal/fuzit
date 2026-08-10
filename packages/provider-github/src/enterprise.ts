/**
 * Enterprise host configuration and validation service.
 *
 * @module
 */

import type { GitHubHostIdentity } from "@fuzit/schemas";

export interface EnterpriseHostConfig {
  readonly webHost: string;
  readonly apiBase?: string;
}

export function buildEnterpriseHostIdentity(
  config: EnterpriseHostConfig,
): GitHubHostIdentity {
  const apiHost = config.apiBase
    ? config.apiBase.replace(/^https?:\/\//, "")
    : `${config.webHost}/api/v3`;
  return {
    webHost: config.webHost,
    apiHost,
    isEnterprise: true,
  };
}
