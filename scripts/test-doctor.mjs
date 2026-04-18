#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const doctorModule = await import(pathToFileURL(resolve(repoRoot, "dist/doctor.js")).href);

const syntheticNoProbe = {
  node_version: "20.11.0",
  node_ok: true,
  probe_enabled: false,
  available_count: 2,
  attempted_probe_count: 0,
  probe_pass_count: 0,
  ready: true,
  backends: [
    { name: "claude", available: true, probe_supported: true, probe_attempted: false, probe_status: "skipped", probe_ok: null },
    { name: "codex", available: false, hint: "Codex CLI not found.", detail: "Install: npm install -g @openai/codex", probe_supported: true, probe_attempted: false, probe_status: "skipped", probe_ok: null },
    { name: "opencode", available: true, probe_supported: false, probe_attempted: false, probe_status: "skipped", probe_ok: null },
    { name: "openai-api", available: false, hint: "OPENAI_API_KEY is not set.", detail: "Set: export OPENAI_API_KEY=sk-...", probe_supported: false, probe_attempted: false, probe_status: "skipped", probe_ok: null },
    { name: "anthropic-api", available: false, hint: "ANTHROPIC_API_KEY is not set.", detail: "Set: export ANTHROPIC_API_KEY=sk-ant-...", probe_supported: false, probe_attempted: false, probe_status: "skipped", probe_ok: null },
    { name: "mock", available: true, detail: "always available (no LLM, structural checks only)", probe_supported: false, probe_attempted: false, probe_status: "skipped", probe_ok: null, probe_skip_reason: "structural-only backend" },
  ],
};

const humanNoProbe = doctorModule.renderDoctorHuman(syntheticNoProbe);
assert.match(humanNoProbe, /2\/5 LLM backend\(s\) available\. Ready\.$/m);
assert.ok(humanNoProbe.includes("~  --backend mock  — always available (no LLM, structural checks only)"));
assert.equal(doctorModule.doctorExitCode(syntheticNoProbe), 0);
assert.equal(doctorModule.resolveDoctorFormat(undefined), "human");
assert.equal(doctorModule.resolveDoctorFormat("json"), "json");
assert.equal(doctorModule.resolveDoctorFormat("markdown"), "human");

const syntheticProbe = {
  ...syntheticNoProbe,
  probe_enabled: true,
  attempted_probe_count: 2,
  probe_pass_count: 1,
  ready: true,
  backends: syntheticNoProbe.backends.map((backend) => {
    if (backend.name === "claude") {
      return { ...backend, probe_attempted: true, probe_status: "passed", probe_ok: true, detail: "ok" };
    }
    if (backend.name === "codex") {
      return backend;
    }
    if (backend.name === "opencode") {
      return { ...backend, probe_skip_reason: "unsupported/unvalidated in this release" };
    }
    return backend;
  }),
};

const humanProbe = doctorModule.renderDoctorHuman(syntheticProbe);
assert.ok(humanProbe.includes("probe: ok"));
assert.ok(humanProbe.includes("probe: skipped (unsupported/unvalidated in this release)"));
assert.match(humanProbe, /1\/2 attempted probe\(s\) passed\. Ready\.$/m);

const failedProbe = { ...syntheticProbe, probe_pass_count: 0, ready: false };
assert.equal(doctorModule.doctorExitCode(failedProbe), 1);

// Regression guard (v0.3.1): zero LLM backends available is NOT a failure for non-probe doctor.
// doctor is diagnostic/informational; only a broken env (Node < 18) or a failed --probe should exit non-zero.
const zeroBackendReport = await doctorModule.collectDoctorReport({ probe: false });
// On CI runners with no CLIs installed and no API keys, available_count is 0.
// The tool MUST still exit 0 because mock is always available and Node is OK.
if (zeroBackendReport.node_ok) {
  assert.equal(doctorModule.doctorExitCode(zeroBackendReport), 0,
    `non-probe doctor must exit 0 when Node is OK regardless of LLM availability (available_count=${zeroBackendReport.available_count})`);
}

const raw = execFileSync("./dist/index.js", ["doctor", "--format", "json"], {
  cwd: repoRoot,
  encoding: "utf8",
});
const parsed = JSON.parse(raw);

assert.equal(typeof parsed.node_version, "string");
assert.equal(typeof parsed.node_ok, "boolean");
assert.equal(typeof parsed.probe_enabled, "boolean");
assert.equal(typeof parsed.available_count, "number");
assert.ok(Array.isArray(parsed.backends));
assert.ok(parsed.backends.some((backend) => backend.name === "opencode" && typeof backend.probe_supported === "boolean"));

process.stdout.write("PASS: doctor helpers and JSON CLI output verified\n");
