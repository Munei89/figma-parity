import type { ParityConfig } from "../config.js";
import type { FlowResult, ReviewFinding } from "../results.js";
import { ParitySession } from "../session.js";
/**
 * The agent-facing API behind the MCP server. An agent (Claude in Chrome, the
 * built-in browser, or any browser-capable agent) drives the real app; this
 * side supplies the design truth and does the measuring and bookkeeping.
 */
export declare class ParityAgentApi {
    readonly session: ParitySession;
    constructor(session: ParitySession);
    static create(config: ParityConfig): Promise<ParityAgentApi>;
    private get config();
    private requireScreen;
    private openUrl;
    overview(): {
        file: string;
        platform: "react-native" | "web";
        baseUrl: string | undefined;
        screens: {
            name: string;
            id: string;
            page: string;
            size: string;
            mapped: boolean;
            open: string | undefined;
            marker: string | undefined;
            elementsWithSelectors: number;
            openComments: number;
        }[];
        flows: {
            name: string;
            start: string | undefined;
            links: number;
        }[];
        prototypeLinks: number;
        workflow: string[];
    };
    screenSpec(name: string): {
        name: string;
        id: string;
        size: {
            width: number;
            height: number;
        };
        background: string | undefined;
        open: string | undefined;
        marker: string | undefined;
        elements: {
            name: string;
            path: string;
            type: string;
            selector: string;
            box: import("../index.js").Rect;
            fill: string | undefined;
            text: string | undefined;
            typography: Pick<import("../index.js").TypeStyle, "fontFamily" | "fontSize" | "fontWeight" | "letterSpacing" | "lineHeightPx"> | undefined;
            radius: number | [number, number, number, number] | undefined;
            tokens: Record<string, string> | undefined;
        }[];
        openComments: {
            by: string | undefined;
            message: string;
        }[];
        devResources: {
            name: string;
            url: string;
        }[];
    };
    designImage(name: string, scale?: number): Promise<Buffer>;
    /** JavaScript to evaluate in the page. Returns a JSON string to pass to submitStyles. */
    styleProbe(name: string): {
        script: string;
        selectors: number;
    };
    submitStyles(name: string, probeResult: string | object): {
        status: "fail" | "pass" | "skipped";
        found: string;
        mismatches: string[];
        truncated: boolean;
    };
    compareScreenshot(name: string, input: {
        path?: string;
        base64?: string;
        viewportWidth?: number;
    }): Promise<{
        result: import("../index.js").VisualResult;
        summary: {
            status: "fail" | "pass";
            similarity: number;
            heightDelta: number;
            regions: string[];
        };
    }>;
    flowSteps(screenName?: string): {
        edgeId: string;
        start: {
            screen: string;
            open: string | undefined;
        };
        action: {
            trigger: string;
            kind: import("../index.js").EdgeKind;
            hotspot: string;
            selector: string | undefined;
            designPosition: {
                x: number;
                y: number;
                w: number;
                h: number;
            };
            waitMs: number | undefined;
        };
        expect: {
            screen: string;
            route: string | undefined;
            marker: string | undefined;
            url?: undefined;
            returnTo?: undefined;
        } | {
            screen?: undefined;
            route?: undefined;
            marker?: undefined;
            url: string | undefined;
            returnTo?: undefined;
        } | {
            screen?: undefined;
            route?: undefined;
            marker?: undefined;
            url?: undefined;
            returnTo: string;
        };
        recorded: import("../results.js").FlowStatus | undefined;
    }[];
    recordFlow(edgeId: string, status: FlowResult["status"], actual?: string, note?: string): {
        recorded: string;
        progress: string;
    };
    recordReview(name: string, findings: ReviewFinding[], by?: string): {
        screen: string;
        findings: number;
    };
    writeReport(): Promise<{
        htmlPath: string;
        jsonPath: string;
        summary: {
            screens: {
                total: number;
                pass: number;
                fail: number;
                unmapped: number;
                other: number;
            };
            visual: {
                averageSimilarity: number | null;
            };
            styles: {
                checked: number;
                mismatches: number;
            };
            flows: {
                total: number;
                pass: number;
                fail: number;
                blocked: number;
                skipped: number;
            };
            score: number | null;
        };
    }>;
}
