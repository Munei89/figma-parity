import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const safe = (id) => id.replace(/[^A-Za-z0-9_-]/g, "_");
/**
 * Reads a snapshot written by `saveSnapshot`. Lets CI compare against a
 * pinned design version without a Figma token or rate limits.
 * Layout: file.json, comments.json, dev-resources.json, renders/<scale>x/<nodeId>.png
 */
export class SnapshotSource {
    dir;
    constructor(dir) {
        this.dir = dir;
    }
    async getFile() {
        return JSON.parse(await readFile(join(this.dir, "file.json"), "utf8"));
    }
    async getComments() {
        return JSON.parse(await readFile(join(this.dir, "comments.json"), "utf8").catch(() => "[]"));
    }
    async getDevResources() {
        return JSON.parse(await readFile(join(this.dir, "dev-resources.json"), "utf8").catch(() => "[]"));
    }
    async renderNodes(ids, scale) {
        const out = new Map();
        const dir = join(this.dir, "renders", `${scale}x`);
        const present = new Set(await readdir(dir).catch(() => []));
        for (const id of ids) {
            const name = `${safe(id)}.png`;
            if (present.has(name))
                out.set(id, await readFile(join(dir, name)));
        }
        return out;
    }
}
export async function saveSnapshot(source, dir, renderIds, scale) {
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
    for (const [id, png] of renders)
        await writeFile(join(dir, "renders", `${scale}x`, `${safe(id)}.png`), png);
}
