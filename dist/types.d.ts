export interface JanusInput {
    goals: ExtractedField[];
    constraints: ExtractedField[];
    options: OptionPath[];
    nfrs: ExtractedField[];
    assumptions: Assumption[];
    anti_goals: ExtractedField[];
    dependencies: ExtractedField[];
    context: ExtractedField[];
}
export interface ExtractedField {
    id: string;
    text: string;
    origin: "explicit" | "inferred";
    source_line?: number;
}
export interface OptionPath {
    id: string;
    name: string;
    description: string;
    origin: "explicit" | "inferred";
    source_line?: number;
}
export interface Assumption {
    id: string;
    statement: string;
    origin: "explicit" | "inferred";
    validated: boolean;
    risk_if_wrong: string;
}
export type DecisionStatus = "recommend" | "conditional" | "blocked";
export type InformationQuality = "sufficient" | "degraded" | "insufficient";
export type RobustnessScore = "low" | "medium" | "high";
export type UnknownSource = "missing_field" | "inferred_assumption" | "information_asymmetry" | "external_dependency";
export interface JanusOutput {
    decision_status: DecisionStatus;
    best_path: BestPath | null;
    candidate_paths?: CandidatePath[];
    rejected_paths: RejectedPath[];
    critical_unknowns: CriticalUnknown[];
    assumptions: OutputAssumption[];
    information_quality: InformationQuality;
    next_actions: NextAction[];
    variance_report?: VarianceReport;
}
export interface CandidatePath {
    name: string;
    origin: "document" | "generated" | "decomposed";
    fit_summary: string;
    archetype_slug: string;
}
export interface VarianceReport {
    samples: number;
    decision_status_trace: DecisionStatus[];
    decision_status_agreement: number;
    best_path_agreement: number | null;
    tie_broken_to: DecisionStatus | null;
    rejected_path_frequency: Record<string, number>;
    critical_unknown_frequency: Record<string, number>;
    per_sample_errors: (string | null)[];
}
export interface BestPath {
    name: string;
    rationale: string;
    enabling_conditions: string[];
    fragility_warnings: string[];
    robustness_score: RobustnessScore;
}
export interface FailureChainStep {
    step: number;
    event: string;
    trigger: string;
}
export interface ComparisonBasis {
    fragility: "lower" | "equal" | "higher";
    unknowns: "fewer" | "equal" | "more";
    nfr_coverage: "better" | "equal" | "worse";
    reversibility: "more" | "equal" | "less";
    scope: "smaller" | "equal" | "larger";
}
export interface RejectedPath {
    name: string;
    rejection_reason: string;
    violated_principle: string | null;
    archetype_slug?: string | null;
    canonical_key?: string;
    failure_chain?: FailureChainStep[];
    comparison_basis?: ComparisonBasis;
    could_recover: boolean;
    recovery_condition: string | null;
}
export interface CriticalUnknown {
    id: string;
    description: string;
    impact: string;
    question_for_human: string | null;
    source: UnknownSource;
}
export interface OutputAssumption {
    id: string;
    statement: string;
    origin: "explicit" | "inferred";
    validated: boolean;
    risk_if_wrong: string;
}
export interface NextAction {
    priority: "critical" | "high" | "medium";
    action: string;
    addresses: string;
}
export interface EvaluationRequest {
    document: string;
    systemPrompt: string;
    outputSchema: string;
}
export interface EvaluationResponse {
    raw: string;
    parsed: JanusOutput | null;
    error: string | null;
}
export type BackendType = "claude" | "codex" | "opencode" | "openai-api" | "anthropic-api" | "mock";
export interface BackendConfig {
    type: BackendType;
    model?: string;
    timeout?: number;
}
export interface LoopState {
    iteration: number;
    document: string;
    evaluation: JanusOutput | null;
    rejected_path_count: number;
    critical_unknown_count: number;
    decision_status: DecisionStatus | null;
    convergence_trend: "improving" | "stagnant" | "degrading" | null;
}
export type OutputFormat = "json" | "markdown" | "yaml";
export interface EvalOptions {
    format: OutputFormat;
    backend: BackendType;
    model?: string;
    lens?: string;
    samples?: number;
}
export interface LoopOptions extends EvalOptions {
    maxIterations: number;
    auto: boolean;
}
export type DoctorFormat = "human" | "json";
export type DoctorProbeStatus = "passed" | "failed" | "skipped";
export interface DoctorBackendReport {
    name: BackendType;
    available: boolean;
    hint?: string;
    detail?: string;
    probe_supported: boolean;
    probe_attempted: boolean;
    probe_status: DoctorProbeStatus;
    probe_ok: boolean | null;
    probe_error?: string;
    probe_skip_reason?: string;
}
export interface DoctorReport {
    node_version: string;
    node_ok: boolean;
    probe_enabled: boolean;
    backends: DoctorBackendReport[];
    available_count: number;
    attempted_probe_count: number;
    probe_pass_count: number;
    ready: boolean;
}
export type DoomSeverity = "fatal" | "severe" | "moderate" | "low";
export type DoomSurvivability = "unsurvivable" | "conditional" | "survivable";
export type SurvivalRating = "fragile" | "resilient" | "antifragile";
export interface DoomScenario {
    id: string;
    title: string;
    severity: DoomSeverity;
    survivability: DoomSurvivability;
    survival_condition: string | null;
    failure_chain: FailureChainStep[];
}
export interface DoomReport {
    doom_scenarios: DoomScenario[];
    survival_rating: SurvivalRating;
    doom_count: number;
    critical_unknowns: CriticalUnknown[];
}
export interface DoomResponse {
    raw: string;
    parsed: DoomReport | null;
    error: string | null;
}
export type HarnessRiskLevel = "fatal" | "severe" | "moderate" | "low" | "uncovered";
export interface TargetedDoomScenario extends DoomScenario {
    attacks_condition: string | null;
}
export interface TargetedDoomReport {
    doom_scenarios: TargetedDoomScenario[];
    survival_rating: SurvivalRating;
    doom_count: number;
}
export interface CrosscheckEntry {
    enabling_condition: string;
    doom_covered: boolean;
    covering_scenario: string | null;
    risk_level: HarnessRiskLevel;
}
export interface HarnessVerdict {
    condition_survival_rate: number;
    unattacked_conditions: string[];
    fatal_conditions: string[];
    verification_required: string[];
    final_recommendation: DecisionStatus;
    delta_from_eval: string | null;
}
export interface HarnessReport {
    eval_verdict: JanusOutput;
    doom_verdict: TargetedDoomReport;
    crosscheck_matrix: CrosscheckEntry[];
    harness_verdict: HarnessVerdict;
}
export type ClaimType = "url" | "npm" | "github" | "statistical";
export type FetchStatus = "success" | "error" | "skipped";
export type EvidenceConfidence = "high" | "medium" | "low";
export interface Claim {
    type: ClaimType;
    raw: string;
    normalized: string;
}
export interface FetchedEvidence {
    claim: Claim;
    status: FetchStatus;
    data: Record<string, unknown> | null;
    error?: string;
}
export interface EnrichmentFinding {
    source: string;
    finding: string;
    supports_assumption: string | null;
    contradicts_assumption: string | null;
    confidence: EvidenceConfidence;
}
export interface EnrichmentReport {
    file: string;
    claims_found: Claim[];
    evidence: FetchedEvidence[];
    findings: EnrichmentFinding[];
    summary: string;
}
export declare const EXIT_RECOMMEND = 0;
export declare const EXIT_CONDITIONAL = 1;
export declare const EXIT_BLOCKED = 2;
export declare const EXIT_ERROR = 3;
