#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { basename, resolve } from 'node:path';

const file = process.argv[2];
const backend = process.argv[3] ?? 'mock';

if (!file) {
  process.stderr.write('usage: node scripts/self-dev.mjs <spec-file> [backend]\n');
  process.exit(2);
}

const specPath = resolve(file);
const specName = basename(specPath);

const validatorRegistry = [
  {
    match: /canonical/i,
    command: ['node', 'scripts/validate-canonical-identity.mjs', backend === 'mock' ? 'mock' : backend, '2'],
    label: 'canonical-identity validation',
  },
  {
    match: /explicit-alternatives|candidate-path/i,
    command: ['node', 'scripts/validate-candidate-paths.mjs', backend === 'mock' ? 'mock' : backend],
    label: 'candidate-path validation',
  },
];

const validator = validatorRegistry.find((entry) => entry.match.test(specName));

function runStep(label, command, args) {
  process.stdout.write(`\n=== ${label} ===\n`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0 && result.status !== 1 && result.status !== 2) {
    process.exit(result.status ?? 3);
  }
}

runStep('intake-check', 'node', ['scripts/check-intake.mjs', specPath]);
runStep('eval', 'node', ['dist/index.js', 'eval', specPath, '--backend', backend, '--format', 'markdown']);
runStep('loop', 'node', ['dist/index.js', 'loop', specPath, '--backend', backend, '--format', 'markdown', '--max-iterations', '3']);

if (validator) {
  runStep(validator.label, validator.command[0], validator.command.slice(1));
} else {
  process.stdout.write('\n=== dogfood-validation ===\nno validator configured for this spec yet\n');
}
