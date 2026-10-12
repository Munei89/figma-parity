import { readFile } from "node:fs/promises";
import { compareElementStyle } from "../compare/styles.js";
import { collectStylesInPage, normaliseStyle } from "../drivers/web.js";
import { toNativeSelector } from "../drivers/react-native.js";
import { writeReport } from "../report/write.js";
import { ParitySession } from "../session.js";
/**
 * The agent-facing API behind the MCP server. An agent (Claude in Chrome, the
 * built-in browser, or any browser-capable agent) drives the real app; this
 * side supplies the design truth and does the measuring and bookkeeping.
 */
export class ParityAgentApi {
    session;
    constructor(session) {
        this.session = session;
    }
    static async create(config) {
        return new ParityAgentApi(await ParitySession.create(config));
    }
    get config() {
        return this.session.config;
    }
    requireScreen(name) {
        const s = this.session.screen(name);
        if (!s) {
            const names = this.session.design.screens.map((x) => x.name).slice(0, 30);
            throw new Error(`No screen "${name}". Known screens: ${names.join(", ")}`);
        }
        return s;
    }
    openUrl(screen) {
        const t = this.session.target(screen);
        if (!t)
            return undefined;
        if (this.config.target.platform === "web" && t.route)
            return new URL(t.route, this.config.target.baseUrl).href;
        return t.deepLink;
    }
    overview() {
        const s = this.session;
        return {
            file: s.design.fileName,
            platform: this.config.target.platform,
            baseUrl: this.config.target.platform === "web" ? this.config.target.baseUrl : undefined,
            screens: s.design.screens.map((x) => {
                const t = s.target(x);
                return {
                    name: x.name,
                    id: x.id,
                    page: x.page,
                    size: `${x.size.width}x${x.size.height}`,
                    mapped: !!t && !t.skip,
                    open: this.openUrl(x),
                    marker: t?.marker,
                    elementsWithSelectors: s.candidates(x).length,
                    openComments: x.comments.length,
                };
            }),
            flows: s.graph.flows.map((f) => ({ name: f.name, start: s.graph.screens[f.start]?.name, links: f.edges.length })),
            prototypeLinks: s.graph.edges.length,
            workflow: [
                "For each mapped screen: set the browser viewport to the frame size, open `open`, then:",
                "  1. parity_style_probe → run the returned JavaScript in the page → parity_submit_styles with its result.",
                "  2. parity_design_image to see the design; compare it with the page and record anything off with parity_record_review.",
                "  3. If you can save a PNG screenshot to disk, parity_compare_screenshot gives a pixel diff.",
                "Then parity_flow_steps → perform each step in the browser → parity_record_flow.",
                "Finally parity_write_report.",
            ],
        };
    }
    screenSpec(name) {
        const screen = this.requireScreen(name);
        const t = this.session.target(screen);
        return {
            name: screen.name,
            id: screen.id,
            size: screen.size,
            background: screen.background,
            open: this.openUrl(screen),
            marker: t?.marker,
            elements: this.session.candidates(screen).map(({ el, sel }) => ({
                name: el.name,
                path: el.path,
                type: el.type,
                selector: this.config.target.platform === "web" ? sel.selector : toNativeSelector(sel.selector),
                box: el.box,
                fill: el.fill,
                text: el.text,
                typography: el.typography,
                radius: el.radius,
                tokens: el.styleNames,
            })),
            openComments: screen.comments.map((c) => ({ by: c.user?.handle, message: c.message })),
            devResources: screen.devResources.map((d) => ({ name: d.name, url: d.url })),
        };
    }
    async designImage(name, scale = 1) {
        const screen = this.requireScreen(name);
        const png = await this.session.designRender(screen, scale);
        if (!png)
            throw new Error(`Figma returned no render for "${screen.name}".`);
        return png;
    }
    /** JavaScript to evaluate in the page. Returns a JSON string to pass to submitStyles. */
    styleProbe(name) {
        const screen = this.requireScreen(name);
        if (this.config.target.platform !== "web")
            throw new Error("Style probes are for web targets; use screenSpec boxes on native.");
        const selectors = [...new Set(this.session.candidates(screen).map((c) => c.sel.selector))];
        const script = `(() => { const collect = ${collectStylesInPage.toString()};
  return JSON.stringify({ url: location.href, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, styles: collect(${JSON.stringify(selectors)}) });
})()`;
        return { script, selectors: selectors.length };
    }
    submitStyles(name, probeResult) {
        const screen = this.requireScreen(name);
        const parsed = (typeof probeResult === "string" ? JSON.parse(probeResult) : probeResult);
        const unitScale = parsed.viewport?.width ? screen.size.width / parsed.viewport.width : 1;
        const elements = [];
        const mismatches = [];
        const candidates = this.session.candidates(screen);
        for (const { el, sel } of candidates) {
            const raw = parsed.styles?.[sel.selector];
            if (!raw) {
                if (sel.source === "explicit") {
                    elements.push({ elementId: el.id, name: el.name, path: el.path, selector: sel.selector, source: sel.source, found: false, mismatches: 1 });
                    mismatches.push({ elementId: el.id, name: el.name, path: el.path, selector: sel.selector, property: "missing", expected: "present", actual: "not found" });
                }
                continue;
            }
            const m = compareElementStyle(el, sel.selector, normaliseStyle(raw), {
                sizeTolerance: this.config.thresholds.size,
                colorTolerance: this.config.thresholds.color,
                unitScale,
                rich: true,
            });
            elements.push({ elementId: el.id, name: el.name, path: el.path, selector: sel.selector, source: sel.source, found: true, mismatches: m.length });
            mismatches.push(...m);
        }
        const result = {
            status: (mismatches.length ? "fail" : elements.length ? "pass" : "skipped"),
            checked: candidates.length,
            found: elements.filter((e) => e.found).length,
            elements,
            mismatches,
        };
        this.session.recordStyles(screen, result);
        const res = this.session.screens.get(screen.id);
        if (parsed.url)
            res.location = parsed.url;
        if (parsed.viewport && Math.abs(parsed.viewport.width - screen.size.width) > 1) {
            res.error = `Measured at ${parsed.viewport.width}px wide; the frame is ${screen.size.width}px. Resize the viewport for exact positions.`;
        }
        return {
            status: result.status,
            found: `${result.found}/${result.checked}`,
            mismatches: mismatches.slice(0, 40).map((m) => `${m.path} · ${m.property}: design ${m.expected}, app ${m.actual ?? "—"}`),
            truncated: mismatches.length > 40,
        };
    }
    async compareScreenshot(name, input) {
        const screen = this.requireScreen(name);
        const png = input.path ? await readFile(input.path) : input.base64 ? Buffer.from(input.base64.replace(/^data:image\/png;base64,/, ""), "base64") : undefined;
        if (!png)
            throw new Error("Provide a PNG via path or base64.");
        if (png.readUInt32BE(0) !== 0x89504e47)
            throw new Error("Screenshot must be a PNG.");
        const widthPx = png.readUInt32BE(16);
        const viewportWidth = input.viewportWidth ?? screen.size.width;
        const v = await this.session.recordVisual(screen, png, { width: viewportWidth, scale: widthPx / viewportWidth });
        if (!v)
            throw new Error(this.session.screens.get(screen.id)?.error ?? "Visual comparison failed.");
        return { result: v, summary: { status: v.status, similarity: +(1 - v.mismatchRatio).toFixed(4), heightDelta: v.heightDelta, regions: v.regions.map((r) => `${r.path} (${Math.round(r.ratio * 100)}% differs)`) } };
    }
    flowSteps(screenName) {
        const s = this.session;
        const from = screenName ? this.requireScreen(screenName).id : undefined;
        return s.graph.edges
            .filter((e) => !from || e.from === from)
            .map((e) => {
            const fromScreen = s.screen(e.from);
            const to = e.to ? s.screen(e.to) : undefined;
            const sel = s.selectorFor(e.hotspot, fromScreen);
            return {
                edgeId: e.id,
                start: { screen: fromScreen.name, open: this.openUrl(fromScreen) },
                action: {
                    trigger: e.trigger,
                    kind: e.kind,
                    hotspot: e.hotspot.path,
                    selector: sel?.selector,
                    // Where it is in the design, so the agent can find it visually without a selector.
                    designPosition: { x: Math.round(e.hotspot.box.x), y: Math.round(e.hotspot.box.y), w: Math.round(e.hotspot.box.width), h: Math.round(e.hotspot.box.height) },
                    waitMs: e.timeoutMs,
                },
                expect: to
                    ? { screen: to.name, route: s.target(to)?.route, marker: s.target(to)?.marker }
                    : e.kind === "url"
                        ? { url: e.url }
                        : { returnTo: e.kind === "back" ? "previous screen" : "underlying screen (overlay closes)" },
                recorded: s.flows.get(e.id)?.status,
            };
        });
    }
    recordFlow(edgeId, status, actual, note) {
        const s = this.session;
        const edge = s.graph.edges.find((e) => e.id === edgeId);
        if (!edge)
            throw new Error(`Unknown edge ${edgeId}. Use parity_flow_steps for ids.`);
        const fromName = s.graph.screens[edge.from]?.name ?? edge.from;
        const toName = edge.to ? s.graph.screens[edge.to]?.name : undefined;
        s.recordFlow({ edge, fromName, toName, status, method: "agent", actual, note });
        const done = s.flows.size;
        return { recorded: `${fromName} → ${toName ?? edge.kind}: ${status}`, progress: `${done}/${s.graph.edges.length}` };
    }
    recordReview(name, findings, by = "Claude") {
        const screen = this.requireScreen(name);
        this.session.recordReview(screen, by, findings);
        return { screen: screen.name, findings: findings.length };
    }
    async writeReport() {
        const c = this.config;
        const target = c.target.platform === "web" ? c.target.baseUrl : String(c.target.appium.capabilities["platformName"] ?? "device");
        const report = this.session.report("agent", target);
        const paths = await writeReport(report, this.session.outDir, c.output.inline);
        return { ...paths, summary: report.summary };
    }
}
