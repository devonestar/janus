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
export interface RejectedPath {
    name: string;
    rejection_reason: string;
    violated_principle: string | null;
    archetype_slug?: string | null;
    canonical_key?: string;
    failure_chain?: FailureChainStep[];
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
export declare const EXIT_RECOMMEND = 0;
export declare const EXIT_CONDITIONAL = 1;
export declare const EXIT_BLOCKED = 2;
export declare const EXIT_ERROR = 3;
