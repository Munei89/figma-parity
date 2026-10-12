import type { FigmaSource } from "./client.js";
import type { Comment, DevResource, FileResponse } from "./types.js";
/**
 * Reads a snapshot written by `saveSnapshot`. Lets CI compare against a
 * pinned design version without a Figma token or rate limits.
 * Layout: file.json, comments.json, dev-resources.json, renders/<scale>x/<nodeId>.png
 */
export declare class SnapshotSource implements FigmaSource {
    private readonly dir;
    constructor(dir: string);
    getFile(): Promise<FileResponse>;
    getComments(): Promise<Comment[]>;
    getDevResources(): Promise<DevResource[]>;
    renderNodes(ids: string[], scale: number): Promise<Map<string, Buffer>>;
}
export declare function saveSnapshot(source: FigmaSource, dir: string, renderIds: string[], scale: number): Promise<void>;
