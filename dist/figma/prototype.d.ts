import type { FileResponse, Rect } from "./types.js";
export type EdgeKind = "navigate" | "overlay" | "swap" | "back" | "close" | "url";
export interface FlowEdge {
    /** Stable id: `${triggerNodeId}:${index}` */
    id: string;
    from: string;
    to: string | null;
    kind: EdgeKind;
    trigger: string;
    timeoutMs?: number;
    url?: string;
    /** The hotspot the user interacts with. */
    hotspot: {
        id: string;
        name: string;
        path: string;
        box: Rect;
    };
    transition?: string;
}
export interface Flow {
    name: string;
    start: string;
    /** Screens reachable from the start, in BFS order. */
    screens: string[];
    edges: string[];
}
export interface PrototypeGraph {
    screens: Record<string, {
        id: string;
        name: string;
    }>;
    edges: FlowEdge[];
    flows: Flow[];
    /** Edges whose destination couldn't be resolved to a screen (deleted frames etc). */
    dangling: FlowEdge[];
}
/**
 * Reads prototype wiring straight from the file: node `interactions`
 * (current API), legacy `transitionNodeID`, and each page's
 * `flowStartingPoints`. No prototype player automation needed.
 */
export declare function buildPrototypeGraph(file: FileResponse): PrototypeGraph;
/** Mermaid flowchart text, handy for docs and the report. */
export declare function graphToMermaid(g: PrototypeGraph): string;
