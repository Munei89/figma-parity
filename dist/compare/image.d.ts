export interface Image {
    width: number;
    height: number;
    data: Buffer;
}
export declare function decode(png: Buffer): Image;
export declare function encode(img: Image): Buffer;
export declare function crop(img: Image, x: number, y: number, width: number, height: number): Image;
export declare function cropTop(png: Buffer, pixels: number): Promise<Buffer>;
/** Bilinear resize; good enough to line up a Figma render with a device screenshot. */
export declare function resize(img: Image, width: number, height: number): Image;
/** Composite onto white so transparent Figma frames compare against opaque screenshots. */
export declare function flatten(img: Image): Image;
export declare function fillRect(img: Image, x: number, y: number, w: number, h: number, rgba: [number, number, number, number]): void;
/** Draws a 2px outline, used to mark called-out regions on the diff image. */
export declare function strokeRect(img: Image, x: number, y: number, w: number, h: number, rgba: [number, number, number, number], t?: number): void;
