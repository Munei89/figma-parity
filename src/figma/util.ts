import type { Color, FigmaNode, Paint, Rect } from "./types.js";

export function channel(v: number): string {
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16)
    .padStart(2, "0");
}

/** Figma colour (0..1 floats) to #rrggbb or #rrggbbaa when not opaque. */
export function colorToHex(c: Color, opacity: number = 1): string {
  const a = (c.a ?? 1) * opacity;
  const base = `#${channel(c.r)}${channel(c.g)}${channel(c.b)}`;
  return a >= 0.999 ? base : `${base}${channel(a)}`;
}

/** The visible solid fill of a node, as hex, if it has exactly one meaningful one. */
export function solidFillHex(paints: Paint[] | undefined): string | undefined {
  const visible = (paints ?? []).filter((p) => p.visible !== false);
  const top = visible[visible.length - 1];
  if (!top || top.type !== "SOLID" || !top.color) return undefined;
  return colorToHex(top.color, top.opacity ?? 1);
}

export function relativeRect(rect: Rect, origin: Rect): Rect {
  return { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height };
}

export function walk(
  node: FigmaNode,
  visit: (node: FigmaNode, parents: FigmaNode[]) => void | false,
  parents: FigmaNode[] = []
): void {
  if (visit(node, parents) === false) return;
  for (const child of node.children ?? []) walk(child, visit, [...parents, node]);
}

/** A stable, human-friendly slug: "Checkout / Payment" -> "checkout-payment". */
export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
