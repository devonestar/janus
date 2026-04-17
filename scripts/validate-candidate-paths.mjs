#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const backend = process.argv[2] ?? 'mock';

if (backend !== 'mock' && !existsSync('/usr/local/bin/claude') && !existsSync('/opt/homebrew/bin/claude') && !existsSync(`${process.env.HOME}/.local/bin/claude`)) {
  console.error(JSON.stringify({ backend, skipped: 'backend binary not found via common paths' }, null, 2));
  process.exit(0);
}

function runJson(args) {
  const result = spawnSync('node', ['dist/index.js', ...args, '--backend', backend, '--format', 'json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!result.stdout) {
    throw new Error(result.stderr || `janus produced no output for ${args.join(' ')}`);
  }

  return JSON.parse(result.stdout);
}

const thinEval = runJson(['eval', 'fixtures/candidate-path-thin.md']);
const richEval = runJson(['eval', 'fixtures/candidate-path-rich.md']);
const compareOut = runJson(['compare', 'fixtures/candidate-path-thin.md', 'fixtures/candidate-path-rich.md']);
const loopOut = runJson(['loop', 'fixtures/candidate-path-thin.md', '--max-iterations', '2']);

function summarizeCandidateQuality(output) {
  const candidatePaths = output.candidate_paths ?? [];
  const seen = new Set();
  const duplicateKeys = [];
  for (const cp of candidatePaths) {
    const key = `${cp.origin}:${cp.archetype_slug}`;
    if (seen.has(key)) duplicateKeys.push(key);
    seen.add(key);
  }

  const bestPathSlug = output.best_path?.name
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !['a', 'an', 'the', 'to', 'into', 'then'].includes(token))
    .join('-') ?? null;

  return {
    fit_summary_lengths: candidatePaths.map((cp) => cp.fit_summary.length),
    duplicate_candidate_keys: duplicateKeys,
    best_path_overlap: candidatePaths.some((cp) => cp.archetype_slug === bestPathSlug),
  };
}

const report = {
  backend,
  thin_eval: {
    candidate_paths_present: Array.isArray(thinEval.candidate_paths) && thinEval.candidate_paths.length > 0,
    candidate_paths_count: thinEval.candidate_paths?.length ?? 0,
    origins: (thinEval.candidate_paths ?? []).map((cp) => cp.origin),
    archetype_slugs: (thinEval.candidate_paths ?? []).map((cp) => cp.archetype_slug),
    quality: summarizeCandidateQuality(thinEval),
  },
  rich_eval: {
    candidate_paths_present: Array.isArray(richEval.candidate_paths) && richEval.candidate_paths.length > 0,
  },
  compare: {
    candidate_paths_present: Array.isArray(compareOut.candidate_paths) && compareOut.candidate_paths.length > 0,
  },
  loop: {
    candidate_paths_present: Array.isArray(loopOut.final_evaluation?.candidate_paths) && loopOut.final_evaluation.candidate_paths.length > 0,
  },
  pass: {
    thin_eval_present: Array.isArray(thinEval.candidate_paths) && thinEval.candidate_paths.length > 0,
    thin_eval_capped: (thinEval.candidate_paths?.length ?? 0) <= 3,
    thin_eval_fit_summaries_capped: (thinEval.candidate_paths ?? []).every((cp) => cp.fit_summary.length <= 180),
    thin_eval_no_duplicate_candidates: summarizeCandidateQuality(thinEval).duplicate_candidate_keys.length === 0,
    thin_eval_no_best_path_overlap: summarizeCandidateQuality(thinEval).best_path_overlap === false,
    rich_eval_suppressed: !Array.isArray(richEval.candidate_paths) || richEval.candidate_paths.length === 0,
    compare_suppressed: !Array.isArray(compareOut.candidate_paths) || compareOut.candidate_paths.length === 0,
    loop_suppressed: !Array.isArray(loopOut.final_evaluation?.candidate_paths) || loopOut.final_evaluation.candidate_paths.length === 0,
  }
};

console.log(JSON.stringify(report, null, 2));
