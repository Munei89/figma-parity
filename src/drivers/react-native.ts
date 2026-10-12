import type { ScreenTarget, RNTargetConfig } from "../config.js";
import { cropTop } from "../compare/image.js";
import { InteractionError, type AppStyle, type Driver, type Viewport } from "./types.js";

/**
 * React Native apps run through Appium (UiAutomator2 on Android, XCUITest on
 * iOS) via WebdriverIO. Plain names are treated as accessibility ids, which is
 * what RN's `testID` maps to on iOS and `accessibilityLabel`/`testID` (with
 * `resource-id` when using `testID` + `importantForAccessibility`) on Android.
 */
export function toNativeSelector(sel: string): string {
  if (/^(~|\/\/|\(|id=|android=|-ios |-android )/.test(sel)) return sel;
  return `~${sel}`;
}

type WdioBrowser = Awaited<ReturnType<typeof import("webdriverio")["remote"]>>;

export class ReactNativeDriver implements Driver {
  readonly platform = "react-native" as const;
  readonly richStyles = false;
  private _b?: WdioBrowser;
  /** Device units per dp: Android reports px, iOS reports points. */
  private unitsPerDp = 1;
  private os: "ios" | "android" = "android";
  private cachedViewport?: Viewport;

  constructor(private readonly cfg: RNTargetConfig) {}

  get browser(): WdioBrowser {
    if (!this._b) throw new Error("ReactNativeDriver not started");
    return this._b;
  }

  async start() {
    let wdio: typeof import("webdriverio");
    try {
      wdio = await import("webdriverio");
    } catch {
      throw new Error("The react-native target needs WebdriverIO and a running Appium server: npm i -D webdriverio && npx appium");
    }

    const { capabilities, ...conn } = this.cfg.appium;
    this._b = await wdio.remote({ ...conn, capabilities: capabilities as any, logLevel: "warn" });

    const platformName = String(capabilities["platformName"] ?? "").toLowerCase();
    this.os = platformName.includes("ios") ? "ios" : "android";

    if (this.os === "android") {
      const density = await this.browser.getDisplayDensity().catch(() => 160);
      this.unitsPerDp = Number(density) / 160 || 1;
    }

    if (this.cfg.setup) await this.cfg.setup(this._b);
  }

  async stop() {
    await this._b?.deleteSession().catch(() => {});
  }

  async prepareViewport() {
    // The device decides. Design renders are scaled to the device width instead.
  }

  async viewport(): Promise<Viewport> {
    if (this.cachedViewport) return this.cachedViewport;
    const rect = await this.browser.getWindowRect();
    const width = rect.width / this.unitsPerDp;
    const height = rect.height / this.unitsPerDp - (this.cfg.statusBarHeight ?? 0);
    const shot = Buffer.from(await this.browser.takeScreenshot(), "base64");
    const shotWidth = shot.readUInt32BE(16); // PNG IHDR width
    this.cachedViewport = { width, height, scale: shotWidth / width };
    return this.cachedViewport;
  }

  private capability(key: string): string | undefined {
    const caps = this.cfg.appium.capabilities;
    const v = caps[key] ?? caps[`appium:${key}`];
    return typeof v === "string" ? v : undefined;
  }

  async open(target: ScreenTarget): Promise<boolean> {
    if (!target.deepLink) return false;
    if (this.os === "android") {
      await this.browser.execute("mobile: deepLink", { url: target.deepLink, package: this.capability("appPackage") });
    } else {
      await this.browser.execute("mobile: deepLink", { url: target.deepLink, bundleId: this.capability("bundleId") });
    }
    await this.settle();
    return true;
  }

  async isShowing(target: ScreenTarget): Promise<boolean> {
    if (!target.marker) return false;
    return this.browser.$(toNativeSelector(target.marker)).isDisplayed().catch(() => false);
  }

  async waitReady(target: ScreenTarget, timeoutMs: number) {
    const sel = target.ready ?? target.marker;
    if (sel) await this.browser.$(toNativeSelector(sel)).waitForDisplayed({ timeout: timeoutMs }).catch(() => {});
  }

  async screenshot(): Promise<Buffer> {
    const png = Buffer.from(await this.browser.takeScreenshot(), "base64");
    const crop = this.cfg.statusBarHeight ?? 0;
    if (!crop) return png;
    const v = await this.viewport();
    return cropTop(png, Math.round(crop * v.scale));
  }

  async exists(selector: string): Promise<boolean> {
    return this.browser.$(toNativeSelector(selector)).isExisting().catch(() => false);
  }

  async styles(selectors: string[]): Promise<Map<string, AppStyle | null>> {
    const out = new Map<string, AppStyle | null>();
    const top = this.cfg.statusBarHeight ?? 0;
    for (const sel of selectors) {
      const el = this.browser.$(toNativeSelector(sel));
      if (!(await el.isExisting().catch(() => false))) {
        out.set(sel, null);
        continue;
      }
      const r = await this.browser.getElementRect(await el.elementId);
      const text = (await el.getText().catch(() => "")).trim();
      out.set(sel, {
        box: {
          x: r.x / this.unitsPerDp,
          y: r.y / this.unitsPerDp - top,
          width: r.width / this.unitsPerDp,
          height: r.height / this.unitsPerDp,
        },
        text: text || undefined,
      });
    }
    return out;
  }

  async tap(selector: string) {
    try {
      await this.browser.$(toNativeSelector(selector)).click();
    } catch (e) {
      throw new InteractionError(`Can't tap ${selector}: ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`);
    }
  }

  async tapPoint(x: number, y: number) {
    const top = this.cfg.statusBarHeight ?? 0;
    await this.browser
      .action("pointer", { parameters: { pointerType: "touch" } })
      .move({ x: Math.round(x * this.unitsPerDp), y: Math.round((y + top) * this.unitsPerDp) })
      .down()
      .pause(60)
      .up()
      .perform();
  }

  async hover(): Promise<boolean> {
    return false; // no hover on touch devices
  }

  async back() {
    await this.browser.back();
  }

  async location(): Promise<string> {
    if (this.os === "android") {
      const act = await this.browser.getCurrentActivity().catch(() => "?");
      return `android:${act}`;
    }
    return `ios:${this.capability("bundleId") ?? "app"}`;
  }

  async settle() {
    await this.browser.pause(this.cfg.settleMs);
  }
}
