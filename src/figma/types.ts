/**
 * Minimal, deliberately loose typings for the parts of the Figma REST API
 * this library reads. Unknown fields are preserved via index signatures so
 * nothing is lost when nodes are passed through.
 */

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Paint {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: Color;
  [key: string]: unknown;
}

export interface TypeStyle {
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  lineHeightPx?: number;
  letterSpacing?: number;
  textCase?: string;
  textAlignHorizontal?: string;
  italic?: boolean;
  [key: string]: unknown;
}

export interface Trigger {
  type: string;
  timeout?: number;
  keyCodes?: number[];
  [key: string]: unknown;
}

export interface Action {
  type: string;
  destinationId?: string | null;
  navigation?: string;
  url?: string;
  transition?: {
    type: string;
    duration?: number;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface Interaction {
  trigger: Trigger | null;
  actions?: Action[];
  [key: string]: unknown;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  children?: FigmaNode[];
  absoluteBoundingBox?: Rect | null;
  absoluteRenderBounds?: Rect | null;
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: [number, number, number, number];
  opacity?: number;
  layoutMode?: string;
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  characters?: string;
  style?: TypeStyle;
  styles?: Record<string, string>;
  interactions?: Interaction[];
  transitionNodeID?: string | null;
  componentId?: string;
  flowStartingPoints?: { nodeId: string; name: string }[];
  prototypeStartNodeID?: string | null;
  [key: string]: unknown;
}

export interface StyleMeta {
  key: string;
  name: string;
  styleType: string;
  description?: string;
}

export interface FileResponse {
  name: string;
  lastModified: string;
  version: string;
  document: FigmaNode;
  styles: Record<string, StyleMeta>;
  components?: Record<string, { key: string; name: string; description?: string }>;
}

export interface Comment {
  id: string;
  message: string;
  created_at: string;
  resolved_at?: string | null;
  user?: { handle: string };
  client_meta?: { node_id?: string; node_offset?: { x: number; y: number } } | { x: number; y: number } | null;
  parent_id?: string;
}

export interface DevResource {
  id: string;
  name: string;
  url: string;
  file_key: string;
  node_id: string;
}
