export const OUTPUT_SCHEMA_DESCRIPTION = `{
  "decision_status": "recommend | conditional | blocked",
  "best_path": {
    "name": "string — name or summary of the recommended path",
    "rationale": "string — why this path survives when others do not",
    "enabling_conditions": ["list of conditions that must hold for this path to succeed"],
    "fragility_warnings": ["risks that could degrade this path if unknowns resolve adversely"],
    "robustness_score": "low | medium | high"
  },
  "candidate_paths": [
    {
      "name": "string — candidate path name",
      "origin": "document | generated | decomposed",
      "fit_summary": "string — brief explanation of why this candidate exists",
      "archetype_slug": "string — stable candidate path identity"
    }
  ],
  "rejected_paths": [
    {
      "name": "string — name of the rejected path",
      "rejection_reason": "string — specific conflict, gap, or principle violation",
      "violated_principle": "string | null — P1 through P7",
      "archetype_slug": "string | null — stable machine-oriented path identity primitive (for example option-b)",
      "failure_chain": [
        {
          "step": "number — 1-indexed position in the causal chain",
          "event": "string — what happens at this step if this path is chosen",
          "trigger": "string — document element that drives this event (constraint ID, NFR, unknown ID, or principle)"
        }
      ],
      "comparison_basis": {
        "fragility": "lower | equal | higher — relative to best_path",
        "unknowns": "fewer | equal | more — unresolved unknowns relative to best_path",
        "nfr_coverage": "better | equal | worse — NFR satisfaction relative to best_path",
        "reversibility": "more | equal | less — ability to change course relative to best_path",
        "scope": "smaller | equal | larger — scope expansion relative to best_path"
      },
      "could_recover": "boolean — whether this path could re-enter if conditions change",
      "recovery_condition": "string | null — what would need to change"
    }
  ],
  "critical_unknowns": [
    {
      "id": "U-1",
      "description": "string — what is unknown",
      "impact": "string — how resolving this changes the recommendation",
      "question_for_human": "string | null — minimum question if escalating (only for blocked)",
      "source": "missing_field | inferred_assumption | information_asymmetry | external_dependency"
    }
  ],
  "assumptions": [
    {
      "id": "A-1",
      "statement": "string — the assumed fact",
      "origin": "explicit | inferred",
      "validated": "boolean",
      "risk_if_wrong": "string — consequence if assumption does not hold"
    }
  ],
  "information_quality": "sufficient | degraded | insufficient",
  "next_actions": [
    {
      "priority": "critical | high | medium",
      "action": "string — concrete step to improve evaluation or unblock",
      "addresses": "U-1 | A-1 | string — which unknown or assumption this addresses"
    }
  ]
}

RULES:
- best_path MUST be null when decision_status is "blocked"
- candidate_paths is optional and MUST contain at most 3 entries when present
- Every rejected_paths entry MUST have a non-empty rejection_reason
- failure_chain is optional on each rejected path; when present it MUST have 1-5 steps
- comparison_basis is optional on each rejected path; when present all 5 axes must be filled relative to best_path
- Each failure_chain step MUST reference a specific document element (constraint, NFR, unknown, or principle) in the trigger field — do NOT invent references
- failure_chain steps MUST use conditional language ("could", "if", "may") per P1
- critical_unknowns MUST include entries for any missing required input fields
- Use ONLY the enum values shown above for decision_status, information_quality, robustness_score, source
- Do NOT include any text outside the JSON object`;
