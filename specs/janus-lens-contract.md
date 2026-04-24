# Janus Lens Contract — Six Fixed Evaluation Lenses as System Contracts

## Context

The adversarial decision harness spec (`specs/janus-adversarial-decision-harness.md`) was evaluated by Janus and returned BLOCKED. The fatal finding was:

> "The six lens definitions must be formally specified in the system contract before deployment — not deferred to prompt-time improvisation — with explicit boundaries on what each lens MAY and MUST NOT assert."

Janus currently names six attack dimensions in its NFRs: Evidence, Technical, Product, Business, Operational, and Execution. These names appear in the harness spec and in internal documentation, but they have no formal contract. The `EvalOptions.lens?: string` field exists in `types.ts` with no runtime implementation. The attack form (claim → evidence anchor → collapse trigger → blast radius → recovery route) is defined in `doom-targeted.ts` but is not bound to any lens-specific scope rules.

The result is that each lens can assert anything the model feels like asserting. A Business lens can make Technical claims. An Operational lens can invent market assumptions. A Product lens can speculate about future user behavior with no document anchor. This is not a prompt quality problem. It is a structural gap: the lenses are named but not contracted.

Without a system-side contract, the harness attack matrix is a rhetorical frame, not a disciplined gate. The fatal finding from the harness dogfood stands until this spec resolves it.

## Goal

Define the six Janus evaluation lenses as system contracts with explicit scope, assertion permissions, grounding requirements, and unknown-emission rules. The contracts must be enforceable at the system level, not dependent on model-side eloquence or prompt-time interpretation.

Concretely, the chosen path must:

1. Specify each lens's domain scope so that adjacent lenses do not overlap or contradict each other.
2. Define MAY_ASSERT and MUST_NOT_ASSERT rules for each lens, grounded in P5 (Scope Discipline).
3. Specify what counts as a valid evidence anchor for each lens.
4. Define when each lens must emit `critical_unknowns` instead of arguments.
5. Establish overlap-prevention rules between adjacent lens pairs.
6. Resolve the fatal finding from the adversarial-decision-harness dogfood by giving the lens contract enough structural authority to survive a second harness pass.

## Constraints

- C-1: All six lenses must share the same attack form: claim → evidence anchor → collapse trigger → blast radius → recovery route. No lens may use a different attack structure.
- C-2: Every lens assertion must be grounded in the document under evaluation. P5 applies to all lenses without exception. A lens that lacks document evidence for a claim must emit a `critical_unknown`, not an invented argument.
- C-3: Lens scope boundaries must be mutually exclusive at the assertion level. A claim that belongs to one lens's domain is forbidden from appearing in an adjacent lens's output.
- C-4: The contract must be enforceable as a system-side schema rule, not a prompt-level suggestion. Enforcement level is the decision this spec asks Janus to make.
- C-5: The lens contract must not expand Janus's output schema beyond what `types.ts` currently supports. New fields may be proposed as a follow-on spec; this spec defines behavioral contracts only.
- C-6: Single-maintainer scope. The contract must be implementable as an extension of the existing harness, not a parallel system.
- C-7: The contract must remain honest under P1. A lens that cannot find document-grounded evidence for its domain must say so explicitly rather than produce low-confidence speculation dressed as analysis.

## NFRs

- Each lens contract must specify its domain in one sentence, its MAY_ASSERT list, its MUST_NOT_ASSERT list, its valid grounding sources, and its unknown-emission trigger.
- Overlap-prevention rules must be stated for every adjacent lens pair: Evidence/Technical, Technical/Product, Product/Business, Business/Operational, Operational/Execution.
- A lens that fires on a document section outside its domain must be treated as a contract violation, not a bonus finding.
- Unknown emission is mandatory, not optional, when a lens's domain is unaddressed in the document. Silence is not permitted.
- The attack form is fixed: claim → evidence anchor → collapse trigger → blast radius → recovery route. Each field is required. A lens output missing any field is malformed.
- Lens outputs collapse into the existing Janus contract fields: `rejected_paths`, `critical_unknowns`, `fragility_warnings`, `recovery_conditions`. No new top-level fields.
- The contract must survive a second harness pass on this spec without producing a new fatal finding on lens scope.

