import type { StyleResult } from "./compare/styles.js";
import type { RegionDiff } from "./compare/visual.js";
import type { DesignTokens } from "./figma/extract.js";
import type { FlowEdge } from "./figma/prototype.js";
export type ScreenStatus = "pass" | "fail" | "unmapped" | "unreachable" | "error" | "skipped";
export type FlowStatus = "pass" | "fail" | "blocked" | "skipped" | "error";
export interface VisualSummary {
    status: "pass" | "fail";
    mismatchRatio: number;
    threshold: number;
    heightDelta: number;
    widthDelta: number;
    regions: RegionDiff[];
    /** Paths relative to the report directory (or data URIs when inlined). */
    images: {
        design: string;
        app: string;
        diff: string;
    };
}
export interface ReviewFinding {
    severity: "high" | "medium" | "low";
    area: string;
    issue: string;
    suggestion?: string;
}
export interface ScreenResult {
    id: string;
    name: string;
    slug: string;
    page: string;
    size: {
        width: number;
        height: number;
    };
    status: ScreenStatus;
    target?: {
        route?: string;
        deepLink?: string;
        marker?: string;
    };
    location?: string;
    visual?: VisualSummary;
    styles?: StyleResult;
    /** Qualitative review submitted by an agent (e.g. Claude via MCP). */
    review?: {
        by: string;
        findings: ReviewFinding[];
    };
    openComments: {
        author?: string;
        message: string;
        nodeId?: string;
    }[];
    devResources: {
        name: string;
        url: string;
        nodeId: string;
    }[];
    error?: string;
}
export interface FlowResult {
    edge: FlowEdge;
    fromName: string;
    toName?: string;
    status: FlowStatus;
    /** How the hotspot was driven. */
    method: "selector" | "positional" | "timeout" | "hover" | "back" | "agent" | "none";
    selector?: string;
    /** Where the app ended up. */
    actual?: string;
    note?: string;
    screenshot?: string;
}
export interface ParityReport {
    meta: {
        tool: string;
        version: string;
        generatedAt: string;
        figmaFile: string;
        figmaVersion: string;
        figmaLastModified: string;
        platform: "web" | "react-native" | "agent";
        target: string;
        durationMs: number;
    };
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
    screens: ScreenResult[];
    flows: FlowResult[];
    flowsByName: {
        name: string;
        start: string;
        edges: string[];
    }[];
    danglingEdges: FlowEdge[];
    mermaid: string;
    tokens: DesignTokens;
}
