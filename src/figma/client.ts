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

export class FigmaApiError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.status = status;
    this.endpoint = endpoint;
    this.name = "FigmaApiError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Figma REST API client implementing {@link FigmaSource}.
 * Handles rate limiting, retries, and caching.
 */
export class FigmaClient implements FigmaSource {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly retries: number;
  private fileCache?: Promise<FileResponse>;

  constructor(private readonly opts: FigmaClientOptions) {
    if (!opts.token) throw new Error("FigmaClient: a Figma access token is required (FIGMA_TOKEN).");
    if (!opts.fileKey) throw new Error("FigmaClient: a file key is required.");
    this.baseUrl = opts.baseUrl ?? "https://api.figma.com";
    this.fetchImpl = opts.fetch ?? fetch;
    this.retries = opts.retries ?? 4;
  }

  get fileKey() {
    return this.opts.fileKey;
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(url, { headers: { "X-Figma-Token": this.opts.token } });
      if (res.ok) return (await res.json()) as T;
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

  getFile(): Promise<FileResponse> {
    // Full tree including prototype interactions. Cached: the file is read by several stages.
    this.fileCache ??= this.request<FileResponse>(`/v1/files/${this.opts.fileKey}`);
    return this.fileCache;
  }

  async getNodes(ids: string[]): Promise<Record<string, FigmaNode>> {
    const res = await this.request<{ nodes: Record<string, { document: FigmaNode } | null> }>(
      `/v1/files/${this.opts.fileKey}/nodes?ids=${encodeURIComponent(ids.join(","))}`
    );
    const out: Record<string, FigmaNode> = {};
    for (const [id, n] of Object.entries(res.nodes)) if (n) out[id] = n.document;
    return out;
  }

  async renderNodes(ids: string[], scale: number): Promise<Map<string, Buffer>> {
    const out = new Map<string, Buffer>();
    // The images endpoint is expensive; batch modestly.
    for (let i = 0; i < ids.length; i += 20) {
      const batch = ids.slice(i, i + 20);
      const res = await this.request<{ err?: string; images: Record<string, string | null> }>(
        `/v1/images/${this.opts.fileKey}?ids=${encodeURIComponent(batch.join(","))}&format=png&scale=${scale}`
      );
      if (res.err) throw new FigmaApiError(`Figma render failed: ${res.err}`, 400, "/v1/images");
      await Promise.all(
        Object.entries(res.images).map(async ([id, url]) => {
          if (!url) return;
          const img = await this.fetchImpl(url);
          if (!img.ok) throw new FigmaApiError(`Downloading render for ${id} failed`, img.status, url);
          out.set(id, Buffer.from(await img.arrayBuffer()));
        })
      );
    }
    return out;
  }

  async getComments(): Promise<Comment[]> {
    const res = await this.request<{ comments: Comment[] }>(`/v1/files/${this.opts.fileKey}/comments`);
    return res.comments;
  }

  async getDevResources(): Promise<DevResource[]> {
    try {
      const res = await this.request<{ dev_resources: DevResource[] }>(`/v1/files/${this.opts.fileKey}/dev_resources`);
      return res.dev_resources;
    } catch (e) {
      // Needs a Dev Mode seat + file_dev_resources:read scope; treat as optional.
      if (e instanceof FigmaApiError && (e.status === 403 || e.status === 404)) return [];
      throw e;
    }
  }
}

/** Accepts a Figma URL or a bare key and returns the file key. */
/**
 * Extract the file key from a Figma URL or return the input if it's already a key.
 * @param input - Figma URL or file key
 * @returns File key (alphanumeric string)
 * @example
 * ```ts
 * parseFileKey("https://www.figma.com/design/AbC123/My-App") // "AbC123"
 * parseFileKey("AbC123") // "AbC123"
 * ```
 */
export function parseFileKey(input: string): string {
  const m = input.match(/figma\.com\/(?:file|design|proto|board)\/([A-Za-z0-9]+)/);
  return m?.[1] ?? input.trim();
}
