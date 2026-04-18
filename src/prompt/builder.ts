import { access, readFile } from "node:fs/promises";
import { SYSTEM_PROMPT } from "./system.js";
import { COMPACT_SYSTEM_PROMPT } from "./system-compact.js";
import { OUTPUT_SCHEMA_DESCRIPTION } from "./output-schema.js";
import { DOOM_SYSTEM_PROMPT, COMPACT_DOOM_PROMPT } from "./doom.js";
import { DOOM_OUTPUT_SCHEMA } from "./doom-schema.js";
import type { EvaluationRequest } from "../types.js";
import { analyzeDocumentStructure } from "../document-structure.js";

export async function buildEvalRequest(filePath: string, compact = false, includeCandidatePaths = false): Promise<EvaluationRequest> {
  const document = await readFile(filePath, "utf-8");

  if (document.trim().length === 0) {
    throw new Error(`Input file is empty: ${filePath}`);
  }

  const structure = analyzeDocumentStructure(document);
  const candidatePathsInstruction = includeCandidatePaths && structure.shouldSurfaceCandidatePaths
    ? `\n\n## Explicit Alternatives Rule\nThis document is structurally thin (named_options_count=${structure.namedOptionsCount}). Surface up to 3 candidate_paths. Use only origin values document | generated | decomposed. Mark generated/decomposed candidates explicitly. Do not emit candidate_paths if decision_status would be blocked.`
    : `\n\n## Explicit Alternatives Rule\nDo not emit candidate_paths for this evaluation.`;

  return {
    document,
    systemPrompt: (compact ? COMPACT_SYSTEM_PROMPT : SYSTEM_PROMPT) + candidatePathsInstruction,
    outputSchema: OUTPUT_SCHEMA_DESCRIPTION,
  };
}

export async function buildCompareRequest(
  fileA: string,
  fileB: string
): Promise<EvaluationRequest> {
  const [docA, docB] = await Promise.all([
    readFile(fileA, "utf-8"),
    readFile(fileB, "utf-8"),
  ]);

  const combined = [
    "## Option A\n",
    docA,
    "\n\n---\n\n## Option B\n",
    docB,
  ].join("\n");

  return {
    document: combined,
    systemPrompt: SYSTEM_PROMPT,
    outputSchema: OUTPUT_SCHEMA_DESCRIPTION,
  };
}

export async function buildDoomRequest(input: string, compact = false): Promise<EvaluationRequest> {
  let document = input;

  try {
    await access(input);
    document = await readFile(input, "utf-8");
  } catch {
    document = input;
  }

  if (document.trim().length === 0) {
    throw new Error("Doom input is empty");
  }

  return {
    document,
    systemPrompt: compact ? COMPACT_DOOM_PROMPT : DOOM_SYSTEM_PROMPT,
    outputSchema: DOOM_OUTPUT_SCHEMA,
  };
}
