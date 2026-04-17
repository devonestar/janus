import type { JanusBackend } from "./interface.js";
import type { EvaluationRequest, EvaluationResponse, BackendConfig } from "../types.js";
import { analyzeDocumentStructure } from "../document-structure.js";

export class MockBackend implements JanusBackend {
  readonly name = "mock";

  constructor(_config: BackendConfig) {}

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
    const doc = request.document;
    const structure = analyzeDocumentStructure(doc);

    const hasGoals = /goal|objective|purpose|aim/i.test(doc);
    const hasConstraints = /constraint|deadline|budget|limit|team size/i.test(doc);
    const hasNfrs = /performance|security|reliability|observability|scalab/i.test(doc);
    const hasOptions = /option [a-z]|alternative|approach [a-z]|## option/i.test(doc);
    const hasAssumptions = /assum/i.test(doc);

    const missingFields: string[] = [];
    if (!hasGoals) missingFields.push("goals");
    if (!hasConstraints) missingFields.push("constraints");
    if (!hasNfrs) missingFields.push("nfrs");

    if (missingFields.includes("goals")) {
      return {
        raw: "",
        parsed: {
          decision_status: "blocked",
          best_path: null,
          rejected_paths: [],
          critical_unknowns: [
            {
              id: "U-1",
              description: "Goals are missing or not identifiable in the document",
              impact: "Cannot evaluate paths without knowing what success looks like",
              question_for_human: "What outcome is this plan trying to achieve?",
              source: "missing_field",
            },
          ],
          assumptions: [],
          information_quality: "insufficient",
          next_actions: [
            {
              priority: "critical",
              action: "Define explicit goals before evaluation can proceed",
              addresses: "U-1",
            },
          ],
        },
        error: null,
      };
    }

    const unknowns = missingFields.map((field, i) => ({
      id: `U-${i + 1}`,
      description: `${field} are missing from the document`,
      impact: `Evaluation confidence is degraded without explicit ${field}`,
      question_for_human: null as string | null,
      source: "missing_field" as const,
    }));

    const assumptions = [
      {
        id: "A-1",
        statement: "The document represents the complete current state of planning",
        origin: "inferred" as const,
        validated: false,
        risk_if_wrong: "Evaluation may miss constraints or options not documented here",
      },
    ];

    if (!hasAssumptions) {
      assumptions.push({
        id: "A-2",
        statement: "No explicit assumptions were stated; implicit assumptions may exist",
        origin: "inferred" as const,
        validated: false,
        risk_if_wrong: "Unvalidated assumptions could invalidate the recommended path",
      });
    }

    const infoQuality = missingFields.length === 0
      ? "sufficient" as const
      : missingFields.length <= 1
        ? "degraded" as const
        : "insufficient" as const;

    const status = infoQuality === "insufficient"
      ? "blocked" as const
      : infoQuality === "degraded"
        ? "conditional" as const
        : "recommend" as const;

    if (status === "blocked") {
      return {
        raw: "",
        parsed: {
          decision_status: "blocked",
          best_path: null,
          rejected_paths: [],
          critical_unknowns: unknowns.map((u) => ({ ...u, question_for_human: `What are the ${u.description.split(" ")[0]} for this project?` })),
          assumptions,
          information_quality: infoQuality,
          next_actions: unknowns.map((u) => ({
            priority: "critical" as const,
            action: `Add explicit ${u.description.split(" ")[0]} to the document`,
            addresses: u.id,
          })),
        },
        error: null,
      };
    }

    const rejectedPaths = hasOptions
      ? [
          {
            name: "Option with highest ambition",
            rejection_reason: "Depends on multiple unvalidated assumptions and irreversible early decisions under uncertainty",
            violated_principle: "P3",
            archetype_slug: "option-highest-ambition",
            could_recover: true,
            recovery_condition: "Validate key assumptions and confirm resource availability",
          },
        ]
      : [];

    return {
      raw: "",
      parsed: {
        decision_status: status,
        best_path: {
          name: hasOptions ? "Most conservative viable option" : "Default path (single option)",
          rationale: "This path survives under current evidence with fewer unvalidated dependencies than alternatives",
          enabling_conditions: [
            "Stated constraints remain accurate",
            ...(hasNfrs ? [] : ["NFR requirements are clarified before implementation"]),
          ],
          fragility_warnings: [
            ...(hasAssumptions ? [] : ["No explicit assumptions were validated"]),
            ...unknowns.map((u) => `${u.description} — could change recommendation if resolved`),
          ],
          robustness_score: unknowns.length === 0 ? "medium" : "low",
        },
        candidate_paths: structure.shouldSurfaceCandidatePaths
          ? [
              {
                name: "Bounded incremental path",
                origin: "generated" as const,
                fit_summary: "Smallest viable path that adds structure without expanding scope.",
                archetype_slug: "bounded-incremental-path",
              },
              {
                name: "Document-decomposed default path",
                origin: "decomposed" as const,
                fit_summary: "Decomposes the single stated direction into a safer staged path.",
                archetype_slug: "document-decomposed-default-path",
              },
            ]
          : undefined,
        rejected_paths: rejectedPaths,
        critical_unknowns: unknowns,
        assumptions,
        information_quality: infoQuality,
        next_actions: [
          ...unknowns.map((u) => ({
            priority: "high" as const,
            action: `Add explicit ${u.description.split(" ")[0]} to the document`,
            addresses: u.id,
          })),
          {
            priority: "medium" as const,
            action: "Validate all inferred assumptions with stakeholders",
            addresses: "A-1",
          },
        ],
      },
      error: null,
    };
  }
}
