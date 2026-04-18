import type { DoomReport, JanusOutput, OutputFormat } from "../types.js";
export declare function validateOutput(output: JanusOutput): string[];
export declare function formatOutput(output: JanusOutput, format: OutputFormat): string;
export declare function validateDoomOutput(output: DoomReport): string[];
export declare function formatDoomOutput(output: DoomReport, format: OutputFormat): string;
export declare function formatDoomMarkdown(o: DoomReport): string;
