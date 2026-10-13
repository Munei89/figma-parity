import { appendFile } from "node:fs/promises";
import type { ParityReport } from "./results.js";

const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Markdown summary for CI job summaries and PR comments. */
/**
 * Convert a parity report to Markdown (for PR comments).
 * @param r - Parity report
 * @param reportUrl - Optional URL to link to full report
 * @returns Markdown string with summary table and top issues
 */
export function reportToMarkdown(r: ParityReport, reportUrl?: string): string {
  const s = r.summary;
  const lines = [
    `### Design parity: ${s.score ?? "—"} / 100`,
    "",
    `| Screens passing | Visual similarity | Style mismatches | Flows passing |`,
    `|---|---|---|---|`,
    `| ${s.screens.pass} / ${s.screens.pass + s.screens.fail} | ${pct(s.visual.averageSimilarity)} | ${s.styles.mismatches} | ${s.flows.pass} / ${s.flows.pass + s.flows.fail} |`,
    "",
  ];

  const failing = r.screens.filter((x) => x.status === "fail" || x.status === "error");
  if (failing.length) {
    lines.push("**Screens**", "", "| Screen | Similarity | Issues |", "|---|---|---|");
    for (const x of failing) {
      const issues = [
        ...(x.styles?.mismatches.slice(0, 3).map((m) => `${m.path}: ${m.property} ${m.expected} → ${m.actual ?? "—"}`) ?? []),
        ...(x.review?.findings.filter((f) => f.severity === "high").map((f) => `${f.area}: ${f.issue}`) ?? []),
        ...(x.error ? [x.error] : []),
      ];
      const mismatchCount = x.styles?.mismatches?.length ?? 0;
      const more = mismatchCount > 3 ? ` (+${mismatchCount - 3} more)` : "";
      lines.push(`| ${cell(x.name)} | ${x.visual ? pct(1 - x.visual.mismatchRatio) : "—"} | ${cell(issues.join("; "))}${more} |`);
    }
    lines.push("");
  }

  const flows = r.flows.filter((f) => f.status === "fail");
  if (flows.length) {
    lines.push("**Prototype flows**", "");
    for (const f of flows) lines.push(`- ${f.fromName} → ${f.toName ?? f.edge.kind} via "${f.edge.hotspot.name}": ${f.note ?? "failed"}`);
    lines.push("");
  }

  if (reportUrl) lines.push(`[Full report](${reportUrl})`);
  return lines.join("\n");
}

/** Writes a GitHub Actions job summary and error annotations when running in Actions. */
/**
 * Emit GitHub Actions annotations and job summary for a parity report.
 * Only runs in GitHub Actions (checks GITHUB_ACTIONS env var).
 * @param r - Parity report
 */
export async function emitGitHubActions(r: ParityReport): Promise<void> {
  if (!process.env.GITHUB_ACTIONS) return;

  const esc = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

  for (const x of r.screens.filter((s) => s.status === "fail")) {
    const n = (x.styles?.mismatches ?? []).length;
    const detail = [x.visual?.status === "fail" ? `${pct(x.visual.mismatchRatio)} of pixels differ` : "", n ? `${n} style mismatches` : ""]
      .filter(Boolean)
      .join(", ");
    console.log(`::error title=Design parity: ${esc(x.name)}::${esc(detail || "Screen differs from the design")}`);
  }

  for (const f of r.flows.filter((f) => f.status === "fail")) {
    console.log(`::error title=Prototype flow: ${esc(`${f.fromName} → ${f.toName ?? f.edge.kind}`)}::${esc(f.note ?? "failed")}`);
  }

  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, reportToMarkdown(r) + "\n");
}
