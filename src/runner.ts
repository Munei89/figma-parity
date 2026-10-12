import { compareElementStyle } from "./compare/styles.js";
import { ReactNativeDriver } from "./drivers/react-native.js";
import { InteractionError, WebDriver, type Driver } from "./drivers/web.js";
import { writeReport } from "./report/write.js";
import { ParitySession } from "./session.js";
import type { ParityConfig } from "./config.js";
import type { FigmaSource } from "./figma/client.js";
import type { ScreenSpec } from "./figma/extract.js";
import type { FlowEdge } from "./figma/prototype.js";
import type { FlowResult, ParityReport } from "./results.js";

export interface RunOptions {
  /** Provide your own driver (custom runner, device farm, mocks). */
  driver?: Driver;
  source?: FigmaSource;
  cwd?: string;
  /** Only run these screens (names, slugs or ids). */
  only?: string[];
  onProgress?: (event: ProgressEvent) => void;
}

export type ProgressEvent =
  | { type: "design"; screens: number; edges: number }
  | { type: "screen"; name: string; status: string }
  | { type: "flow"; label: string; status: string }
  | { type: "done"; htmlPath: string; jsonPath: string };

export function createDriver(config: ParityConfig): Driver {
  return config.target.platform === "web" ? new WebDriver(config.target) : new ReactNativeDriver(config.target);
}

const TAP = new Set(["ON_CLICK", "ON_PRESS", "ON_TAP", "MOUSE_UP", "MOUSE_DOWN", "ON_MOUSE_UP", "ON_MOUSE_DOWN"]);
const HOVER = new Set(["ON_HOVER", "MOUSE_ENTER", "ON_MOUSE_ENTER"]);

function canRecognise(target: { marker?: string; route?: string; match?: string | RegExp }, platform: "web" | "react-native"): boolean {
  return platform === "web" ? !!(target.marker || target.match || target.route) : !!target.marker;
}

async function pollShowing(driver: Driver, target: { marker?: string; route?: string; match?: string | RegExp }, timeoutMs: number): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  do {
    if (await driver.isShowing(target)) return true;
    await new Promise((r) => setTimeout(r, 200));
  } while (Date.now() < until);
  return false;
}

export class ParityRunner {
  private unitScale = 1;

  constructor(readonly session: ParitySession, readonly driver: Driver) {}

  private get config() {
    return this.session.config;
  }

  async checkScreen(screen: ScreenSpec) {
    const res = this.session.baseResult(screen);
    const target = this.session.target(screen);
    if (!target || target.skip) return;

    try {
      await this.driver.prepareViewport(screen.size);
      const opened = await this.driver.open(target);
      if (!opened) {
        res.status = "unreachable";
        res.error =
          this.driver.platform === "web"
            ? "No static route to open this screen directly (route missing or has :params)."
            : "No deepLink to open this screen directly.";
        return;
      }

      await this.driver.waitReady(target, this.config.thresholds.flowTimeoutMs);
      res.location = await this.driver.location();

      const vp = await this.driver.viewport();
      this.unitScale = screen.size.width / vp.width;

      if (canRecognise(target, this.driver.platform) && !(await this.driver.isShowing(target))) {
        res.error = `Opened ${res.location} but the screen's marker/route didn't match.`;
      }

      // Masks: measured in the app, converted to frame units.
      let masks: Array<{ x: number; y: number; width: number; height: number }> = [];
      if (target.mask?.length) {
        const boxes = await this.driver.styles(target.mask);
        masks = [...boxes.values()]
          .filter((b): b is NonNullable<typeof b> => !!b)
          .map((b) => ({
            x: b.box.x * this.unitScale,
            y: b.box.y * this.unitScale,
            width: b.box.width * this.unitScale,
            height: b.box.height * this.unitScale,
          }));
      }

      if (this.config.checks.visual) {
        const png = await this.driver.screenshot();
        await this.session.recordVisual(screen, png, vp, masks);
      }

      if (this.config.checks.styles) {
        this.session.recordStyles(screen, await this.checkStyles(screen));
      }
    } catch (e) {
      res.status = "error";
      res.error = e instanceof Error ? e.message : String(e);
    }
  }

