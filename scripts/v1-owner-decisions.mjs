export const REQUIRED_DECISION_IDS = [
  "OD-V1-01",
  "OD-V1-02",
  "OD-V1-03",
  "OD-V1-04",
  "OD-V1-05",
];

export const REQUIRED_FIELDS = [
  "Status",
  "Current default",
  "Options",
  "Recommendation",
  "Security",
  "Compatibility",
  "Migration",
  "Legal and dependencies",
  "Approval required",
];

export function parseOwnerDecisions(markdown) {
  const sections = markdown.split(/^## /gmu).slice(1);
  const records = sections.map((section) => {
    const [heading, ...bodyLines] = section.split(/\r?\n/u);
    const headingMatch = /^(OD-V1-\d{2}) — (.+)$/u.exec(heading);
    if (!headingMatch) {
      throw new Error(`Malformed owner decision heading: ${heading}`);
    }

    const fields = new Map();
    for (const line of bodyLines) {
      const fieldMatch = /^- ([^:]+): (.+)$/u.exec(line);
      if (fieldMatch) {
        fields.set(fieldMatch[1], fieldMatch[2]);
      }
    }

    for (const field of REQUIRED_FIELDS) {
      if (!fields.has(field)) {
        throw new Error(
          `${headingMatch[1]} is missing required field: ${field}`,
        );
      }
    }

    return { id: headingMatch[1], title: headingMatch[2], fields };
  });

  const ids = records.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Owner decision IDs must be unique");
  }
  if (JSON.stringify(ids) !== JSON.stringify(REQUIRED_DECISION_IDS)) {
    throw new Error(
      "Owner decisions must use the complete deterministic ID order",
    );
  }

  return records;
}
