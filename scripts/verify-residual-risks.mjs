import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function validateResidualRisks(register) {
  const errors = [];
  if (
    register?.schemaVersion !== 1 ||
    !Array.isArray(register?.risks) ||
    register.risks.length === 0
  )
    errors.push("risk register identity or entries missing");
  const ids = new Set();
  for (const risk of register?.risks ?? []) {
    if (!risk.id || ids.has(risk.id))
      errors.push(`invalid or duplicate risk id: ${risk.id ?? "blank"}`);
    ids.add(risk.id);
    if (
      ![
        "warning",
        "partial-result",
        "accepted-limitation",
        "performance-caveat",
        "platform-difference",
      ].includes(risk.kind)
    )
      errors.push(`${risk.id}: invalid kind`);
    if (!["low", "medium", "high", "critical"].includes(risk.severity))
      errors.push(`${risk.id}: invalid severity`);
    if (!["open", "accepted", "resolved"].includes(risk.status))
      errors.push(`${risk.id}: invalid status`);
    for (const field of [
      "mitigation",
      "owner",
      "userImpact",
      "supportBoundary",
    ])
      if (typeof risk[field] !== "string" || risk[field].trim() === "")
        errors.push(`${risk.id}: ${field} is blank`);
    if (typeof risk.releaseBlocking !== "boolean")
      errors.push(`${risk.id}: releaseBlocking must be boolean`);
    if (
      !Array.isArray(risk.evidence) ||
      risk.evidence.length === 0 ||
      risk.evidence.some(
        (entry) => typeof entry !== "string" || entry.trim() === "",
      )
    )
      errors.push(`${risk.id}: evidence is blank`);
  }
  const openBlockers = (register?.risks ?? [])
    .filter((risk) => risk.releaseBlocking && risk.status === "open")
    .map((risk) => risk.id)
    .sort();
  const expected =
    openBlockers.length === 0 ? "reviewed-ready" : "reviewed-blocked";
  if (register?.status !== expected)
    errors.push(`register status must be ${expected}`);
  if (errors.length > 0)
    throw new Error(`Residual risk register invalid:\n${errors.join("\n")}`);
  return {
    schemaVersion: 1,
    status: expected,
    riskCount: register.risks.length,
    openBlockers,
  };
}

async function main() {
  const path = resolve(process.argv[2] ?? "docs/release/residual-risks.json");
  process.stdout.write(
    `${JSON.stringify(validateResidualRisks(JSON.parse(await readFile(path, "utf8"))), null, 2)}\n`,
  );
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
