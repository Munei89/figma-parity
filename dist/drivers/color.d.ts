/** Parses CSS colours as browsers report them (rgb/rgba/color(srgb)/hex) into #rrggbb[aa]. */
export declare function cssColorToHex(input: string | null | undefined): string | undefined;
export declare function hexToRgba(hex: string): [number, number, number, number];
/** Largest per-channel difference, alpha-premultiplied against white so near-invisible colours compare sensibly. */
export declare function colorDistance(a: string, b: string): number;
