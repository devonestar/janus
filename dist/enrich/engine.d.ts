import type { JanusBackend } from "../backend/interface.js";
import type { EnrichmentReport } from "../types.js";
export interface EnrichOptions {
    backend: JanusBackend;
}
export declare function runEnrich(file: string, opts: EnrichOptions): Promise<EnrichmentReport>;
export declare function formatEnrichOutput(report: EnrichmentReport, format: "json" | "markdown"): string;
