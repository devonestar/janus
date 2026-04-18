import type { DoctorFormat, DoctorReport } from "./types.js";
export declare const BACKEND_INSTALL_HINTS: Record<string, string[]>;
export declare function resolveDoctorFormat(format: string | undefined): DoctorFormat;
export declare function doctorExitCode(report: DoctorReport): number;
export declare function collectDoctorReport(options: {
    probe: boolean;
}): Promise<DoctorReport>;
export declare function renderDoctorHuman(report: DoctorReport): string;
