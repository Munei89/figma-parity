import type { Comment, DevResource, FigmaNode, FileResponse } from "./types.js";
/**
 * Everything the rest of the library needs from Figma. The REST client below
 * implements it, and so can a snapshot on disk (for offline/CI runs) or an
 * adapter around an existing extractor.
 */
export interface FigmaSource {
    getFile(): Promise<FileResponse>;
    /** Returns PNG bytes for each node id, rendered at `scale`. */
    renderNodes(ids: string[], scale: number): Promise<Map<string, Buffer>>;
    getComments(): Promise<Comment[]>;
    getDevResources(): Promise<DevResource[]>;
}
export interface FigmaClientOptions {
    token: string;
    fileKey: string;
    /** Override for testing or proxies. */
    baseUrl?: string;
    fetch?: typeof fetch;
    /** Max retries on 429/5xx. */
    retries?: number;
}
export declare class FigmaApiError extends Error {
    readonly status: number;
    readonly endpoint: string;
    constructor(message: string, status: number, endpoint: string);
}
export declare class FigmaClient implements FigmaSource {
    private readonly opts;
    private readonly baseUrl;
    private readonly fetchImpl;
    private readonly retries;
    private fileCache?;
    constructor(opts: FigmaClientOptions);
    get fileKey(): string;
    private request;
    getFile(): Promise<FileResponse>;
    getNodes(ids: string[]): Promise<Record<string, FigmaNode>>;
    renderNodes(ids: string[], scale: number): Promise<Map<string, Buffer>>;
    getComments(): Promise<Comment[]>;
    getDevResources(): Promise<DevResource[]>;
}
/** Accepts a Figma URL or a bare key and returns the file key. */
export declare function parseFileKey(input: string): string;