---

### Lens 1: Evidence

**Domain:** The quality, completeness, and grounding of the claims the document makes about its own premises.

**MAY_ASSERT:**
- Whether stated assumptions are labeled as assumptions or presented as facts without qualification.
- Whether quantitative claims (percentages, timelines, cost figures) have a named source or are asserted without attribution.
- Whether the document's stated unknowns are complete relative to the claims it makes.
- Whether evidence cited in the document is internally consistent (two claims do not contradict each other).
- Whether the document's confidence language matches the evidence it presents (P1 check).

**MUST_NOT_ASSERT:**
- Whether the technical approach is sound (Technical lens domain).
- Whether the product will succeed in the market (Product lens domain).
- Whether the business model is viable (Business lens domain).
- Whether the plan is operationally feasible (Operational lens domain).
- Whether the execution timeline is realistic (Execution lens domain).
- Any claim about external reality not stated in the document.

**Grounding sources:** The document's own text, its stated assumptions section, its unknowns section, and any inline citations or references it names. External data is not a valid grounding source for the Evidence lens unless the document itself references it.

**Unknown emission trigger:** When the document makes a claim that is load-bearing for its recommendation but provides no evidence anchor, the Evidence lens must emit a `critical_unknown` naming the ungrounded claim and its impact on the verdict.

---

### Lens 2: Technical

**Domain:** The soundness of the technical approach described in the document, evaluated against the technical constraints and requirements the document itself states.

**MAY_ASSERT:**
- Whether the proposed technical approach is internally consistent with the document's stated technical constraints.
- Whether the document identifies technical dependencies that could fail and whether it addresses those failure modes.
- Whether the technical enabling conditions are achievable given the constraints the document names.
- Whether the technical approach introduces irreversible commitments under uncertainty (P6 check within technical scope).
- Whether stated technical performance targets are consistent with the approach described.

**MUST_NOT_ASSERT:**
- Whether the product will satisfy user needs (Product lens domain).
- Whether the technical approach is commercially viable (Business lens domain).
- Whether the team can execute the technical plan (Execution lens domain).
- Whether the operational environment will support the system (Operational lens domain).
- Any claim about technical feasibility that is not grounded in the document's own technical description.

**Grounding sources:** The document's technical constraints, architecture descriptions, dependency lists, performance targets, and any technical assumptions it states explicitly.

**Unknown emission trigger:** When the document's technical approach depends on a capability or behavior that is not described or cited in the document, the Technical lens must emit a `critical_unknown` rather than assume the capability exists.

**Overlap prevention with Evidence:** The Technical lens evaluates whether the technical approach is sound. The Evidence lens evaluates whether the claims about the technical approach are grounded. A finding about missing evidence for a technical claim belongs to the Evidence lens. A finding about a technical approach being internally inconsistent belongs to the Technical lens.

---

### Lens 3: Product

**Domain:** Whether the document's proposed solution addresses the problem it states, for the users it names, within the scope it defines.

**MAY_ASSERT:**
- Whether the proposed solution is consistent with the problem statement in the document.
- Whether the document's stated user needs or use cases are addressed by the proposed approach.
- Whether the document's scope boundaries are internally consistent (it does not claim to solve problems it excludes from scope).
- Whether the product's stated success criteria are measurable given the approach described.
- Whether the document identifies user-facing failure modes and addresses them.

**MUST_NOT_ASSERT:**
- Whether the market is large enough to justify the product (Business lens domain).
- Whether the technical implementation will work (Technical lens domain).
- Whether the team can ship the product (Execution lens domain).
- Whether the product can be operated at scale (Operational lens domain).
- Any claim about user behavior or market reception not stated in the document.

**Grounding sources:** The document's problem statement, user descriptions, use cases, success criteria, scope definitions, and any product assumptions it states explicitly.

