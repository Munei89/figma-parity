import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ParityReport } from "../results.js";
import { renderHtml } from "./html.js";

/** Writes report.json and report.html into `dir`. With `inline`, images become data URIs. */
export async function writeReport(report: ParityReport, dir: string, inline: boolean = false) {
  const jsonPath = join(dir, "report.json");
  const htmlPath = join(dir, "report.html");

  await writeFile(jsonPath, JSON.stringify(report, null, 2));

  let resolveImage = (p: string) => p;
  if (inline) {
    const cache = new Map<string, string>();
    const paths = new Set<string>();
    for (const s of report.screens) if (s.visual) Object.values(s.visual.images).forEach((p) => paths.add(p));
    for (const f of report.flows) if (f.screenshot) paths.add(f.screenshot);
    await Promise.all(
      [...paths].map(async (p) => {
        const buf = await readFile(join(dir, p)).catch(() => undefined);
        if (buf) cache.set(p, `data:image/png;base64,${buf.toString("base64")}`);
      })
    );
    resolveImage = (p) => cache.get(p) ?? p;
  }

  await writeFile(htmlPath, renderHtml(report, resolveImage));
  return { htmlPath, jsonPath };
}
