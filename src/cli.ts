#!/usr/bin/env node
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { emitGitHubActions, reportToMarkdown } from "./ci.js";
import { loadConfig } from "./config.js";
import { FigmaClient, parseFileKey } from "./figma/client.js";
import { extractDesign } from "./figma/extract.js";
import { buildPrototypeGraph, graphToMermaid } from "./figma/prototype.js";
import { saveSnapshot } from "./figma/snapshot.js";
import { generateConfig } from "./init.js";
import { runParity } from "./runner.js";
import { createSource } from "./session.js";
import { VERSION } from "./version.js";

const program = new Command()
  .name("figma-parity")
  .description("Compare Figma screens and prototype flows against your running web or React Native app.")
  .version(VERSION);

const ICON: Record<string, string> = { pass: "✓", fail: "✗", error: "!", blocked: "◌", skipped: "–", unmapped: "?", unreachable: "◌" };

program
  .command("run")
  .description("Run visual, style and flow checks and write the report")
  .option("-c, --config <path>", "config file")
  .option("--only <screens>", "comma-separated screen names/ids to check")
  .option("--headed", "show the browser (web)")
  .option("--no-flows", "skip prototype flow checks")
  .option("--fail-on <level>", "exit non-zero when: fail | never", "fail")
  .option("--json", "print the summary as JSON (for scripts)")
  .option("--markdown <file>", "also write a Markdown summary (PR comments)")
  .action(async (opts) => {
    const config = await loadConfig(opts.config);
    if (opts.headed && config.target.platform === "web") config.target.headless = false;
    if (!opts.flows) config.checks.flows = false;

    const { report, htmlPath } = await runParity(config, {
      only: opts.only?.split(",").map((s: string) => s.trim()),
      onProgress: (e) => {
        if (opts.json) return;
        if (e.type === "design") console.log(`Design: ${e.screens} screens, ${e.edges} prototype links`);
        if (e.type === "screen") console.log(`  ${ICON[e.status] ?? "·"} ${e.name} — ${e.status}`);
        if (e.type === "flow") console.log(`  ${ICON[e.status] ?? "·"} ${e.label} — ${e.status}`);
      },
    });

    const s = report.summary;
    await emitGitHubActions(report);
    if (opts.markdown) await writeFile(resolve(opts.markdown), reportToMarkdown(report));
    if (opts.json) console.log(JSON.stringify({ htmlPath, summary: s }, null, 2));
    else console.log(`\nScore ${s.score ?? "—"} · screens ${s.screens.pass}/${s.screens.pass + s.screens.fail} · flows ${s.flows.pass}/${s.flows.pass + s.flows.fail} · ${s.styles.mismatches} style mismatches`);
    if (!opts.json) console.log(`Report: ${htmlPath}`);
    if (opts.failOn === "fail" && (s.screens.fail > 0 || s.flows.fail > 0)) process.exitCode = 1;
  });

program
  .command("init")
  .description("Generate a starter config from a Figma file")
  .requiredOption("-f, --file <url>", "Figma file URL or key")
  .option("-p, --platform <platform>", "web | react-native", "web")
  .option("--base-url <url>", "web app base URL", "http://localhost:3000")
  .option("-o, --out <path>", "where to write", "figma-parity.config.mjs")
  .option("--force", "overwrite an existing config")
  .action(async (opts) => {
    const out = resolve(opts.out);
    if (existsSync(out) && !opts.force) throw new Error(`${opts.out} exists. Use --force to overwrite.`);
    const token = process.env.FIGMA_TOKEN;
    if (!token) throw new Error("Set FIGMA_TOKEN to read the file.");
    const source = new FigmaClient({ token, fileKey: parseFileKey(opts.file) });
    const design = await extractDesign(source, { includeComments: false, includeDevResources: false });
    const graph = buildPrototypeGraph(design.file);
    await writeFile(out, generateConfig(design, graph, { file: opts.file, platform: opts.platform, baseUrl: opts.baseUrl }));
    console.log(`Wrote ${opts.out}: ${design.screens.length} screens, ${graph.edges.length} prototype links, ${graph.flows.length} flows.`);
  });

program
  .command("extract")
  .description("Extract screens, element specs, tokens, comments and dev resources as JSON")
  .option("-c, --config <path>", "config file")
  .option("-o, --out <path>", "output file", "design.json")
  .action(async (opts) => {
    const config = await loadConfig(opts.config);
    const design = await extractDesign(createSource(config));
    const { file: _raw, ...rest } = design;
    await writeFile(resolve(opts.out), JSON.stringify(rest, null, 2));
    console.log(`Wrote ${opts.out}: ${design.screens.length} screens, ${Object.keys(design.tokens.colors).length} colour tokens.`);
  });

program
  .command("flows")
  .description("Print the prototype flow graph")
  .option("-c, --config <path>", "config file")
  .option("--mermaid", "print Mermaid instead of text")
  .action(async (opts) => {
    const config = await loadConfig(opts.config);
    const source = createSource(config);
    const graph = buildPrototypeGraph(await source.getFile());
    if (opts.mermaid) return console.log(graphToMermaid(graph));
    const name = (id: string) => (id ? (graph.screens[id]?.name ?? id) : "");
    for (const f of graph.flows) {
      console.log(`\n${f.name} (starts at ${name(f.start)}, ${f.screens.length} screens)`);
      for (const id of f.edges) {
        const e = graph.edges.find((x) => x.id === id)!;
        console.log(`  ${name(e.from)} —[${e.trigger.replace("ON_", "").toLowerCase()} "${e.hotspot.name}"]→ ${e.to ? name(e.to) : e.kind}`);
      }
    }
    if (graph.dangling.length) console.log(`\n${graph.dangling.length} link(s) point at missing frames.`);
  });

program
  .command("snapshot")
  .description("Save the design (file, comments, frame renders) to disk for offline/CI runs")
  .option("-c, --config <path>", "config file")
  .option("-d, --dir <dir>", "snapshot directory", ".figma-snapshot")
  .option("-s, --scale <n>", "render scale (match your device scale factor)", "1")
  .action(async (opts) => {
    const config = await loadConfig(opts.config);
    config.figma.snapshotDir = undefined;
    const source = createSource(config);
    const design = await extractDesign(source, { includeComments: false });
    await saveSnapshot(source, resolve(opts.dir), design.screens.map((s) => s.id), Number(opts.scale));
    console.log(`Saved ${design.screens.length} screens to ${opts.dir}. Set figma.snapshotDir: "${opts.dir}" to use it.`);
  });

program
  .command("mcp")
  .description("Start the MCP server (stdio) so an agent like Claude can drive the checks from its own browser")
  .option("-c, --config <path>", "config file")
  .action(async (opts) => {
    const { startMcpServer } = await import("./mcp/server.js");
    await startMcpServer({ configPath: opts.config });
  });

program.parseAsync().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