**Unknown emission trigger:** When the document proposes a solution but does not state the problem it solves, or names users but does not describe their needs, the Product lens must emit a `critical_unknown` rather than infer the missing context.

**Overlap prevention with Technical:** The Product lens evaluates whether the solution addresses the stated problem. The Technical lens evaluates whether the technical approach is sound. A finding about a feature not matching user needs belongs to the Product lens. A finding about a technical dependency being unaddressed belongs to the Technical lens.

**Overlap prevention with Business:** The Product lens evaluates solution-problem fit within the document's stated scope. The Business lens evaluates commercial viability. A finding about the product not solving the stated problem belongs to the Product lens. A finding about the product not generating revenue belongs to the Business lens.

---

### Lens 4: Business

**Domain:** The commercial and strategic viability of the plan, evaluated against the business constraints, goals, and assumptions the document explicitly states.

**MAY_ASSERT:**
- Whether the document's stated business goals are internally consistent with its constraints.
- Whether the document's commercial assumptions are labeled as assumptions or presented as facts.
- Whether the document identifies business risks and addresses them.
- Whether the stated business model or revenue logic is internally consistent with the approach described.
- Whether the document's strategic positioning claims are consistent with the constraints it names.

**MUST_NOT_ASSERT:**
- Whether the market is actually large enough (no external market data not in the document).
- Whether competitors will respond in a particular way (no external competitive intelligence not in the document).
- Whether the product will achieve product-market fit (Product lens domain for solution-problem fit; Business lens only for commercial framing).
- Whether the technical approach is sound (Technical lens domain).
- Whether the team can execute (Execution lens domain).
- Any claim about market reality that is not stated in the document.

**Grounding sources:** The document's stated business goals, commercial constraints, revenue assumptions, strategic positioning claims, and any business risks it names explicitly. Enrichment evidence (from `janus enrich`) is a valid grounding source when provenance is labeled.

**Unknown emission trigger:** When the document's business case depends on a market assumption, competitive assumption, or revenue assumption that is not stated or cited in the document, the Business lens must emit a `critical_unknown` rather than evaluate the assumption as if it were grounded.

**Overlap prevention with Product:** The Business lens evaluates commercial viability. The Product lens evaluates solution-problem fit. A finding about the product not addressing user needs belongs to the Product lens. A finding about the business model not being internally consistent belongs to the Business lens.

**Overlap prevention with Operational:** The Business lens evaluates commercial and strategic viability. The Operational lens evaluates whether the system can be run reliably. A finding about cost structure affecting commercial viability belongs to the Business lens. A finding about operational cost affecting system reliability belongs to the Operational lens.

---

### Lens 5: Operational

**Domain:** Whether the system or plan described in the document can be reliably operated, maintained, and recovered from failure, given the operational constraints the document states.

**MAY_ASSERT:**
- Whether the document addresses operational failure modes for the system it describes.
- Whether the document's stated operational constraints are internally consistent with the approach.
- Whether the document identifies recovery paths for the failure modes it names.
- Whether the operational dependencies the document names are addressed.
- Whether the document's reliability or availability targets are consistent with the approach described.

**MUST_NOT_ASSERT:**
- Whether the technical implementation is sound (Technical lens domain).
- Whether the business model is viable (Business lens domain).
- Whether the team can execute the plan (Execution lens domain).
- Whether the product addresses user needs (Product lens domain).
- Any claim about operational reality not stated in the document.

**Grounding sources:** The document's operational constraints, reliability targets, failure mode descriptions, recovery plans, dependency lists, and any operational assumptions it states explicitly.

**Unknown emission trigger:** When the document describes a system that must be operated but does not address operational failure modes, recovery paths, or operational dependencies, the Operational lens must emit a `critical_unknown` for each unaddressed operational gap.

**Overlap prevention with Technical:** The Operational lens evaluates whether the system can be reliably operated. The Technical lens evaluates whether the technical approach is sound. A finding about a technical dependency failing at runtime belongs to the Operational lens when it affects operability. A finding about a technical approach being internally inconsistent belongs to the Technical lens regardless of operational impact.

