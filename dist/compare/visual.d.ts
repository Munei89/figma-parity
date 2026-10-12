import type { ElementSpec } from "../figma/extract.js";
import type { Rect } from "../figma/types.js";
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
    compared: {
        width: number;
        height: number;
    };
    /** App height minus design height, in frame units (positive = page is longer than the design). */
    heightDelta: number;
    /** App width minus design width in frame units, before scaling the design to match. */
    widthDelta: number;
    regions: RegionDiff[];
    images: {
        design: Buffer;
        app: Buffer;
        diff: Buffer;
    };
}
export interface VisualOptions {
    design: Buffer;
    app: Buffer;
    frame: {
        width: number;
        height: number;
    };
    /** The app's viewport width in CSS px/dp, to report width deltas. */
    appWidth: number;
    elements: ElementSpec[];
    /** Areas to ignore, in frame units. */
    masks?: Rect[];
    threshold: number;
    pixelThreshold: number;
    regionThreshold: number;
}
export declare function compareVisual(o: VisualOptions): VisualResult;
