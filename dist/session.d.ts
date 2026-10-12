import type { ParityConfig, ScreenTarget } from "./config.js";
import { type StyleResult } from "./compare/styles.js";
import { type VisualResult } from "./compare/visual.js";
import { type FigmaSource } from "./figma/client.js";
import { type DesignExtract, type ElementSpec, type ScreenSpec } from "./figma/extract.js";
import { type PrototypeGraph } from "./figma/prototype.js";
import type { Rect } from "./figma/types.js";
import type { FlowResult, ParityReport, ReviewFinding, ScreenResult } from "./results.js";
export interface ResolvedSelector {
    selector: string;
    source: "explicit" | "testid";
}
export declare function createSource(config: ParityConfig): FigmaSource;
/**
 * Shared state for a parity run: the design, the prototype graph, how each
 * screen/element maps to the app, and accumulated results. Used by the
 * automated runner and by the MCP server (where an agent drives the app).
 */
export declare class ParitySession {
    readonly config: ParityConfig;
    readonly source: FigmaSource;
    readonly design: DesignExtract;
    readonly graph: PrototypeGraph;
    readonly outDir: string;
    readonly screens: Map<string, ScreenResult>;
    readonly flows: Map<string, FlowResult>;
    private renders;
    readonly startedAt: number;
    private constructor();
    static create(config: ParityConfig, opts?: {
        source?: FigmaSource;
        cwd?: string;
    }): Promise<ParitySession>;
    screen(idOrName: string): ScreenSpec | undefined;
    /** Looks a screen up in config.screens by node id, exact name, or slug. */
    target(screen: ScreenSpec): ScreenTarget | undefined;
    selectorFor(el: {
        id: string;
        name: string;
        path: string;
    }, screen: ScreenSpec): ResolvedSelector | undefined;
    /** Elements worth checking on a screen, with their selectors. */
    candidates(screen: ScreenSpec): {
        el: ElementSpec;
        sel: ResolvedSelector;
    }[];
    designRender(screen: ScreenSpec, scale: number): Promise<Buffer | undefined>;
    baseResult(screen: ScreenSpec): ScreenResult;
    writeAsset(name: string, png: Buffer): Promise<string>;
    /** Runs the pixel comparison for a screen against an app screenshot and records it. */
    recordVisual(screen: ScreenSpec, appPng: Buffer, appViewport: {
        width: number;
        scale: number;
    }, masks?: Rect[]): Promise<VisualResult | undefined>;
    recordStyles(screen: ScreenSpec, styles: StyleResult): void;
    recordReview(screen: ScreenSpec, by: string, findings: ReviewFinding[]): void;
    recordFlow(result: FlowResult): void;
    private updateStatus;
    report(platform: ParityReport["meta"]["platform"], target: string): ParityReport;
}