**Overlap prevention with Execution:** The Operational lens evaluates ongoing system operation after delivery. The Execution lens evaluates whether the plan can be delivered. A finding about post-delivery reliability belongs to the Operational lens. A finding about delivery timeline or team capacity belongs to the Execution lens.

---

### Lens 6: Execution

**Domain:** Whether the plan described in the document can be delivered given the resources, timeline, team, and dependencies the document states.

**MAY_ASSERT:**
- Whether the document's stated timeline is internally consistent with the scope it describes.
- Whether the document identifies execution dependencies and addresses them.
- Whether the document's resource assumptions are internally consistent with the plan.
- Whether the document names execution risks and addresses them.
- Whether the stated scope is achievable within the constraints the document names.

**MUST_NOT_ASSERT:**
- Whether the technical approach is sound (Technical lens domain).
- Whether the product will succeed (Product lens domain).
- Whether the business model is viable (Business lens domain).
- Whether the system can be operated after delivery (Operational lens domain).
- Any claim about team capability or organizational reality not stated in the document.

**Grounding sources:** The document's stated timeline, resource constraints, team descriptions, dependency lists, scope definitions, and any execution assumptions it states explicitly.

**Unknown emission trigger:** When the document proposes a plan but does not state the resources, timeline, or team required to execute it, the Execution lens must emit a `critical_unknown` for each unaddressed execution dependency rather than assume the plan is feasible.

**Overlap prevention with Operational:** The Execution lens evaluates delivery of the plan. The Operational lens evaluates ongoing operation after delivery. A finding about whether the team can ship the system belongs to the Execution lens. A finding about whether the shipped system can be maintained belongs to the Operational lens.

---

## Assumptions

- A-1: The six lens domains are mutually exclusive at the assertion level. A claim that belongs to one lens's domain cannot simultaneously belong to another lens's domain without being a contract violation.
- A-2: Document-grounded evaluation (P5) is sufficient to make each lens useful. A lens that finds no document evidence for its domain is not broken; it is correctly emitting unknowns.
- A-3: The existing Janus output schema (`rejected_paths`, `critical_unknowns`, `fragility_warnings`, `recovery_conditions`) is sufficient to carry lens-attributed findings without schema changes.
- A-4: System-side enforcement of lens contracts is more durable than prompt-level enforcement across heterogeneous backends. A contract that depends on model eloquence will drift; a contract enforced by schema validation will not.
- A-5: The attack form (claim → evidence anchor → collapse trigger → blast radius → recovery route) is already proven in `doom-targeted.ts` and can be applied uniformly across all six lenses without modification.
- A-6: Overlap-prevention rules between adjacent lenses are sufficient to prevent double-counting. Non-adjacent lenses (e.g., Evidence and Execution) are unlikely to produce overlapping assertions given their domain definitions.

## Unknowns

- U-1: Whether the six lens domains are truly mutually exclusive in practice, or whether real-world specs produce claims that sit on the boundary between adjacent lenses (e.g., a technical cost claim that is simultaneously a business viability claim).
- U-2: Whether system-side schema validation (Option A) can enforce MAY_ASSERT and MUST_NOT_ASSERT rules without requiring the model to self-report which lens produced each claim.
- U-3: Whether prompt-embedded contracts (Option B) produce sufficient lens discipline across heterogeneous backends, or whether weaker backends collapse lens boundaries under pressure.
- U-4: Whether the overlap-prevention rules between Product/Business and Technical/Operational are precise enough to resolve boundary cases, or whether they require a tiebreaker rule.
- U-5: Whether documentation-only contracts (Option C) are sufficient to prevent lens drift in practice, given that the harness dogfood already demonstrated that named-but-uncontracted lenses produce undisciplined output.

## Options

### Option A — Define lenses as system-side schema contracts with runtime validation

Encode each lens's MAY_ASSERT and MUST_NOT_ASSERT rules as machine-readable schema constraints. At runtime, validate each lens output against its contract before the harness collapses findings into the final verdict. Lens outputs that violate their contract are rejected and trigger a `critical_unknown` about the contract violation itself.

