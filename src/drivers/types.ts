import type { ScreenTarget } from "../config.js";
import type { Rect } from "../figma/types.js";

/** Styles read from the running app, normalised across platforms. */
export interface AppStyle {
  box: Rect;
  text?: string;
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  borderRadius?: [number, number, number, number];
  borderColor?: string;
  borderWidth?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  gap?: number;
  opacity?: number;
}

export interface Viewport {
  width: number;
  height: number;
  /** Device pixels per CSS px / dp. */
  scale: number;
}

/**
 * The surface every platform implements. Keeping it small is what makes
 * adding another runner (Detox, Maestro, a remote device farm) cheap.
 */
export interface Driver {
  readonly platform: "web" | "react-native";
  /** Whether `styles()` returns rich computed styles (web) or only box + text (native). */
  readonly richStyles: boolean;

  start(): Promise<void>;
  stop(): Promise<void>;

  /** Size the viewport for a frame, when the platform allows it. */
  prepareViewport(size: { width: number; height: number }): Promise<void>;
  viewport(): Promise<Viewport>;

  /** Open a screen directly (route / deep link). Returns false if it has no way to. */
  open(target: ScreenTarget): Promise<boolean>;
  /** Is the given screen currently showing? */
  isShowing(target: ScreenTarget): Promise<boolean>;
  /** Wait until ready/marker is present (best effort). */
  waitReady(target: ScreenTarget, timeoutMs: number): Promise<void>;

  /** PNG of the current screen (full page on web). */
  screenshot(): Promise<Buffer>;

  exists(selector: string): Promise<boolean>;
  styles(selectors: string[]): Promise<Map<string, AppStyle | null>>;

  tap(selector: string): Promise<void>;
  tapPoint(x: number, y: number): Promise<void>;
  hover(selector: string): Promise<boolean>;
  back(): Promise<void>;

  /** URL on web, activity/bundle + marker summary on native, for the report. */
  location(): Promise<string>;

  settle(): Promise<void>;
}

/** Turns a Figma node name into the selector the testid strategy expects. */
export interface SelectorStrategy {
  forName(slug: string): string;
}

/** A hotspot exists but can't be interacted with: a real finding, not a tool error. */
export class InteractionError extends Error {
  name = "InteractionError";
}
