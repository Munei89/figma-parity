import type { FigmaSource } from "./client.js";
import type { Comment, DevResource, FigmaNode, FileResponse, Rect, TypeStyle } from "./types.js";
/** A design-side description of one element, in the screen's coordinate space. */
export interface ElementSpec {
    id: string;
    name: string;
    type: string;
    path: string;
    box: Rect;
    fill?: string;
    stroke?: string;
    strokeWeight?: number;
    radius?: number | [number, number, number, number];
    opacity?: number;
    padding?: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    gap?: number;
    text?: string;
    typography?: Pick<TypeStyle, "fontFamily" | "fontWeight" | "fontSize" | "lineHeightPx" | "letterSpacing">;
    /** Style names bound to this node, e.g. { fill: "Brand/Primary", text: "Heading/H1" }. */
    styleNames?: Record<string, string>;
    componentName?: string;
}
export interface ScreenSpec {
    id: string;
    name: string;
    slug: string;
    page: string;
    size: {
        width: number;
        height: number;
    };
    background?: string;
    elements: ElementSpec[];
    comments: Comment[];
    devResources: DevResource[];
}
export interface DesignTokens {
    colors: Record<string, string>;
    typography: Record<string, NonNullable<ElementSpec["typography"]>>;
}
export interface DesignExtract {
    fileName: string;
    version: string;
    lastModified: string;
    screens: ScreenSpec[];
    tokens: DesignTokens;
    /** Raw file, kept for prototype parsing and custom consumers. */
    file: FileResponse;
}
/** Top-level frames on each page (including those nested in sections) are screens. */
export declare function findScreens(doc: FigmaNode): {
    node: FigmaNode;
    page: string;
}[];
export declare function buildScreenSpec(node: FigmaNode, page: string, file: FileResponse, comments?: Comment[], devResources?: DevResource[]): ScreenSpec;
/** Derives named tokens from the styles actually applied in the file. */
export declare function extractTokens(file: FileResponse): DesignTokens;
export interface ExtractOptions {
    /** Only include screens whose name or id matches. */
    screens?: (screen: {
        id: string;
        name: string;
        page: string;
    }) => boolean;
    includeComments?: boolean;
    includeDevResources?: boolean;
}
/** The extractor: file → screens, element specs, tokens, comments and dev resources. */
export declare function extractDesign(source: FigmaSource, opts?: ExtractOptions): Promise<DesignExtract>;