  private async checkStyles(screen: ScreenSpec) {
    const candidates = this.session.candidates(screen);
    if (!candidates.length) return { status: "skipped" as const, checked: 0, found: 0, elements: [], mismatches: [] };

    const styles = await this.driver.styles([...new Set(candidates.map((c) => c.sel.selector))]);
    const elements: any[] = [];
    const mismatches: any[] = [];

    for (const { el, sel } of candidates) {
      const app = styles.get(sel.selector);
      if (!app) {
        if (sel.source === "explicit") {
          elements.push({ elementId: el.id, name: el.name, path: el.path, selector: sel.selector, source: sel.source, found: false, mismatches: 1 });
          mismatches.push({ elementId: el.id, name: el.name, path: el.path, selector: sel.selector, property: "missing", expected: "present", actual: "not found" });
        }
        continue;
      }

      const m = compareElementStyle(el, sel.selector, app, {
        sizeTolerance: this.config.thresholds.size,
        colorTolerance: this.config.thresholds.color,
        unitScale: this.unitScale,
        rich: this.driver.richStyles,
      });

      elements.push({ elementId: el.id, name: el.name, path: el.path, selector: sel.selector, source: sel.source, found: true, mismatches: m.length });
      mismatches.push(...m);
    }

    return {
      status: (mismatches.length ? "fail" : elements.length ? "pass" : "skipped") as "fail" | "pass" | "skipped",
      checked: candidates.length,
      found: elements.filter((e: any) => e.found).length,
      elements,
      mismatches,
    };
  }

  /** Drives one hotspot. Returns how it was driven, a reason it couldn't be (skip), or a failed interaction. */
  private async perform(edge: FlowEdge, fromScreen: ScreenSpec): Promise<any> {
    try {
      return await this.performUnsafe(edge, fromScreen);
    } catch (e) {
      if (e instanceof InteractionError) return { failed: e.message, selector: this.session.selectorFor(edge.hotspot, fromScreen)?.selector };
      throw e;
    }
  }

  private async performUnsafe(edge: FlowEdge, fromScreen: ScreenSpec): Promise<any> {
    if (edge.trigger === "AFTER_TIMEOUT") {
      await new Promise((r) => setTimeout(r, (edge.timeoutMs ?? 0) + 500));
      return { method: "timeout" };
    }

    const sel = this.session.selectorFor(edge.hotspot, fromScreen);
    const found = sel && (await this.driver.exists(sel.selector));

    if (HOVER.has(edge.trigger)) {
      if (!found) return { skip: `Hover trigger needs a selector for "${edge.hotspot.name}".` };
      return (await this.driver.hover(sel!.selector)) ? { method: "hover", selector: sel!.selector } : { skip: "Hover isn't available on this platform." };
    }

    if (!TAP.has(edge.trigger)) return { skip: `Trigger ${edge.trigger} isn't automated.` };

    if (found) {
      await this.driver.tap(sel!.selector);
      return { method: "selector", selector: sel!.selector };
    }

    if (!this.config.positionalFallback) return { skip: `No selector found for hotspot "${edge.hotspot.path}".` };

    const vp = await this.driver.viewport();
    const scale = fromScreen.size.width / vp.width;
    const cx = (edge.hotspot.box.x + edge.hotspot.box.width / 2) / scale;
    const cy = (edge.hotspot.box.y + edge.hotspot.box.height / 2) / scale;
    await this.driver.tapPoint(cx, cy);
    return { method: "positional" };
  }