This satisfies C-4 (system-side enforcement) and C-2 (P5 grounding). It requires extending the harness to include a validation pass between lens output and collapse. The `EvalOptions.lens` field in `types.ts` becomes the entry point for routing a document to a specific lens contract.

Pros:
- Resolves the fatal finding from the harness dogfood directly. The contract has structural authority because it is enforced at runtime, not suggested at prompt time.
- Consistent across backends. A weaker model that violates a lens contract is caught by the validator, not by a human reviewer.
- Auditable. Operators can inspect which lens produced which finding and whether it passed contract validation.
- Satisfies C-3 (mutual exclusivity) because the validator can detect cross-lens assertion violations.

Cons:
- Requires implementing a lens output validator in the harness. This is new code, not just new prompts.
- Requires the model to tag each assertion with its source lens, or requires the harness to infer lens attribution from output structure. Neither is trivial.
- Risk: if the schema contract is too strict, valid findings near lens boundaries are rejected. If too loose, the contract provides no real enforcement.

### Option B — Define lenses as prompt-embedded contracts with structural output validation

Embed the MAY_ASSERT and MUST_NOT_ASSERT rules for each lens directly into the system prompt or harness prompt. Require the model to produce structured output that attributes each finding to a named lens. Validate the output structure (lens name present, attack form fields present) but do not validate the semantic content of each assertion against the contract.

This satisfies C-4 partially: the contract is in the system, but enforcement is structural rather than semantic. It does not require new runtime validation logic beyond what the existing output parser already does.

Pros:
- Lower implementation cost than Option A. No new validator needed beyond structural output checks.
- Works with the existing output schema without changes.
- Prompt-embedded contracts are immediately available to all backends without code changes.

Cons:
- Semantic enforcement depends on the model. A backend that ignores the MAY_ASSERT rules produces a structurally valid but contractually invalid output. The harness cannot distinguish the two.
- Does not fully resolve the fatal finding. The harness dogfood found that named-but-uncontracted lenses produce undisciplined output. Prompt-embedded contracts are still prompt-level; a model under pressure will collapse lens boundaries.
- Violates C-4 in spirit: the contract's authority comes from the model's compliance, not from the system's enforcement.

### Option C — Define lenses as documentation-only contracts without runtime enforcement

Write the lens contracts as this spec defines them. Reference them in the system prompt by name. Do not add runtime validation. Trust that the model will respect the contracts because they are clearly stated.

This requires no code changes. The contracts exist as documentation and as prompt context.

Pros:
- Zero implementation cost.
- Immediately available.
- Sufficient for backends that reliably follow structured instructions.

Cons:
- Does not resolve the fatal finding. The harness dogfood already demonstrated that documentation-only lens definitions produce undisciplined output. This option repeats the same structural gap with better documentation.
- Violates C-4 directly. Documentation-only contracts have no structural authority.
- Violates C-7 (heterogeneous backend support). Weaker backends will not respect documentation-only contracts consistently.
- A second harness pass on this spec would likely produce the same fatal finding: "lens contracts exist as documentation but have no enforcement mechanism."

## Decision requested

Which enforcement level gives the fixed-lens contract enough structural authority to resolve the fatal finding from the adversarial-decision-harness dogfood?

More specifically:

1. Is Option A (system-side schema contracts with runtime validation) the right enforcement level, given that it requires new harness code but provides genuine structural authority?
2. If Option A is chosen, what is the minimum viable validator: must it check semantic content against MAY_ASSERT rules, or is structural validation (lens name present, attack form fields present) sufficient to resolve the fatal finding?
3. If Option B is chosen, what additional safeguards prevent prompt-embedded contracts from collapsing under backend variance, and does that make the fatal finding survivable?
4. What enabling conditions must hold for the chosen option to be trustworthy across heterogeneous backends, and what failure modes need explicit mitigation before the harness dogfood is re-run?
