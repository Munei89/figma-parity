import type { AppStyle } from "../drivers/types.js";
import { colorDistance } from "../drivers/color.js";
import type { ElementSpec } from "../figma/extract.js";

export interface StyleMismatch {
  elementId: string;
  name: string;
  path: string;
  selector: string;
  property: string;
  expected: string | number;
  actual: string | number | undefined;
  /** Figma style/token the designer used, when known, e.g. "Brand/Primary". */
  token?: string;
}

export interface ElementCheck {
  elementId: string;
  name: string;
  path: string;
  selector: string;
  source: "explicit" | "testid";
  found: boolean;
  mismatches: number;
}

export interface StyleResult {
  status: "pass" | "fail" | "skipped";
  checked: number;
  found: number;
  elements: ElementCheck[];
  mismatches: StyleMismatch[];
}

export interface StyleOptions {
  sizeTolerance: number;
  colorTolerance: number;
  /** Frame units per app unit (frame width / viewport width). */
  unitScale: number;
  /** Rich computed styles available (web) or only box + text (native). */
  rich: boolean;
}

const near = (a: number | undefined, b: number | undefined, tol: number) =>
  a === undefined || b === undefined ? true : Math.abs(a - b) <= tol;
const round = (n: number) => Math.round(n * 100) / 100;
const normText = (s: string) => s.replace(/\s+/g, " ").trim();

export function compareElementStyle(el: ElementSpec, selector: string, app: AppStyle, o: StyleOptions): StyleMismatch[] {
  const out: StyleMismatch[] = [];
  const add = (property: string, expected: string | number, actual: string | number | undefined, token?: string) =>
    out.push({ elementId: el.id, name: el.name, path: el.path, selector, property, expected, actual, token });

  const s = o.unitScale;
  const box = { x: app.box.x * s, y: app.box.y * s, width: app.box.width * s, height: app.box.height * s };
  const tol = o.sizeTolerance;
  const isText = el.type === "TEXT";

  if (!near(box.x, el.box.x, tol * 2)) add("x", round(el.box.x), round(box.x));
  if (!near(box.y, el.box.y, tol * 2)) add("y", round(el.box.y), round(box.y));

  if (!isText) {
    if (!near(box.width, el.box.width, tol)) add("width", round(el.box.width), round(box.width));
    if (!near(box.height, el.box.height, tol)) add("height", round(el.box.height), round(box.height));
  }

  if (isText && el.text !== undefined && app.text !== undefined) {
    const design = normText(el.text);
    const actual = normText(app.text);
    if (design.toLowerCase() !== actual.toLowerCase()) add("text", design, actual);
  }

  if (!o.rich) return out;

  if (isText && el.typography) {
    const t = el.typography;
    const token = el.styleNames?.text;
    if (t.fontSize !== undefined && !near(app.fontSize, t.fontSize, 0.5)) add("fontSize", t.fontSize, app.fontSize, token);
    if (t.fontWeight !== undefined && app.fontWeight !== undefined && t.fontWeight !== app.fontWeight)
      add("fontWeight", t.fontWeight, app.fontWeight, token);
    if (t.lineHeightPx !== undefined && app.lineHeight !== undefined && !near(app.lineHeight, t.lineHeightPx, 1))
      add("lineHeight", round(t.lineHeightPx), round(app.lineHeight), token);
    if (t.letterSpacing !== undefined && !near(app.letterSpacing ?? 0, t.letterSpacing, 0.25))
      add("letterSpacing", round(t.letterSpacing), app.letterSpacing, token);
    if (t.fontFamily && app.fontFamily && !app.fontFamily.toLowerCase().includes(t.fontFamily.toLowerCase()))
      add("fontFamily", t.fontFamily, app.fontFamily, token);
    if (el.fill && app.color && colorDistance(el.fill, app.color) > o.colorTolerance)
      add("color", el.fill, app.color, el.styleNames?.fill);
  } else if (!isText) {
    if (el.fill) {
      const actual = app.backgroundColor;
      if (!actual || colorDistance(el.fill, actual) > o.colorTolerance) add("backgroundColor", el.fill, actual, el.styleNames?.fill);
    }

    if (el.radius !== undefined && app.borderRadius) {
      const want = typeof el.radius === "number" ? [el.radius, el.radius, el.radius, el.radius] : el.radius;
      // CSS clamps large radii (pill shapes); clamp the design value the same way.
      const cap = Math.min(el.box.width, el.box.height) / 2;
      const off = want.some((r, i) => !near(Math.min(r, cap), Math.min(app.borderRadius![i] * s, cap), 1));
      if (off) add("borderRadius", want.join(" "), app.borderRadius.map((r) => round(r * s)).join(" "));
    }

    if (el.padding && app.padding) {
      for (const side of ["top", "right", "bottom", "left"] as const) {
        if (!near(app.padding[side] * s, el.padding[side], tol)) add(`padding-${side}`, el.padding[side], round(app.padding[side] * s));
      }
    }

    if (el.gap !== undefined && app.gap !== undefined && !near(app.gap * s, el.gap, tol)) add("gap", el.gap, round(app.gap * s));

    if (el.stroke) {
      if (!app.borderColor || colorDistance(el.stroke, app.borderColor) > o.colorTolerance)
        add("borderColor", el.stroke, app.borderColor, el.styleNames?.stroke);
      if (el.strokeWeight !== undefined && !near(app.borderWidth, el.strokeWeight, 0.5))
        add("borderWidth", el.strokeWeight, app.borderWidth);
    }
  }

  if (el.opacity !== undefined && app.opacity !== undefined && !near(app.opacity, el.opacity, 0.05))
    add("opacity", el.opacity, app.opacity);

  return out;
}

/** Names Figma gives by default; never worth a test id lookup. */
export const GENERIC_NAME =
  /^(frame|group|rectangle|vector|ellipse|line|union|subtract|intersect|exclude|mask|image|polygon|star|auto layout|component|instance|text|section)\s*\d*$/i;