  async checkFlow(edge: FlowEdge): Promise<FlowResult> {
    const g = this.session.graph;
    const from = this.session.screen(edge.from)!;
    const fromTarget = this.session.target(from);
    const to = edge.to ? this.session.screen(edge.to) : undefined;
    const toTarget = to ? this.session.target(to) : undefined;
    const base: FlowResult = { edge, fromName: from.name, toName: to?.name ?? g.screens[edge.to ?? ""]?.name, status: "skipped", method: "none" };
    const timeout = this.config.thresholds.flowTimeoutMs;

    if (edge.kind === "url") return { ...base, note: `External link to ${edge.url}` };
    if (!fromTarget || fromTarget.skip) return { ...base, note: "Source screen isn't mapped." };

    // back/close: get to `from` via an incoming edge first, then return.
    let expected: { screen: ScreenSpec; target: NonNullable<typeof toTarget> } | undefined;
    let viaEdge: FlowEdge | undefined;
    if (edge.kind === "back" || edge.kind === "close") {
      viaEdge = g.edges.find((e) => {
        if (e.to !== edge.from || e.kind === "back" || e.kind === "close") return false;
        const p = this.session.screen(e.from);
        const t = p && this.session.target(p);
        return !!t && !t.skip && (edge.kind === "back" ? e.kind !== "overlay" : e.kind === "overlay");
      });
      if (!viaEdge) return { ...base, note: `No mapped screen leads here to test "${edge.kind}".` };
      const p = this.session.screen(viaEdge.from)!;
      expected = { screen: p, target: this.session.target(p)! };
      base.toName = p.name;
    } else {
      if (!to || !toTarget || toTarget.skip) return { ...base, note: "Destination screen isn't mapped." };
      if (!canRecognise(toTarget, this.driver.platform)) {
        return { ...base, note: `Add a marker${this.driver.platform === "web" ? " or route" : ""} for "${to.name}" so arrival can be detected.` };
      }
      expected = { screen: to, target: toTarget };
    }

    try {
      const startScreen = viaEdge ? this.session.screen(viaEdge.from)! : from;
      const startTarget = this.session.target(startScreen)!;
      await this.driver.prepareViewport(startScreen.size);
      if (!(await this.driver.open(startTarget))) {
        return { ...base, status: "blocked", note: `Can't open "${startScreen.name}" directly (no route/deepLink).` };
      }
      await this.driver.waitReady(startTarget, timeout);

      if (viaEdge) {
        const step = await this.perform(viaEdge, startScreen);
        if ("skip" in step) return { ...base, status: "blocked", note: `Couldn't reach "${from.name}": ${step.skip}` };
        if ("failed" in step) return { ...base, status: "blocked", note: `Couldn't reach "${from.name}": ${step.failed}` };
        await this.driver.settle();
        if (canRecognise(fromTarget, this.driver.platform) && !(await pollShowing(this.driver, fromTarget, timeout))) {
          return { ...base, status: "blocked", note: `Couldn't reach "${from.name}" via "${viaEdge.hotspot.name}".`, actual: await this.driver.location() };
        }
        if (edge.kind === "back" && !this.session.selectorFor(edge.hotspot, from)) {
          // A Figma "back" on a nav bar is often the OS/browser back; use it when the hotspot can't be found.
          await this.driver.back();
          await this.driver.settle();
          const ok = await pollShowing(this.driver, expected.target, timeout);
          return { ...base, status: ok ? "pass" : "fail", method: "back", actual: await this.driver.location() };
        }
      }

      const step = await this.perform(edge, from);
      if ("skip" in step) return { ...base, note: step.skip };
      if ("failed" in step) {
        const shot = await this.session.writeAsset(`flow-${edge.id.replace(/[^A-Za-z0-9]/g, "_")}.png`, await this.driver.screenshot());
        return { ...base, status: "fail", method: "selector", selector: step.selector, note: step.failed, actual: await this.driver.location(), screenshot: shot };
      }

      await this.driver.settle();
      const ok = await pollShowing(this.driver, expected.target, timeout);
      const result: FlowResult = { ...base, status: ok ? "pass" : "fail", method: step.method, selector: step.selector, actual: await this.driver.location() };

      if (!ok) {
        result.note =
          step.method === "positional"
            ? `Tapped where "${edge.hotspot.name}" is in the design; nothing led to "${expected.screen.name}". Map a selector to confirm.`
            : `Expected "${expected.screen.name}" after ${edge.trigger.toLowerCase().replace("on_", "")} on "${edge.hotspot.name}".`;
        result.screenshot = await this.session.writeAsset(`flow-${edge.id.replace(/[^A-Za-z0-9]/g, "_")}.png`, await this.driver.screenshot());
      }

      return result;
    } catch (e) {
      return { ...base, status: "error", note: e instanceof Error ? e.message : String(e) };
    }
  }
}

export async function runParity(config: ParityConfig, opts: RunOptions = {}) {
  const session = await ParitySession.create(config, { source: opts.source, cwd: opts.cwd });
  const emit = opts.onProgress ?? (() => {});
  emit({ type: "design", screens: session.design.screens.length, edges: session.graph.edges.length });

  const driver = opts.driver ?? createDriver(config);
  const runner = new ParityRunner(session, driver);
  const only = opts.only?.map((o) => session.screen(o)?.id).filter(Boolean);

  await driver.start();
  try {
    for (const screen of session.design.screens) {
      if (only?.length && !only.includes(screen.id)) continue;
      await runner.checkScreen(screen);
      emit({ type: "screen", name: screen.name, status: session.screens.get(screen.id)?.status ?? "?" });
    }

    if (config.checks.flows) {
      for (const edge of session.graph.edges) {
        if (only?.length && !only.includes(edge.from)) continue;
        const r = await runner.checkFlow(edge);
        session.recordFlow(r);
        emit({ type: "flow", label: `${r.fromName} → ${r.toName ?? edge.kind} (${edge.hotspot.name})`, status: r.status });
      }
    }
  } finally {
    await driver.stop();
  }

  const target = config.target.platform === "web" ? config.target.baseUrl : String(config.target.appium.capabilities["platformName"] ?? "device");
  const report = session.report(config.target.platform, target);
  const paths = await writeReport(report, session.outDir, config.output.inline);
  emit({ type: "done", ...paths });
  return { report, ...paths };
}
