export const DOOM_OUTPUT_SCHEMA = `{
  "doom_scenarios": [
    {
      "id": "D-1",
      "title": "string — short grounded failure scenario title",
      "severity": "fatal | severe | moderate | low",
      "survivability": "unsurvivable | conditional | survivable",
      "survival_condition": "string | null — required only when survivability is conditional",
      "failure_chain": [
        {
          "step": "number — 1-indexed sequence step",
          "event": "string — what could happen at this step",
          "trigger": "string — specific input element that causes or anchors this step"
        }
      ]
    }
  ],
  "survival_rating": "fragile | resilient | antifragile",
  "doom_count": "number — must equal doom_scenarios.length",
  "critical_unknowns": [
    {
      "id": "U-1",
      "description": "string — missing fact exposed by the pre-mortem",
      "impact": "string — why the unknown matters to survivability",
      "question_for_human": "string | null — minimum follow-up question",
      "source": "missing_field | inferred_assumption | information_asymmetry | external_dependency"
    }
  ]
}

RULES:
- doom_scenarios MUST contain 3 to 7 entries
- Each scenario MUST have a non-empty id and title
- Each failure_chain MUST contain 2 to 4 steps
- Each failure_chain step MUST use conditional language and cite a specific input-grounded trigger
- survival_condition MUST be null unless survivability is "conditional"
- doom_count MUST equal doom_scenarios.length
- Use ONLY the enum values shown above
- Output ONLY the JSON object and nothing else`;
