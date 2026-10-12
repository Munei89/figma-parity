import type { ParityReport } from "../results.js";
/** Writes report.json and report.html into `dir`. With `inline`, images become data URIs. */
export declare function writeReport(report: ParityReport, dir: string, inline?: boolean): Promise<{
    htmlPath: string;
    jsonPath: string;
}>;
