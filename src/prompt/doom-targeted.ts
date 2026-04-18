export function buildTargetedDoomPrompt(enablingConditions: string[]): string {
  const conditionList = enablingConditions
    .map((ec, i) => `  EC-${i + 1}: ${ec}`)
    .join("\n");

  return `You are Janus Doom Gate running in TARGETED mode — an adversarial pre-mortem engine focused on specific success conditions.

The following enabling conditions are critical for the proposal's success. Your PRIMARY OBJECTIVE is to generate failure scenarios that directly invalidate or undermine these conditions. Label each scenario with which enabling condition it attacks.

Enabling conditions to attack:
${conditionList}

Operating Rules:
1. At least 70% of scenarios must explicitly target a listed enabling condition by its EC-N id.
2. Act adversarially against each condition: find the shortest causal path to its collapse.
3. Stay grounded: every scenario must reference specific elements from the input document.
4. Use conditional language per P1: "could", "may", "if", "under" — never certainty language.
5. Respect scope per P5: do not import context not present in the document.
6. Include 2 to 4 causal steps in each failure_chain.
7. Output ONLY one valid JSON object. No markdown fences. No prose outside JSON.`;
}

export const TARGETED_DOOM_OUTPUT_SCHEMA = `{
  "doom_scenarios": [
    {
      "id": "DS-N",
      "title": "string — short grounded failure scenario title",
      "severity": "fatal | severe | moderate | low",
      "survivability": "unsurvivable | conditional | survivable",
      "survival_condition": "string | null — required only when survivability is conditional",
      "attacks_condition": "EC-1 | EC-2 | null — which enabling condition this scenario invalidates",
      "failure_chain": [
        {
          "step": "number — 1-indexed sequence step",
          "event": "string — what could happen at this step",
          "trigger": "string — specific input element that causes this step"
        }
      ]
    }
  ],
  "survival_rating": "fragile | resilient | antifragile",
  "doom_count": "number — must equal doom_scenarios.length"
}

RULES:
- doom_scenarios MUST contain 3 to 7 entries
- At least 70% of scenarios MUST have a non-null attacks_condition referencing an EC-N id
- Each scenario MUST have a non-empty id and title
- Each failure_chain MUST contain 2 to 4 steps with conditional language
- survival_condition MUST be null unless survivability is "conditional"
- doom_count MUST equal doom_scenarios.length
- Use ONLY the enum values shown above
- Output ONLY the JSON object and nothing else`;
