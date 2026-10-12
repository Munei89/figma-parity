import type { Color, FigmaNode, Paint, Rect } from "./types.js";
export declare function channel(v: number): string;
/** Figma colour (0..1 floats) to #rrggbb or #rrggbbaa when not opaque. */
export declare function colorToHex(c: Color, opacity?: number): string;
/** The visible solid fill of a node, as hex, if it has exactly one meaningful one. */
export declare function solidFillHex(paints: Paint[] | undefined): string | undefined;
export declare function relativeRect(rect: Rect, origin: Rect): Rect;
export declare function walk(node: FigmaNode, visit: (node: FigmaNode, parents: FigmaNode[]) => void | false, parents?: FigmaNode[]): void;
/** A stable, human-friendly slug: "Checkout / Payment" -> "checkout-payment". */
export declare function slug(s: string): string;
