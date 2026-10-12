import { cssColorToHex } from "./color.js";
import { hasParams, matchesPath } from "./routes.js";
import { InteractionError } from "./types.js";
export { InteractionError };
const px = (v) => {
    const n = parseFloat(v ?? "");
    return Number.isFinite(n) ? n : undefined;
};
export function normaliseStyle(raw) {
    const family = raw.fontFamily.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
    const textish = raw.text.trim().length > 0;
    return {
        box: raw.box,
        text: textish ? raw.text.replace(/\s+/g, " ").trim() : undefined,
        color: cssColorToHex(raw.color),
        backgroundColor: cssColorToHex(raw.backgroundColor),
        fontFamily: family,
        fontWeight: px(raw.fontWeight),
        fontSize: px(raw.fontSize),
        lineHeight: raw.lineHeight === "normal" ? undefined : px(raw.lineHeight),
        letterSpacing: raw.letterSpacing === "normal" ? 0 : px(raw.letterSpacing),
        borderRadius: raw.radii.map((r) => px(r) ?? 0),
        borderColor: px(raw.borderWidth) ? cssColorToHex(raw.borderColor) : undefined,
        borderWidth: px(raw.borderWidth),
        padding: {
            top: px(raw.padding[0]) ?? 0,
            right: px(raw.padding[1]) ?? 0,
            bottom: px(raw.padding[2]) ?? 0,
            left: px(raw.padding[3]) ?? 0,
        },
        gap: raw.gap === "normal" ? undefined : px(raw.gap),
        opacity: px(raw.opacity),
    };
}
/**
 * Runs in the page. Exported as a string too so the MCP server can hand it to
 * Claude's browser (javascript tool) and get identical measurements back.
 */
export function collectStylesInPage(selectors) {
    const out = {};
    for (const sel of selectors) {
        let el = null;
        try {
            el = document.querySelector(sel);
        }
        catch {
            el = null;
        }
        if (!el) {
            out[sel] = null;
            continue;
        }
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        // Own text only, so a card's style isn't judged against its children's copy.
        let text = "";
        el.childNodes.forEach((n) => {
            if (n.nodeType === 3)
                text += n.textContent ?? "";
        });
        if (!text.trim() && el.children.length === 0)
            text = el.innerText ?? "";
        out[sel] = {
            box: { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height },
            text,
            color: cs.color,
            backgroundColor: cs.backgroundColor,
            fontFamily: cs.fontFamily,
            fontWeight: cs.fontWeight,
            fontSize: cs.fontSize,
            lineHeight: cs.lineHeight,
            letterSpacing: cs.letterSpacing,
            radii: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius],
            borderColor: cs.borderTopColor,
            borderWidth: cs.borderTopStyle === "none" ? "0" : cs.borderTopWidth,
            padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft],
            gap: cs.rowGap,
            opacity: cs.opacity,
        };
    }
    return out;
}
export class WebDriver {
    cfg;
    platform = "web";
    richStyles = true;
    browser;
    context;
    _page;
    ownsBrowser = true;
    constructor(cfg) {
        this.cfg = cfg;
    }
    get page() {
        if (!this._page)
            throw new Error("WebDriver not started");
        return this._page;
    }
    async start() {
        let pw;
        try {
            pw = await import("playwright");
        }
        catch {
            throw new Error("The web target needs Playwright: npm i -D playwright && npx playwright install chromium");
        }
        const type = pw[this.cfg.browser];
        if (this.cfg.cdpUrl) {
            this.browser = await pw.chromium.connectOverCDP(this.cfg.cdpUrl);
            this.ownsBrowser = false;
            this.context = this.browser.contexts()[0] ?? (await this.browser.newContext());
        }
        else {
            this.browser = await type.launch({ headless: this.cfg.headless, executablePath: this.cfg.executablePath, args: this.cfg.args });
            this.context = await this.browser.newContext({
                deviceScaleFactor: this.cfg.scale,
                storageState: this.cfg.storageState,
                reducedMotion: "reduce",
            });
        }
        this._page = await this.context.newPage();
        if (this.cfg.setup)
            await this.cfg.setup(this._page);
    }
    async stop() {
        if (this.ownsBrowser)
            await this.browser?.close();
        else
            await this._page?.close().catch(() => { });
    }
    async prepareViewport(size) {
        // Short frames are "a viewport"; long frames are scrolling pages captured full-height.
        const height = size.height <= 1400 ? Math.round(size.height) : 900;
        await this.page.setViewportSize({ width: Math.round(size.width), height });
    }
    async viewport() {
        const v = this.page.viewportSize() ?? { width: 1280, height: 720 };
        const scale = await this.page.evaluate(() => devicePixelRatio);
        return { ...v, scale };
    }
    async open(target) {
        if (!target.route || hasParams(target.route))
            return false;
        await this.page.goto(new URL(target.route, this.cfg.baseUrl).href, { waitUntil: "load" });
        await this.settle();
        return true;
    }
    async isShowing(target) {
        const checks = [];
        const pattern = target.match ?? target.route;
        if (pattern)
            checks.push(matchesPath(new URL(this.page.url()).pathname, pattern));
        if (target.marker)
            checks.push(await this.page.locator(target.marker).first().isVisible().catch(() => false));
        return checks.length > 0 && checks.every(Boolean);
    }
    async waitReady(target, timeoutMs) {
        const sel = target.ready ?? target.marker;
        if (sel)
            await this.page.locator(sel).first().waitFor({ state: "visible", timeout: timeoutMs }).catch(() => { });
        // Fonts change metrics; wait for them before measuring.
        await this.page.evaluate(() => document.fonts?.ready.then(() => undefined)).catch(() => { });
    }
    async screenshot() {
        return this.page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" });
    }
    async exists(selector) {
        return (await this.page.locator(selector).count().catch(() => 0)) > 0;
    }
    async styles(selectors) {
        const raw = await this.page.evaluate(collectStylesInPage, selectors);
        return new Map(selectors.map((s) => [s, raw[s] ? normaliseStyle(raw[s]) : null]));
    }
    async tap(selector) {
        try {
            await this.page.locator(selector).first().click({ timeout: 4000 });
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const blocker = msg.match(/<([^>]+)>[^\n]*intercepts pointer events/)?.[1];
            if (blocker)
                throw new InteractionError(`Can't click ${selector}: <${blocker.slice(0, 80)}> covers it, so a user can't tap it either.`);
            if (/not visible|not enabled|disabled/i.test(msg))
                throw new InteractionError(`Can't click ${selector}: it isn't visible or enabled.`);
            throw new InteractionError(`Can't click ${selector}: ${msg.split("\n")[0]}`);
        }
    }
    async tapPoint(x, y) {
        const v = this.page.viewportSize() ?? { width: 1280, height: 720 };
        const scrollY = Math.max(0, y - v.height / 2);
        await this.page.evaluate((top) => window.scrollTo(0, top), scrollY);
        const actual = await this.page.evaluate(() => ({ x: scrollX, y: scrollY }));
        await this.page.mouse.click(x - actual.x, y - actual.y);
    }
    async hover(selector) {
        await this.page.locator(selector).first().hover({ timeout: 5000 });
        return true;
    }
    async back() {
        await this.page.goBack({ waitUntil: "load" }).catch(() => { });
    }
    async location() {
        return this.page.url();
    }
    async settle() {
        await this.page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => { });
        await this.page.waitForTimeout(this.cfg.settleMs);
    }
}
