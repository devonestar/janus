#!/usr/bin/env node
/**
 * EC-1 A/B Experiment: Does targeted doom produce meaningfully different output than general doom?
 *
 * For each fixture:
 *   A) janus eval → extract enabling_conditions
 *      janus doom (general) → count condition-attacking scenarios
 *   B) janus doom with enabling_conditions injected as explicit attack targets
 *      → count condition-attacking scenarios
 *
 * Pass criteria: B shows >= 2x coverage lift over A on condition-attacking scenarios.
 */

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const FIXTURES = [
  "fixtures/smoke.md",
  "fixtures/candidate-path-thin.md",
  "fixtures/canonical-identity-stability.md",
];

const GENERAL_DOOM_PROMPT = `You are Janus Doom Gate — an adversarial pre-mortem engine. Your job is to read the provided document or inline proposal and imagine how it could fail before implementation begins.

You are not predicting the future with certainty. You are stress-testing the proposal using only the evidence present in the input.

Generate 3 to 7 distinct failure scenarios grounded in the input. Each scenario must describe a plausible way the proposal could fail, degrade, or become non-viable.

Rules:
1. Act adversarially: look for hidden fragility, reversibility traps, missing prerequisites, dependency failure, coordination failure, and NFR collapse.
2. Stay grounded: every scenario must reference specific elements from the input text.
3. Use conditional language per P1: say "could", "may", "if", "under", never certainty language.
4. Include 2 to 4 causal steps in each failure_chain.
5. Output ONLY one valid JSON object. No markdown fences. No prose outside JSON.

Output schema:
{
  "doom_scenarios": [
    {
      "id": "DS-N",
      "title": "short title",
      "scenario": "description",
      "severity": "fatal | severe | moderate | low",
      "survivability": "unsurvivable | conditional | survivable",
      "failure_chain": [{"step": 1, "event": "...", "trigger": "..."}],
      "survival_condition": null
    }
  ],
  "survival_rating": "fragile | resilient | antifragile",
  "doom_count": N
}`;

function buildTargetedDoomPrompt(enablingConditions) {
  const conditionList = enablingConditions
    .map((ec, i) => `  EC-${i + 1}: ${typeof ec === "string" ? ec : ec.condition ?? JSON.stringify(ec)}`)
    .join("\n");

  return `You are Janus Doom Gate — an adversarial pre-mortem engine running in TARGETED mode.

The following enabling conditions have been identified as critical success conditions for this proposal.
Your PRIMARY OBJECTIVE is to generate failure scenarios that directly invalidate or undermine these specific conditions.
Label each scenario with which enabling condition it attacks using attacks_condition: "EC-N".

Enabling conditions to attack:
${conditionList}

Rules:
1. Prioritize scenarios that directly collapse one or more of the listed enabling conditions.
2. You may include general doom scenarios, but at least 70% must explicitly target a listed enabling condition.
3. Stay grounded: every scenario must reference specific elements from the input text.
4. Use conditional language per P1: "could", "may", "if", "under".
5. Include 2 to 4 causal steps in each failure_chain.
6. Output ONLY one valid JSON object. No markdown fences. No prose outside JSON.

Output schema:
{
  "doom_scenarios": [
    {
      "id": "DS-N",
      "title": "short title",
      "scenario": "description",
      "severity": "fatal | severe | moderate | low",
      "survivability": "unsurvivable | conditional | survivable",
      "failure_chain": [{"step": 1, "event": "...", "trigger": "..."}],
      "survival_condition": null,
      "attacks_condition": "EC-1 | EC-2 | null"
    }
  ],
  "survival_rating": "fragile | resilient | antifragile",
  "doom_count": N
}`;
}

function spawnCollect(cmd, args, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      fn();
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.includes('"step_finish"') || stdout.includes('"step-finish"')) {
        settle(() => resolve(stdout));
      }
    });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      settle(() => {
        if (stdout.trim()) resolve(stdout);
        else reject(new Error(`timeout after ${timeoutMs}ms. stderr: ${stderr.slice(0, 200)}`));
      });
    }, timeoutMs);

    child.on("close", () => {
      settle(() => {
        if (stdout.trim()) resolve(stdout);
        else reject(new Error(stderr.trim() || "no output"));
      });
    });

    child.on("error", (err) => { settle(() => reject(err)); });
  });
}

function extractTextFromEvents(raw) {
  return raw.split("\n")
    .filter(l => l.trim())
    .flatMap(line => {
      try {
        const ev = JSON.parse(line);
        return ev.type === "text" && ev.part?.text ? [ev.part.text] : [];
      } catch { return []; }
    })
    .join("");
}

function parseJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function runOpencode(systemPrompt, document, tmpSuffix) {
  const fullPrompt = [
    systemPrompt,
    "\n---\n## Document\n",
    document,
    "\n\nRespond with ONLY a valid JSON object.",
  ].join("\n");

  const tmpFile = join(tmpdir(), `janus-ec1-${tmpSuffix}-${Date.now()}.md`);
  writeFileSync(tmpFile, fullPrompt, "utf-8");

  try {
    const raw = await spawnCollect("opencode", [
      "run", "--format", "json", "-f", tmpFile, "--",
      "Respond with ONLY a valid JSON object as instructed in the attached file.",
    ]);
    const text = extractTextFromEvents(raw);
    return parseJSON(text);
  } finally {
    try { unlinkSync(tmpFile); } catch (_) {}
  }
}

