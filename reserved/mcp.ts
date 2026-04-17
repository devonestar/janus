#!/usr/bin/env node

delete process.env["CI"];

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { buildEvalRequest, buildCompareRequest } from "./prompt/builder.js";
import { createBackend } from "./backend/interface.js";
import { validateOutput, formatOutput } from "./parser/output.js";
import { runLoop } from "./loop/engine.js";
import type { BackendType } from "./types.js";

const DEFAULT_BACKEND: BackendType = "codex";
const DEFAULT_MODEL = "gpt-5.4";
const CLI_BACKENDS = new Set(["codex", "claude", "opencode"]);

const server = new McpServer({
  name: "janus",
  version: "0.1.0",
});

server.registerTool(
  "janus_eval",
  {
    description:
      "Evaluate a PRD/spec markdown file with Janus. Returns structured JSON with decision_status, best_path, rejected_paths, critical_unknowns, information_quality, and next_actions. Use before committing to a plan or spec.",
    inputSchema: {
      filePath: z.string().describe("Absolute path to the markdown file to evaluate"),
      backend: z
        .enum(["codex", "claude", "opencode", "openai-api", "anthropic-api", "mock"])
        .optional()
        .describe("AI backend to use; defaults to 'codex'"),
      model: z.string().optional().describe("Model override for the backend; defaults to 'gpt-5.4'"),
    },
  },
  async ({ filePath, backend, model }) => {
    const backendType = (backend ?? DEFAULT_BACKEND) as BackendType;
    const b = createBackend({ type: backendType, model: model ?? DEFAULT_MODEL });

    if (!(await b.isAvailable())) {
      return {
        isError: true,
        content: [{ type: "text", text: `Backend "${backendType}" is not available on this system.` }],
      };
    }

    const useCompact = CLI_BACKENDS.has(backendType);
    const request = await buildEvalRequest(filePath, useCompact);
    const response = await b.evaluate(request);

    if (!response.parsed) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Evaluation error: ${response.error ?? "Unknown error"}\n${response.raw?.slice(0, 400) ?? ""}`,
          },
        ],
      };
    }

    validateOutput(response.parsed);

    return {
      content: [{ type: "text", text: formatOutput(response.parsed, "markdown") }],
      structuredContent: response.parsed as unknown as { [x: string]: unknown },
    };
  }
);

server.registerTool(
  "janus_compare",
  {
    description:
      "Compare two option/plan documents with Janus and return the more robust one. Use when deciding between two designs or proposals.",
    inputSchema: {
      fileA: z.string().describe("Absolute path to Option A markdown file"),
      fileB: z.string().describe("Absolute path to Option B markdown file"),
      backend: z
        .enum(["codex", "claude", "opencode", "openai-api", "anthropic-api", "mock"])
        .optional(),
      model: z.string().optional(),
    },
  },
  async ({ fileA, fileB, backend, model }) => {
    const backendType = (backend ?? DEFAULT_BACKEND) as BackendType;
    const b = createBackend({ type: backendType, model: model ?? DEFAULT_MODEL });

    if (!(await b.isAvailable())) {
      return {
        isError: true,
        content: [{ type: "text", text: `Backend "${backendType}" is not available.` }],
      };
    }

    const request = await buildCompareRequest(fileA, fileB);
    const response = await b.evaluate(request);

    if (!response.parsed) {
      return {
        isError: true,
        content: [{ type: "text", text: `Compare error: ${response.error ?? "Unknown error"}` }],
      };
    }

    return {
      content: [{ type: "text", text: formatOutput(response.parsed, "markdown") }],
      structuredContent: response.parsed as unknown as { [x: string]: unknown },
    };
  }
);

server.registerTool(
  "janus_gate",
  {
    description:
      "Binary pass/fail gate check on a PRD/spec. Returns {gate: PASS|FAIL, decision_status, reason}. Use in CI pipelines or before committing to irreversible decisions.",
    inputSchema: {
      filePath: z.string().describe("Absolute path to the markdown file"),
      backend: z
        .enum(["codex", "claude", "opencode", "openai-api", "anthropic-api", "mock"])
        .optional(),
      model: z.string().optional(),
    },
  },
  async ({ filePath, backend, model }) => {
    const backendType = (backend ?? DEFAULT_BACKEND) as BackendType;
    const b = createBackend({ type: backendType, model: model ?? DEFAULT_MODEL });

    if (!(await b.isAvailable())) {
      return {
        isError: true,
        content: [{ type: "text", text: `Backend "${backendType}" is not available.` }],
      };
    }

    const useCompact = CLI_BACKENDS.has(backendType);
    const request = await buildEvalRequest(filePath, useCompact);
    const response = await b.evaluate(request);

    if (!response.parsed) {
      return {
        isError: true,
        content: [{ type: "text", text: `Gate error: ${response.error ?? "Unknown error"}` }],
      };
    }

    const out = response.parsed;
    const pass =
      out.decision_status === "recommend" &&
      out.best_path?.robustness_score !== undefined &&
      out.best_path.robustness_score !== "low";

    const result = {
      gate: pass ? "PASS" : "FAIL",
      decision_status: out.decision_status,
      robustness_score: out.best_path?.robustness_score ?? null,
      reason: pass
        ? "Decision is recommend with robustness_score medium or high"
        : out.decision_status === "blocked"
        ? "Evaluation blocked: human input required"
        : `Status=${out.decision_status}, robustness=${out.best_path?.robustness_score ?? "null"}`,
      rejected_paths: out.rejected_paths,
      critical_unknowns: out.critical_unknowns,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result as unknown as { [x: string]: unknown },
    };
  }
);

server.registerTool(
  "janus_loop",
  {
    description:
      "Run the autonomous Generate-Evaluate-Eliminate-Refine loop on a document. Returns termination reason (success, acceptable, blocked, non_convergence, max_iteration) and convergence history. Use for multi-iteration refinement of a draft.",
    inputSchema: {
      filePath: z.string().describe("Absolute path to the markdown file"),
      maxIterations: z.number().int().min(1).max(5).optional().describe("Max loop iterations (1-5); default 5"),
      backend: z
        .enum(["codex", "claude", "opencode", "openai-api", "anthropic-api", "mock"])
        .optional(),
      model: z.string().optional(),
    },
  },
  async ({ filePath, maxIterations, backend, model }) => {
    const backendType = (backend ?? DEFAULT_BACKEND) as BackendType;
    const b = createBackend({ type: backendType, model: model ?? DEFAULT_MODEL });

    if (!(await b.isAvailable())) {
      return {
        isError: true,
        content: [{ type: "text", text: `Backend "${backendType}" is not available.` }],
      };
    }

    const useCompact = CLI_BACKENDS.has(backendType);
    const result = await runLoop(filePath, {
      backend: b,
      maxIterations: maxIterations ?? 5,
      compact: useCompact,
    });

    const payload = {
      termination_reason: result.termination_reason,
      final_iteration: result.final_iteration,
      convergence_history: result.convergence_history,
      final_evaluation: result.final_evaluation,
      error: result.error,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload as unknown as { [x: string]: unknown },
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
