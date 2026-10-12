import type { ParityReport } from "./results.js";
/** Markdown summary for CI job summaries and PR comments. */
export declare function reportToMarkdown(r: ParityReport, reportUrl?: string): string;
/** Writes a GitHub Actions job summary and error annotations when running in Actions. */
export declare function emitGitHubActions(r: ParityReport): Promise<void>;
