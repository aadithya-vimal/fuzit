import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const READY = "PUBLIC-V1-RELEASE-READY — PUBLICATION NOT AUTHORIZED";
export const BLOCKED = "PUBLIC-V1-RELEASE-BLOCKED — PUBLICATION NOT AUTHORIZED";
export const AUTHORIZED = "PUBLIC-V1-RELEASE-READY — PUBLICATION AUTHORIZED";
export const BLOCKED_AUTHORIZED =
  "PUBLIC-V1-RELEASE-BLOCKED — PUBLICATION AUTHORIZED";

export function determineFinalVerdict({
  blockers,
  decisions,
  publicationAuthorized,
}) {
  const absent = decisions
    .filter(({ approved }) => approved !== true)
    .map(({ id }) => id)
    .sort();
  const open = [...blockers].sort();
  return {
    schemaVersion: 1,
    verdict:
      open.length === 0 && absent.length === 0
        ? publicationAuthorized
          ? AUTHORIZED
          : READY
        : publicationAuthorized
          ? BLOCKED_AUTHORIZED
          : BLOCKED,
    publicationAuthorized,
    openBlockers: open,
    absentDecisions: absent,
    publicationActionsPermitted:
      open.length === 0 &&
      absent.length === 0 &&
      publicationAuthorized === true,
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const state = JSON.parse(
    await readFile("docs/release/release-state.json", "utf8"),
  );
  const risks = JSON.parse(
    await readFile("docs/release/residual-risks.json", "utf8"),
  );
  const result = determineFinalVerdict({
    blockers: risks.risks
      .filter(
        ({ releaseBlocking, status }) => releaseBlocking && status === "open",
      )
      .map(({ id }) => id),
    decisions: state.releaseDecisions,
    publicationAuthorized: state.publicationAuthorized,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (
    ![AUTHORIZED, BLOCKED_AUTHORIZED].includes(result.verdict) ||
    result.publicationActionsPermitted !== (result.verdict === AUTHORIZED)
  )
    process.exitCode = 1;
}
