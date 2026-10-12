import type { ScreenTarget, RNTargetConfig } from "../config.js";
import { type AppStyle, type Driver, type Viewport } from "./types.js";
/**
 * React Native apps run through Appium (UiAutomator2 on Android, XCUITest on
 * iOS) via WebdriverIO. Plain names are treated as accessibility ids, which is
 * what RN's `testID` maps to on iOS and `accessibilityLabel`/`testID` (with
 * `resource-id` when using `testID` + `importantForAccessibility`) on Android.
 */
export declare function toNativeSelector(sel: string): string;
type WdioBrowser = Awaited<ReturnType<typeof import("webdriverio")["remote"]>>;
export declare class ReactNativeDriver implements Driver {
    private readonly cfg;
    readonly platform: "react-native";
    readonly richStyles = false;
    private _b?;
    /** Device units per dp: Android reports px, iOS reports points. */
    private unitsPerDp;
    private os;
    private cachedViewport?;
    constructor(cfg: RNTargetConfig);
    get browser(): WdioBrowser;
    start(): Promise<void>;
    stop(): Promise<void>;
    prepareViewport(): Promise<void>;
    viewport(): Promise<Viewport>;
    private capability;
    open(target: ScreenTarget): Promise<boolean>;
    isShowing(target: ScreenTarget): Promise<boolean>;
    waitReady(target: ScreenTarget, timeoutMs: number): Promise<void>;
    screenshot(): Promise<Buffer>;
    exists(selector: string): Promise<boolean>;
    styles(selectors: string[]): Promise<Map<string, AppStyle | null>>;
    tap(selector: string): Promise<void>;
    tapPoint(x: number, y: number): Promise<void>;
    hover(): Promise<boolean>;
    back(): Promise<void>;
    location(): Promise<string>;
    settle(): Promise<void>;
}
export {};
