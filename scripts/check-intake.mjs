#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = process.argv[2];

if (!file) {
  process.stderr.write("usage: node scripts/check-intake.mjs <markdown-file>\n");
  process.exit(2);
}

const text = readFileSync(resolve(file), "utf8");

const hasHeading = (names) => {
  const list = Array.isArray(names) ? names : [names];
  return list.some((name) => new RegExp(`^#{1,6}\\s+${name}\\s*$`, "im").test(text));
};

const checks = [
  { key: "problem_or_context", ok: hasHeading(["Problem", "Context"]) },
  { key: "goal", ok: hasHeading("Goal") },
  { key: "constraints", ok: hasHeading("Constraints") },
  { key: "options_or_planned_change", ok: hasHeading(["Options", "Planned Change"]) },
  { key: "unknowns", ok: hasHeading("Unknowns") },
  { key: "decision_requested", ok: hasHeading("Decision requested") },
];

const missing = checks.filter((c) => !c.ok).map((c) => c.key);

if (missing.length > 0) {
  process.stderr.write(`intake precheck failed: ${missing.join(", ")}\n`);
  process.exit(1);
}

process.stdout.write("intake precheck passed\n");
