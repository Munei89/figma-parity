import pixelmatch from "pixelmatch";
import type { ElementSpec } from "../figma/extract.js";
import type { Rect } from "../figma/types.js";
import { crop, decode, encode, fillRect, flatten, resize, strokeRect, type Image } from "./image.js";

export interface RegionDiff {
  elementId: string;
  name: string;
  path: string;
  /** In frame units (Figma px). */
  box: Rect;
  ratio: number;
  pixels: number;
}

export interface VisualResult {
  status: "pass" | "fail";
  mismatchRatio: number;
  mismatchPixels: number;
  /** Compared area in device pixels. */
  compared: { width: number; height: number };
  /** App height minus design height, in frame units (positive = page is longer than the design). */
  heightDelta: number;
  /** App width minus design width in frame units, before scaling the design to match. */
  widthDelta: number;
  regions: RegionDiff[];
  images: { design: Buffer; app: Buffer; diff: Buffer };
}

export interface VisualOptions {
  design: Buffer;
  app: Buffer;
  frame: { width: number; height: number };
  /** The app's viewport width in CSS px/dp, to report width deltas. */
  appWidth: number;
  elements: ElementSpec[];
  /** Areas to ignore, in frame units. */
  masks?: Rect[];
  threshold: number;
  pixelThreshold: number;
  regionThreshold: number;
}

const DIFF = [255, 0, 64] as const;

export function compareVisual(o: VisualOptions): VisualResult {
  let design = flatten(decode(o.design));
  let app = flatten(decode(o.app));

  // Line the design up with the app by width; heights then differ only by content.
  const k = app.width / o.frame.width; // device px per frame unit
  if (design.width !== app.width) {
    design = resize(design, app.width, Math.round(design.height * (app.width / design.width)));
  }

  const width = app.width;
  const height = Math.min(design.height, app.height);
  design = crop(design, 0, 0, width, height);
  const appCropped = crop(app, 0, 0, width, height);

  for (const m of o.masks ?? []) {
    fillRect(design, m.x * k, m.y * k, m.width * k, m.height * k, [128, 128, 128, 255]);
    fillRect(appCropped, m.x * k, m.y * k, m.width * k, m.height * k, [128, 128, 128, 255]);
  }

  const diff: Image = { width, height, data: Buffer.alloc(width * height * 4) };
  const mismatchPixels = pixelmatch(design.data, appCropped.data, diff.data, width, height, {
    threshold: o.pixelThreshold,
    includeAA: false,
    alpha: 0.15,
    diffColor: DIFF as unknown as [number, number, number],
    diffColorAlt: DIFF as unknown as [number, number, number],
    aaColor: [255, 200, 0],
  });

  // Summed-area table over "is diff pixel" for O(1) region lookups.
  const sat = new Uint32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (diff.data[i] === DIFF[0] && diff.data[i + 1] === DIFF[1] && diff.data[i + 2] === DIFF[2]) rowSum++;
      sat[(y + 1) * (width + 1) + (x + 1)] = sat[y * (width + 1) + (x + 1)] + rowSum;
    }
  }

  const sum = (x0: number, y0: number, x1: number, y1: number) => {
    x0 = Math.max(0, Math.min(width, Math.floor(x0)));
    x1 = Math.max(0, Math.min(width, Math.ceil(x1)));
    y0 = Math.max(0, Math.min(height, Math.floor(y0)));
    y1 = Math.max(0, Math.min(height, Math.ceil(y1)));
    if (x1 <= x0 || y1 <= y0) return { pixels: 0, area: 0 };
    const W = width + 1;
    const pixels = sat[y1 * W + x1] - sat[y0 * W + x1] - sat[y1 * W + x0] + sat[y0 * W + x0];
    return { pixels, area: (x1 - x0) * (y1 - y0) };
  };

  const flagged: RegionDiff[] = [];
  for (const el of o.elements) {
    const { pixels, area } = sum(el.box.x * k, el.box.y * k, (el.box.x + el.box.width) * k, (el.box.y + el.box.height) * k);
    if (area < 100 || pixels === 0) continue;
    const ratio = pixels / area;
    if (ratio >= o.regionThreshold) {
      flagged.push({ elementId: el.id, name: el.name, path: el.path, box: el.box, ratio, pixels });
    }
  }

  // Prefer the most specific element: drop a flagged parent when a flagged child explains it.
  const regions = flagged
    .filter((r) => !flagged.some((c) => c !== r && c.path.startsWith(`${r.path}/`)))
    .sort((a, b) => b.pixels - a.pixels)
    .slice(0, 15);

  for (const r of regions) strokeRect(diff, r.box.x * k, r.box.y * k, r.box.width * k, r.box.height * k, [255, 0, 64, 255]);

  const mismatchRatio = width * height ? mismatchPixels / (width * height) : 1;

  return {
    status: mismatchRatio <= o.threshold ? "pass" : "fail",
    mismatchRatio,
    mismatchPixels,
    compared: { width, height },
    heightDelta: Math.round(app.height / k - o.frame.height),
    widthDelta: Math.round(o.appWidth - o.frame.width),
    regions,
    images: { design: encode(design), app: encode(appCropped), diff: encode(diff) },
  };
}
