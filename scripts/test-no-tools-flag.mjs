#!/usr/bin/env node
/**
 * Verifies that the Claude backend passes --tools "" to prevent
 * recursive tool invocation (e.g. Claude CLI calling `janus eval` via Bash).
 *
 * This is a structural test — it reads the built dist file and checks
 * that the spawn args include the --tools flag with an empty string.
 * No LLM call required.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const claudeBackendPath = resolve(__dirname, "../dist/backend/claude.js");

const source = readFileSync(claudeBackendPath, "utf8");

// The built JS should contain "--tools", "" as consecutive args in the spawn call
const hasToolsFlag = source.includes('"--tools"') && source.includes('"--tools", ""');

if (!hasToolsFlag) {
  process.stderr.write(
    "FAIL: Claude backend missing --tools \"\" flag.\n" +
    "This flag prevents the Claude CLI from using tools (Bash, Edit, etc.),\n" +
    "which would cause recursive janus invocations.\n"
  );
  process.exit(1);
}

process.stdout.write("PASS: Claude backend includes --tools \"\" flag (no-tool-recursion guard)\n");
