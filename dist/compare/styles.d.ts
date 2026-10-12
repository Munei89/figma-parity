import type { AppStyle } from "../drivers/types.js";
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
export declare function compareElementStyle(el: ElementSpec, selector: string, app: AppStyle, o: StyleOptions): StyleMismatch[];
/** Names Figma gives by default; never worth a test id lookup. */
export declare const GENERIC_NAME: RegExp;
