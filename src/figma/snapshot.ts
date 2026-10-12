import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FigmaSource } from "./client.js";
import type { Comment, DevResource, FileResponse } from "./types.js";

const safe = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, "_");

/**
 * Reads a snapshot written by `saveSnapshot`. Lets CI compare against a
 * pinned design version without a Figma token or rate limits.
 * Layout: file.json, comments.json, dev-resources.json, renders/<scale>x/<nodeId>.png
 */
export class SnapshotSource implements FigmaSource {
  constructor(private readonly dir: string) {}

  async getFile(): Promise<FileResponse> {
    return JSON.parse(await readFile(join(this.dir, "file.json"), "utf8"));
  }

  async getComments(): Promise<Comment[]> {
    return JSON.parse(await readFile(join(this.dir, "comments.json"), "utf8").catch(() => "[]"));
  }

  async getDevResources(): Promise<DevResource[]> {
    return JSON.parse(await readFile(join(this.dir, "dev-resources.json"), "utf8").catch(() => "[]"));
  }

  async renderNodes(ids: string[], scale: number): Promise<Map<string, Buffer>> {
    const out = new Map<string, Buffer>();
    const dir = join(this.dir, "renders", `${scale}x`);
    const present = new Set(await readdir(dir).catch(() => []));
    for (const id of ids) {
      const name = `${safe(id)}.png`;
      if (present.has(name)) out.set(id, await readFile(join(dir, name)));
    }
    return out;
  }
}

export async function saveSnapshot(source: FigmaSource, dir: string, renderIds: string[], scale: number) {
  const [file, comments, dev] = await Promise.all([
    source.getFile(),
    source.getComments().catch(() => []),
    source.getDevResources().catch(() => []),
  ]);

  await mkdir(join(dir, "renders", `${scale}x`), { recursive: true });
  await writeFile(join(dir, "file.json"), JSON.stringify(file));
  await writeFile(join(dir, "comments.json"), JSON.stringify(comments, null, 2));
  await writeFile(join(dir, "dev-resources.json"), JSON.stringify(dev, null, 2));

  const renders = await source.renderNodes(renderIds, scale);
  for (const [id, png] of renders) await writeFile(join(dir, "renders", `${scale}x`, `${safe(id)}.png`), png);
}
