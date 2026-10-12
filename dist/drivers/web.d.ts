import type { Page } from "playwright";
import type { ScreenTarget, WebTargetConfig } from "../config.js";
import { InteractionError, type AppStyle, type Driver, type Viewport } from "./types.js";
export { InteractionError };
interface RawStyle {
    box: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    text: string;
    color: string;
    backgroundColor: string;
    fontFamily: string;
    fontWeight: string;
    fontSize: string;
    lineHeight: string;
    letterSpacing: string;
    radii: string[];
    borderColor: string;
    borderWidth: string;
    padding: string[];
    gap: string;
    opacity: string;
}
export declare function normaliseStyle(raw: RawStyle): AppStyle;
/**
 * Runs in the page. Exported as a string too so the MCP server can hand it to
 * Claude's browser (javascript tool) and get identical measurements back.
 */
export declare function collectStylesInPage(selectors: string[]): Record<string, RawStyle | null>;
export declare class WebDriver implements Driver {
    private readonly cfg;
    readonly platform: "web";
    readonly richStyles = true;
    private browser?;
    private context?;
    private _page?;
    private ownsBrowser;
    constructor(cfg: WebTargetConfig);
    get page(): Page;
    start(): Promise<void>;
    stop(): Promise<void>;
    prepareViewport(size: {
        width: number;
        height: number;
    }): Promise<void>;
    viewport(): Promise<Viewport>;
    open(target: ScreenTarget): Promise<boolean>;
    isShowing(target: ScreenTarget): Promise<boolean>;
    waitReady(target: ScreenTarget, timeoutMs: number): Promise<void>;
    screenshot(): Promise<Buffer>;
    exists(selector: string): Promise<boolean>;
    styles(selectors: string[]): Promise<Map<string, AppStyle | null>>;
    tap(selector: string): Promise<void>;
    tapPoint(x: number, y: number): Promise<void>;
    hover(selector: string): Promise<boolean>;
    back(): Promise<void>;
    location(): Promise<string>;
    settle(): Promise<void>;
}