async function runEval(fixturePath) {
  const doc = readFileSync(fixturePath, "utf-8");
  const EVAL_PROMPT = `You are Janus — an AI evaluation gate. Read the document and extract the recommended path's enabling_conditions. Output ONLY valid JSON:
{
  "best_path": {"name": "string", "enabling_conditions": ["condition 1", "condition 2"]},
  "decision_status": "recommend | conditional | blocked"
}`;

  return runOpencode(EVAL_PROMPT, doc, "eval");
}

async function runGeneralDoom(fixturePath) {
  const doc = readFileSync(fixturePath, "utf-8");
  return runOpencode(GENERAL_DOOM_PROMPT, doc, "doom-general");
}

async function runTargetedDoom(fixturePath, enablingConditions) {
  const doc = readFileSync(fixturePath, "utf-8");
  return runOpencode(buildTargetedDoomPrompt(enablingConditions), doc, "doom-targeted");
}

function scoreConditionCoverage(doomResult, enablingConditions) {
  if (!doomResult?.doom_scenarios) return { covered: 0, total: enablingConditions.length, rate: 0 };

  const scenarios = doomResult.doom_scenarios;
  const covered = new Set();

  for (const [i, ec] of enablingConditions.entries()) {
    const ecStr = (typeof ec === "string" ? ec : ec.condition ?? JSON.stringify(ec)).toLowerCase();
    const ecId = `EC-${i + 1}`;

    for (const s of scenarios) {
      const scenarioText = JSON.stringify(s).toLowerCase();
      if (
        (s.attacks_condition && s.attacks_condition.includes(ecId)) ||
        scenarioText.includes(ecStr.slice(0, 40))
      ) {
        covered.add(i);
        break;
      }
    }
  }

  return {
    covered: covered.size,
    total: enablingConditions.length,
    rate: enablingConditions.length > 0 ? covered.size / enablingConditions.length : 0,
  };
}

async function runExperiment() {
  console.log("=== EC-1 A/B Experiment: General vs Targeted Doom ===\n");
  console.log("Pass criteria: targeted doom shows >= 2x coverage lift on enabling_conditions\n");

  const results = [];

  for (const fixturePath of FIXTURES) {
    const fullPath = join(ROOT, fixturePath);
    console.log(`\n--- Fixture: ${fixturePath} ---`);

    console.log("  [1/3] Running eval to extract enabling_conditions...");
    const evalResult = await runEval(fullPath).catch(e => { console.error("  eval error:", e.message); return null; });

    if (!evalResult?.best_path?.enabling_conditions?.length) {
      console.log("  No enabling_conditions found, skipping.");
      results.push({ fixture: fixturePath, skipped: true });
      continue;
    }

    const conditions = evalResult.best_path.enabling_conditions;
    console.log(`  Found ${conditions.length} enabling conditions.`);

    console.log("  [2/3] Running general doom...");
    const generalDoom = await runGeneralDoom(fullPath).catch(e => { console.error("  general doom error:", e.message); return null; });
    const generalScore = scoreConditionCoverage(generalDoom, conditions);

    console.log("  [3/3] Running targeted doom...");
    const targetedDoom = await runTargetedDoom(fullPath, conditions).catch(e => { console.error("  targeted doom error:", e.message); return null; });
    const targetedScore = scoreConditionCoverage(targetedDoom, conditions);

    const lift = generalScore.rate > 0 ? targetedScore.rate / generalScore.rate : (targetedScore.rate > 0 ? Infinity : 1);

    console.log(`  General  doom coverage: ${generalScore.covered}/${generalScore.total} (${(generalScore.rate * 100).toFixed(0)}%)`);
    console.log(`  Targeted doom coverage: ${targetedScore.covered}/${targetedScore.total} (${(targetedScore.rate * 100).toFixed(0)}%)`);
    console.log(`  Lift: ${lift === Infinity ? "∞" : lift.toFixed(2)}x — ${lift >= 2 ? "PASS" : lift >= 1.5 ? "MARGINAL" : "FAIL"}`);

    results.push({
      fixture: fixturePath,
      conditions: conditions.length,
      general: generalScore,
      targeted: targetedScore,
      lift,
      pass: lift >= 2,
    });
  }

  console.log("\n=== Summary ===");
  let passes = 0;
  for (const r of results) {
    if (r.skipped) { console.log(`  ${r.fixture}: SKIPPED`); continue; }
    const verdict = r.pass ? "PASS" : r.lift >= 1.5 ? "MARGINAL" : "FAIL";
    console.log(`  ${r.fixture}: lift=${r.lift === Infinity ? "∞" : r.lift.toFixed(2)}x [${verdict}]`);
    if (r.pass) passes++;
  }

  const validResults = results.filter(r => !r.skipped);
  const passRate = validResults.length > 0 ? passes / validResults.length : 0;
  console.log(`\nEC-1 gate: ${passes}/${validResults.length} fixtures passed (>= 2x lift)`);
  console.log(`EC-1 verdict: ${passRate >= 0.6 ? "PASS — harness thesis holds, proceed with Option A" : "FAIL — targeted doom not sufficiently different, revisit harness design"}`);
}

runExperiment().catch(console.error);
