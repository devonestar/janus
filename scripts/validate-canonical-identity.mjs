#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const backends = (process.argv[2] ? process.argv[2].split(',') : ['mock']).filter(Boolean);
const iterations = Number(process.argv[3] ?? '3');
const fixtures = [
  'fixtures/canonical-identity-stability.md',
  'fixtures/canonical-identity-weak-options.md',
];

function runEval(backend, fixture) {
  const result = spawnSync('node', ['dist/index.js', 'eval', fixture, '--backend', backend, '--format', 'json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!result.stdout) {
    throw new Error(result.stderr || `janus produced no output for ${fixture}`);
  }

  return JSON.parse(result.stdout);
}

const report = { iterations, backends: {} };

function summarizePathStability(runs) {
  const byArchetype = new Map();

  for (const run of runs) {
    for (const rp of run.rejected_paths) {
      const key = rp.archetype_slug ?? 'null';
      const current = byArchetype.get(key) ?? {
        archetype_slug: rp.archetype_slug ?? null,
        principles: new Set(),
        names: new Set(),
        canonical_keys: new Set(),
      };
      current.principles.add(rp.violated_principle ?? 'null');
      current.names.add(rp.name);
      current.canonical_keys.add(rp.canonical_key ?? 'null');
      byArchetype.set(key, current);
    }
  }

  return Array.from(byArchetype.values()).map((entry) => ({
    archetype_slug: entry.archetype_slug,
    principle_set: Array.from(entry.principles).sort(),
    principle_stable: entry.principles.size === 1,
    canonical_key_set: Array.from(entry.canonical_keys).sort(),
    display_name_set: Array.from(entry.names).sort(),
  }));
}

for (const backend of backends) {
  if (backend !== 'mock' && !existsSync('/usr/local/bin/claude') && !existsSync('/opt/homebrew/bin/claude') && !existsSync(`${process.env.HOME}/.local/bin/claude`)) {
    report.backends[backend] = { skipped: 'backend binary not found via common paths' };
    continue;
  }

  const backendResult = { fixtures: {} };
  for (const fixture of fixtures) {
    const runs = [];
    for (let i = 0; i < iterations; i++) {
      const out = runEval(backend, fixture);
      runs.push({
        decision_status: out.decision_status,
        best_path: out.best_path?.name ?? null,
        rejected_paths: (out.rejected_paths ?? []).map((rp) => ({
          name: rp.name,
          violated_principle: rp.violated_principle,
          archetype_slug: rp.archetype_slug ?? null,
          canonical_key: rp.canonical_key ?? null,
        })),
      });
    }

    const keySets = runs.map((run) => run.rejected_paths.map((rp) => rp.canonical_key).sort().join('|'));
    const principleSets = runs.map((run) => run.rejected_paths.map((rp) => `${rp.name}=>${rp.violated_principle}`).sort().join('|'));
    const inRunDuplicates = runs.map((run) => {
      const seen = new Set();
      const dupes = [];
      for (const rp of run.rejected_paths) {
        if (rp.canonical_key && seen.has(rp.canonical_key)) dupes.push(rp.canonical_key);
        if (rp.canonical_key) seen.add(rp.canonical_key);
      }
      return dupes;
    });

    backendResult.fixtures[fixture] = {
      runs,
      canonical_key_set_count: new Set(keySets).size,
      principle_assignment_set_count: new Set(principleSets).size,
      duplicate_keys_within_run: inRunDuplicates,
      path_stability: summarizePathStability(runs),
    };
  }
  report.backends[backend] = backendResult;
}

console.log(JSON.stringify(report, null, 2));
