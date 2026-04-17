import type { JanusOutput, OutputFormat } from "../types.js";
export declare function validateOutput(output: JanusOutput): string[];
export declare function formatOutput(output: JanusOutput, format: OutputFormat): string;
