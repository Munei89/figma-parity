import type { ParityConfig } from "./config.js";
import type { Driver } from "./drivers/types.js";
import type { FigmaSource } from "./figma/client.js";
import type { ScreenSpec } from "./figma/extract.js";
import type { FlowEdge } from "./figma/prototype.js";
import type { FlowResult, ParityReport } from "./results.js";
import { ParitySession } from "./session.js";
export interface RunOptions {
    /** Provide your own driver (custom runner, device farm, mocks). */
    driver?: Driver;
    source?: FigmaSource;
    cwd?: string;
    /** Only run these screens (names, slugs or ids). */
    only?: string[];
    onProgress?: (event: ProgressEvent) => void;
}
export type ProgressEvent = {
    type: "design";
    screens: number;
    edges: number;
} | {
    type: "screen";
    name: string;
    status: string;
} | {
    type: "flow";
    label: string;
    status: string;
} | {
    type: "done";
    htmlPath: string;
    jsonPath: string;
};
export declare function createDriver(config: ParityConfig): Driver;
export declare class ParityRunner {
    readonly session: ParitySession;
    readonly driver: Driver;
    private unitScale;
    constructor(session: ParitySession, driver: Driver);
    private get config();
    checkScreen(screen: ScreenSpec): Promise<void>;
    private checkStyles;
    /** Drives one hotspot. Returns how it was driven, a reason it couldn't be (skip), or a failed interaction. */
    private perform;
    private performUnsafe;
    checkFlow(edge: FlowEdge): Promise<FlowResult>;
}
export declare function runParity(config: ParityConfig, opts?: RunOptions): Promise<{
    report: ParityReport;
    htmlPath: string;
    jsonPath: string;
}>;
