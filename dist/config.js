import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
const fn = () => z.custom((v) => typeof v === "function", { message: "expected a function" });
const route = z.union([z.string(), z.instanceof(RegExp)]);
/** How to open and recognise one Figma screen in the running app. */
export const screenTargetSchema = z.object({
    /** Web: path appended to baseUrl (":params" allowed for matching). */
    route: z.string().optional(),
    /** Web: how to recognise the screen by URL when it differs from `route` (e.g. /^\/orders\/\d+$/). */
    match: route.optional(),
    /** React Native: deep link used to open the screen directly. */
    deepLink: z.string().optional(),
    /** Selector (web) or testID/accessibility id (RN) that is only present on this screen. */
    marker: z.string().optional(),
    /** Selector to wait for before capturing. Defaults to `marker`. */
    ready: z.string().optional(),
    /** Selectors to hide before the screenshot (timestamps, avatars, live data). */
    mask: z.array(z.string()).optional(),
    /** Override the visual threshold for this screen (0..1 mismatch ratio). */
    visualThreshold: z.number().min(0).max(1).optional(),
    /** Skip this screen entirely. */
    skip: z.boolean().optional(),
});
const webTarget = z.object({
    platform: z.literal("web"),
    baseUrl: z.string().url(),
    browser: z.enum(["chromium", "firefox", "webkit"]).default("chromium"),
    headless: z.boolean().default(true),
    /** Playwright storage state file for logged-in runs. */
    storageState: z.string().optional(),
    /** Device scale factor; Figma frames are rendered at the same scale. */
    scale: z.number().min(0.5).max(4).default(1),
    /** Wait after navigation/actions for animations to settle (ms). */
    settleMs: z.number().default(400),
    /** Called once with the Playwright Page after launch (log in, seed data, ...). */
    setup: fn().optional(),
    /** Launch an existing Chrome/Chromium executable instead of Playwright's download. */
    executablePath: z.string().optional(),
    /** Extra browser launch arguments. */
    args: z.array(z.string()).optional(),
    /** Connect to an already-running browser over CDP (e.g. the one Claude drives). */
    cdpUrl: z.string().optional(),
});
const rnTarget = z.object({
    platform: z.literal("react-native"),
    appium: z.object({
        hostname: z.string().default("127.0.0.1"),
        port: z.number().default(4723),
        path: z.string().default("/"),
        capabilities: z.record(z.string(), z.unknown()),
    }),
    settleMs: z.number().default(800),
    /** Called once with the WebdriverIO browser after the session starts. */
    setup: fn().optional(),
    /** Height in dp of system chrome to crop from screenshots (status bar), when your Figma frames don't draw one. */
    statusBarHeight: z.number().optional(),
});
export const configSchema = z.object({
    figma: z.object({
        /** File key or a full Figma URL. */
        file: z.string(),
        /** Defaults to process.env.FIGMA_TOKEN. */
        token: z.string().optional(),
        /** Read from a snapshot dir instead of the API (see `figma-parity snapshot`). */
        snapshotDir: z.string().optional(),
        /** Only consider screens on these pages. */
        pages: z.array(z.string()).optional(),
    }),
    target: z.discriminatedUnion("platform", [webTarget, rnTarget]),
    /** Keyed by Figma screen name, slug or node id. Unlisted screens are reported as unmapped. */
    screens: z.record(z.string(), screenTargetSchema).default({}),
    /** Figma node name, path ("Header/Login") or id → selector / testID. */
    elements: z.record(z.string(), z.string()).default({}),
    /**
     * How to find elements that aren't in `elements`:
     *  - "testid": web [data-testid="<slug of node name>"], RN accessibility id ~<slug>
     *  - "none": only explicit mappings (plus positional taps for flows)
     */
    selectorStrategy: z.enum(["testid", "none"]).default("testid"),
    /** Tap hotspot coordinates when no selector is found (lower confidence, marked in report). */
    positionalFallback: z.boolean().default(true),
    checks: z
        .object({
        visual: z.boolean().default(true),
        styles: z.boolean().default(true),
        flows: z.boolean().default(true),
    })
        .default({ visual: true, styles: true, flows: true }),
    thresholds: z
        .object({
        /** Max fraction of differing pixels before a screen fails. */
        visual: z.number().min(0).max(1).default(0.03),
        /** pixelmatch per-pixel colour threshold (0..1). */
        pixel: z.number().min(0).max(1).default(0.12),
        /** Fraction of an element's area that must differ before it's called out. */
        region: z.number().min(0).max(1).default(0.08),
        /** px tolerance for sizes/positions/spacing. */
        size: z.number().min(0).default(2),
        /** Per-channel (0..255) tolerance for colours. */
        color: z.number().min(0).default(6),
        /** How long to wait for a flow destination (ms). */
        flowTimeoutMs: z.number().default(5000),
    })
        .default({ visual: 0.03, pixel: 0.12, region: 0.08, size: 2, color: 6, flowTimeoutMs: 5000 }),
    output: z
        .object({
        dir: z.string().default("figma-parity-report"),
        /** Embed images as data URIs for a single-file report. */
        inline: z.boolean().default(false),
    })
        .default({ dir: "figma-parity-report", inline: false }),
});
/** Identity helper for typed config files. */
export function defineConfig(config) {
    return config;
}
export function parseConfig(input) {
    const res = configSchema.safeParse(input);
    if (!res.success) {
        const issues = res.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
        throw new Error(`Invalid figma-parity config:\n${issues}`);
    }
    return res.data;
}
export const CONFIG_FILES = [
    "figma-parity.config.ts",
    "figma-parity.config.mts",
    "figma-parity.config.mjs",
    "figma-parity.config.js",
    "figma-parity.config.json",
];
/**
 * Loads a config file. .ts files rely on Node's built-in type stripping
 * (Node >= 22.18); on older Node use .mjs/.js or run through tsx.
 */
export async function loadConfig(path, cwd = process.cwd()) {
    const file = path ? resolve(cwd, path) : CONFIG_FILES.map((f) => resolve(cwd, f)).find(existsSync);
    if (!file || !existsSync(file)) {
        throw new Error(`No config found. Looked for ${path ?? CONFIG_FILES.join(", ")} in ${cwd}. Run \`figma-parity init\`.`);
    }
    let raw;
    if (file.endsWith(".json")) {
        const { readFile } = await import("node:fs/promises");
        raw = JSON.parse(await readFile(file, "utf8"));
    }
    else {
        try {
            const mod = await import(pathToFileURL(file).href);
            raw = mod.default ?? mod.config ?? mod;
        }
        catch (e) {
            if (/\.m?ts$/.test(file) && e instanceof Error && /Unknown file extension|ERR_UNKNOWN_FILE_EXTENSION/.test(e.message)) {
                throw new Error(`Can't load ${file}: this Node version can't import TypeScript. Use Node >= 22.18, rename to .mjs, or run via \`npx tsx\`.`);
            }
            throw e;
        }
    }
    return parseConfig(raw);
}
