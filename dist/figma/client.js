export class FigmaApiError extends Error {
    status;
    endpoint;
    constructor(message, status, endpoint) {
        super(message);
        this.status = status;
        this.endpoint = endpoint;
        this.name = "FigmaApiError";
    }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export class FigmaClient {
    opts;
    baseUrl;
    fetchImpl;
    retries;
    fileCache;
    constructor(opts) {
        this.opts = opts;
        if (!opts.token)
            throw new Error("FigmaClient: a Figma access token is required (FIGMA_TOKEN).");
        if (!opts.fileKey)
            throw new Error("FigmaClient: a file key is required.");
        this.baseUrl = opts.baseUrl ?? "https://api.figma.com";
        this.fetchImpl = opts.fetch ?? fetch;
        this.retries = opts.retries ?? 4;
    }
    get fileKey() {
        return this.opts.fileKey;
    }
    async request(path) {
        const url = `${this.baseUrl}${path}`;
        for (let attempt = 0;; attempt++) {
            const res = await this.fetchImpl(url, { headers: { "X-Figma-Token": this.opts.token } });
            if (res.ok)
                return (await res.json());
            const retryable = res.status === 429 || res.status >= 500;
            if (retryable && attempt < this.retries) {
                const retryAfter = Number(res.headers.get("retry-after"));
                await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
                continue;
            }
            const body = await res.text().catch(() => "");
            throw new FigmaApiError(`Figma API ${res.status} on ${path}: ${body.slice(0, 300)}`, res.status, path);
        }
    }
    getFile() {
        // Full tree including prototype interactions. Cached: the file is read by several stages.
        this.fileCache ??= this.request(`/v1/files/${this.opts.fileKey}`);
        return this.fileCache;
    }
    async getNodes(ids) {
        const res = await this.request(`/v1/files/${this.opts.fileKey}/nodes?ids=${encodeURIComponent(ids.join(","))}`);
        const out = {};
        for (const [id, n] of Object.entries(res.nodes))
            if (n)
                out[id] = n.document;
        return out;
    }
    async renderNodes(ids, scale) {
        const out = new Map();
        // The images endpoint is expensive; batch modestly.
        for (let i = 0; i < ids.length; i += 20) {
            const batch = ids.slice(i, i + 20);
            const res = await this.request(`/v1/images/${this.opts.fileKey}?ids=${encodeURIComponent(batch.join(","))}&format=png&scale=${scale}`);
            if (res.err)
                throw new FigmaApiError(`Figma render failed: ${res.err}`, 400, "/v1/images");
            await Promise.all(Object.entries(res.images).map(async ([id, url]) => {
                if (!url)
                    return;
                const img = await this.fetchImpl(url);
                if (!img.ok)
                    throw new FigmaApiError(`Downloading render for ${id} failed`, img.status, url);
                out.set(id, Buffer.from(await img.arrayBuffer()));
            }));
        }
        return out;
    }
    async getComments() {
        const res = await this.request(`/v1/files/${this.opts.fileKey}/comments`);
        return res.comments;
    }
    async getDevResources() {
        try {
            const res = await this.request(`/v1/files/${this.opts.fileKey}/dev_resources`);
            return res.dev_resources;
        }
        catch (e) {
            // Needs a Dev Mode seat + file_dev_resources:read scope; treat as optional.
            if (e instanceof FigmaApiError && (e.status === 403 || e.status === 404))
                return [];
            throw e;
        }
    }
}
/** Accepts a Figma URL or a bare key and returns the file key. */
export function parseFileKey(input) {
    const m = input.match(/figma\.com\/(?:file|design|proto|board)\/([A-Za-z0-9]+)/);
    return m?.[1] ?? input.trim();
}
