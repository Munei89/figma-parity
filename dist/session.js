import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { GENERIC_NAME } from "./compare/styles.js";
import { compareVisual } from "./compare/visual.js";
import { FigmaClient, parseFileKey } from "./figma/client.js";
import { extractDesign } from "./figma/extract.js";
import { buildPrototypeGraph, graphToMermaid } from "./figma/prototype.js";
import { SnapshotSource } from "./figma/snapshot.js";
import { slug } from "./figma/util.js";
import { VERSION } from "./version.js";
export function createSource(config) {
    if (config.figma.snapshotDir)
        return new SnapshotSource(resolve(config.figma.snapshotDir));
    const token = config.figma.token ?? process.env.FIGMA_TOKEN;
    if (!token)
        throw new Error("Set FIGMA_TOKEN (or figma.token) or point figma.snapshotDir at a snapshot.");
    return new FigmaClient({ token, fileKey: parseFileKey(config.figma.file) });
}
/**
 * Shared state for a parity run: the design, the prototype graph, how each
 * screen/element maps to the app, and accumulated results. Used by the
 * automated runner and by the MCP server (where an agent drives the app).
 */
export class ParitySession {
    config;
    source;
    design;
    graph;
    outDir;
    screens = new Map();
    flows = new Map();
    renders = new Map();
    startedAt = Date.now();
    constructor(config, source, design, graph, outDir) {
        this.config = config;
        this.source = source;
        this.design = design;
        this.graph = graph;
        this.outDir = outDir;
    }
    static async create(config, opts = {}) {
        const source = opts.source ?? createSource(config);
        const pages = config.figma.pages;
        const design = await extractDesign(source, { screens: pages ? (s) => pages.includes(s.page) : undefined });
        const graph = buildPrototypeGraph(design.file);
        // Keep the graph to the selected pages.
        if (pages) {
            const keep = new Set(design.screens.map((s) => s.id));
            graph.edges = graph.edges.filter((e) => keep.has(e.from));
            graph.flows = graph.flows.filter((f) => keep.has(f.start));
            for (const id of Object.keys(graph.screens))
                if (!keep.has(id))
                    delete graph.screens[id];
        }
        const outDir = resolve(opts.cwd ?? process.cwd(), config.output.dir);
        await mkdir(join(outDir, "assets"), { recursive: true });
        return new ParitySession(config, source, design, graph, outDir);
    }
    screen(idOrName) {
        const key = idOrName.trim();
        return this.design.screens.find((s) => s.id === key || s.name === key || s.slug === slug(key));
    }
    /** Looks a screen up in config.screens by node id, exact name, or slug. */
    target(screen) {
        const entries = Object.entries(this.config.screens);
        const hit = entries.find(([k]) => k === screen.id) ??
            entries.find(([k]) => k === screen.name) ??
            entries.find(([k]) => slug(k) === screen.slug);
        return hit?.[1];
    }
    selectorFor(el, screen) {
        const map = this.config.elements;
        const explicit = map[el.id] ?? map[`${screen.name}/${el.path}`] ?? map[el.path] ?? map[el.name];
        if (explicit)
            return { selector: explicit, source: "explicit" };
        if (this.config.selectorStrategy !== "testid" || GENERIC_NAME.test(el.name.trim()))
            return undefined;
        const s = slug(el.name);
        if (!s)
            return undefined;
        // Ambiguous names (repeated within a screen) can't be resolved by test id.
        const dupes = screen.elements.filter((e) => slug(e.name) === s).length;
        if (dupes > 1)
            return undefined;
        return { selector: this.config.target.platform === "web" ? `[data-testid="${s}"]` : s, source: "testid" };
    }
    /** Elements worth checking on a screen, with their selectors. */
    candidates(screen) {
        const out = [];
        for (const el of screen.elements) {
            const sel = this.selectorFor(el, screen);
            if (sel)
                out.push({ el, sel });
        }
        return out;
    }
    async designRender(screen, scale) {
        // Figma accepts 0.01..4; round so cache keys and snapshot dirs are stable.
        const s = Math.min(4, Math.max(0.01, Math.round(scale * 100) / 100));
        const key = `${screen.id}@${s}`;
        if (!this.renders.has(key)) {
            let png = (await this.source.renderNodes([screen.id], s)).get(screen.id);
            // Snapshots are usually captured at integer scales; fall back to the nearest one.
            if (!png && s !== Math.round(s))
                png = (await this.source.renderNodes([screen.id], Math.max(1, Math.round(s)))).get(screen.id);
            if (!png)
                return undefined;
            this.renders.set(key, png);
        }
        return this.renders.get(key);
    }
    baseResult(screen) {
        const target = this.target(screen);
        const existing = this.screens.get(screen.id);
        if (existing)
            return existing;
        const res = {
            id: screen.id,
            name: screen.name,
            slug: screen.slug,
            page: screen.page,
            size: screen.size,
            status: target ? (target.skip ? "skipped" : "pass") : "unmapped",
            target: target ? { route: target.route, deepLink: target.deepLink, marker: target.marker } : undefined,
            openComments: screen.comments.map((c) => ({
                author: c.user?.handle,
                message: c.message,
                nodeId: c.client_meta && "node_id" in c.client_meta ? c.client_meta.node_id : undefined,
            })),
            devResources: screen.devResources.map((d) => ({ name: d.name, url: d.url, nodeId: d.node_id })),
        };
        this.screens.set(screen.id, res);
        return res;
    }
    async writeAsset(name, png) {
        const rel = `assets/${name}`;
        await writeFile(join(this.outDir, rel), png);
        return rel;
    }
    /** Runs the pixel comparison for a screen against an app screenshot and records it. */
    async recordVisual(screen, appPng, appViewport, masks = []) {
        const res = this.baseResult(screen);
        const appWidthPx = appPng.readUInt32BE(16);
        const design = await this.designRender(screen, appWidthPx / screen.size.width);
        if (!design) {
            res.error = "Figma did not return a render for this frame.";
            return undefined;
        }
        const target = this.target(screen);
        const threshold = target?.visualThreshold ?? this.config.thresholds.visual;
        const v = compareVisual({
            design,
            app: appPng,
            frame: screen.size,
            appWidth: appViewport.width,
            elements: screen.elements,
            masks,
            threshold,
            pixelThreshold: this.config.thresholds.pixel,
            regionThreshold: this.config.thresholds.region,
        });
        const [d, a, x] = await Promise.all([
            this.writeAsset(`${screen.slug}-design.png`, v.images.design),
            this.writeAsset(`${screen.slug}-app.png`, v.images.app),
            this.writeAsset(`${screen.slug}-diff.png`, v.images.diff),
        ]);
        res.visual = {
            status: v.status,
            mismatchRatio: v.mismatchRatio,
            threshold,
            heightDelta: v.heightDelta,
            widthDelta: v.widthDelta,
            regions: v.regions,
            images: { design: d, app: a, diff: x },
        };
        this.updateStatus(res);
        return v;
    }
    recordStyles(screen, styles) {
        const res = this.baseResult(screen);
        res.styles = styles;
        this.updateStatus(res);
    }
    recordReview(screen, by, findings) {
        const res = this.baseResult(screen);
        res.review = { by, findings };
        if (findings.some((f) => f.severity === "high") && res.status === "pass")
            res.status = "fail";
    }
    recordFlow(result) {
        this.flows.set(result.edge.id, result);
    }
    updateStatus(res) {
        if (res.status === "unmapped" || res.status === "skipped" || res.status === "error" || res.status === "unreachable")
            return;
        const failed = res.visual?.status === "fail" || res.styles?.status === "fail" || res.review?.findings.some((f) => f.severity === "high");
        res.status = failed ? "fail" : "pass";
    }
    report(platform, target) {
        for (const s of this.design.screens)
            this.baseResult(s);
        const screens = this.design.screens.map((s) => this.screens.get(s.id));
        const flows = this.graph.edges.map((e) => this.flows.get(e.id)).filter((f) => !!f);
        const visuals = screens.map((s) => s.visual).filter((v) => !!v);
        const styleChecked = screens.reduce((n, s) => n + (s.styles?.found ?? 0), 0);
        const styleMismatches = screens.reduce((n, s) => n + (s.styles?.mismatches.length ?? 0), 0);
        const count = (st) => screens.filter((s) => s.status === st).length;
        const fcount = (st) => flows.filter((f) => f.status === st).length;
        const averageSimilarity = visuals.length ? 1 - visuals.reduce((n, v) => n + v.mismatchRatio, 0) / visuals.length : null;
        const tested = count("pass") + count("fail");
        const flowTested = fcount("pass") + fcount("fail");
        const parts = [];
        if (tested)
            parts.push(count("pass") / tested);
        if (flowTested)
            parts.push(fcount("pass") / flowTested);
        if (averageSimilarity !== null)
            parts.push(averageSimilarity);
        return {
            meta: {
                tool: "@flintdesignz/figma-parity",
                version: VERSION,
                generatedAt: new Date().toISOString(),
                figmaFile: this.design.fileName,
                figmaVersion: this.design.version,
                figmaLastModified: this.design.lastModified,
                platform,
                target,
                durationMs: Date.now() - this.startedAt,
            },
            summary: {
                screens: {
                    total: screens.length,
                    pass: count("pass"),
                    fail: count("fail"),
                    unmapped: count("unmapped"),
                    other: count("error") + count("skipped") + count("unreachable"),
                },
                visual: { averageSimilarity },
                styles: { checked: styleChecked, mismatches: styleMismatches },
                flows: {
                    total: this.graph.edges.length,
                    pass: fcount("pass"),
                    fail: fcount("fail"),
                    blocked: fcount("blocked") + fcount("error"),
                    skipped: this.graph.edges.length - fcount("pass") - fcount("fail") - fcount("blocked") - fcount("error"),
                },
                score: parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : null,
            },
            screens,
            flows,
            flowsByName: this.graph.flows.map((f) => ({ name: f.name, start: f.start, edges: f.edges })),
            danglingEdges: this.graph.dangling,
            mermaid: graphToMermaid(this.graph),
            tokens: this.design.tokens,
        };
    }
}
