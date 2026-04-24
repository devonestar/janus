# Janus Adversarial Decision Harness

## Context

Janus has shipped a coherent set of plan-evaluation primitives: `eval`, `doom`, `harness`, `loop --harness`, and `enrich`. The product is strongest when it behaves as a disciplined decision gate that pressure-tests a written plan. The product is weakest when its language suggests literal future simulation or model-specific magic.

Recent internal review surfaced the underlying truth more clearly:

1. Janus does **not** literally "see the future." It produces document-grounded failure narratives, unknowns, and conditional recommendations.
2. Janus's real product advantage is not one particular model. It is the structure around the model: fixed principles, bounded outputs, explicit unknowns, and adversarial attack on fragile paths.
3. Janus currently attacks plans in a mostly flat way. Technical, product, business, operational, and execution concerns are present, but they are not made first-class in a stable model-agnostic evaluation contract.
4. If Janus is to remain useful across Claude, GPT, Codex, OpenCode, and future backends, the durable asset cannot be "best prompt for one model." The durable asset must be a **model-agnostic adversarial decision harness** with fixed lenses, fixed metrics, and fixed gate rules.

The design question is therefore not whether Janus should become a prediction engine. It should not. The design question is whether Janus should explicitly reposition itself around a stronger internal truth:

> Janus attacks a plan before reality does, using fixed adversarial lenses and structured gate contracts.

## Goal

Define Janus's next stable product identity and evaluation architecture around a single idea:

**Janus is a model-agnostic adversarial decision harness.**

Concretely, the chosen path must:

1. Preserve Janus's current strengths: P1-P7, `blocked`, explicit unknowns, rejected paths, bounded candidate paths, harness attack on enabling conditions.
2. Make output quality less dependent on model personality or prose quality.
3. Attack plans across fixed dimensions (evidence, technical, product, business, operational, execution) without turning Janus into a freeform committee.
4. Produce alternatives that are specific surviving neighbors of the current plan, not generic brainstorming.
5. Keep Janus honest: a decision gate and premortem harness, not a future simulator.

## Constraints

- C-1: Janus must remain a **gate**, not a score-only dashboard. Final output still collapses to one decision recommendation space (`recommend` / `conditional` / `blocked`).
- C-2: Any model-agnostic design must rely on fixed contracts, fixed attack forms, and system-side rules more than model-side eloquence.
- C-3: Alternatives must stay bounded (same spirit as current `candidate_paths` contract): nearest viable variants only, not open-ended ideation.
- C-4: Dimension-aware attack must remain document-grounded under P5. If a dimension lacks evidence, Janus must emit unknowns rather than invent arguments.
- C-5: Hard contradictions, missing evidence, and fatal conditions must dominate soft positives. Weighted-average optimism is forbidden.
- C-6: The public promise must stay inside what the implementation can honestly support. "Future simulator" or equivalent framing is out of bounds.
- C-7: The system must continue to work with heterogeneous backends where output style, verbosity, and reasoning habits differ.
- C-8: Single-maintainer scope still applies; the chosen direction must feel like an extension of existing `eval` + `doom` + `harness`, not a second product.

## NFRs

- The harness must use a fixed lens set, not ad hoc personas.
- Each active lens must attack using the same structure: **claim -> evidence anchor -> collapse trigger -> blast radius -> recovery route**.
- Output quality should be assessable through fixed metrics that do not depend on a specific model family.
- The minimum stable metric set should include, at a minimum:
  - evidence coverage
  - critical unknown pressure
  - fatal condition count
  - attack coverage
  - reversibility
  - execution realism
  - alternative survival
- A missing or weakly grounded dimension must degrade confidence or emit `critical_unknowns`; it must not silently disappear.
- Public recommendation logic must remain auditable: operators should be able to tell why a path was blocked or downgraded.
- The system must prefer deterministic collapse rules over vague multi-lens averaging.

## Options

### Option A — Keep Janus as a general AI evaluator with stronger branding only

Leave the core evaluation model mostly as-is. Keep `eval`, `doom`, `harness`, and `enrich` conceptually separate. Update language to be more adversarial and outcome-oriented, but do not elevate a fixed lens matrix or fixed metric contract to first-class status.

- Lowest conceptual disruption
- Keeps current flexibility and lighter prompt burden
- Risk: model quality still drives result quality more than system structure
- Risk: Janus remains vulnerable to "smart prose in JSON clothing"

### Option B — Make Janus a fixed-lens adversarial decision harness

Define Janus around a stable attack matrix:

- Evidence
- Technical
- Product
- Business
- Operational
- Execution

Each lens attacks the plan's enabling conditions using the same attack form. Lens outputs collapse into the existing Janus contract: rejected paths, critical unknowns, fragility warnings, recovery conditions, and bounded candidate paths. `harness` becomes the clearest expression of the product, not an advanced side feature.

- Aligns with Janus's true strength: disciplined adversarial structure
- More robust across model differences
- Keeps one decision gate instead of a committee of scores
- Risk: requires sharper internal discipline on what each lens may and may not assert

### Option C — Turn Janus into a broad multi-agent decision council

Promote separate specialist voices (technical critic, product critic, business critic, operator critic, etc.) and synthesize them into a final verdict. Treat Janus less as one harness and more as a panel.

- High rhetorical appeal
- Easy to explain as "multiple experts attack your plan"
- Risk: amplifies style drift and backend variance
- Risk: becomes harder to audit which critique is grounding vs performance
- Risk: synthesis layer can create false coherence and overclaim certainty

## Assumptions

- A-1: Janus's real differentiation is structure, not model selection.
- A-2: Operators would trust Janus more if the gate criteria and attack dimensions were explicit and stable across backends.
- A-3: The nearest-surviving-neighbor style of alternative generation is enough for most Janus use cases; wide brainstorming is not required.
- A-4: Business and product attacks can remain honest if they are forced to ground themselves in stated claims, constraints, assumptions, and optional enrichment evidence.
- A-5: A fixed lens matrix will reduce quality variance more than adding more prose or more model-specific prompting tricks.

## Unknowns

- U-1: Whether explicit dimension-aware attacks improve practical decision quality, or merely make Janus outputs look more systematic.
- U-2: Whether business-lens attacks can stay disciplined without overreaching into unverifiable market storytelling.
- U-3: Whether a fixed metric set is enough to keep weaker backends at a usable floor, or whether some models still fail the contract too often.
- U-4: Whether operators prefer one collapsed gate verdict, or whether they will demand a visible per-lens ledger before trusting the result.
- U-5: Whether `harness` should become the primary mental model for Janus, with `eval` repositioned as the lightweight front door.

## Decision requested

Which option gives Janus the most honest and durable product direction?

More specifically:

1. Should Janus explicitly define itself as a **model-agnostic adversarial decision harness**?
2. If yes, is **Option B** the right shape: fixed attack lenses, fixed metric contract, deterministic collapse rules, and bounded surviving alternatives?
3. What enabling conditions must hold for this direction to remain truthful rather than theatrical?
