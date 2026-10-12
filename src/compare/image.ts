import { PNG } from "pngjs";

export interface Image {
  width: number;
  height: number;
  data: Buffer;
}

export function decode(png: Buffer): Image {
  const img = PNG.sync.read(png);
  return { width: img.width, height: img.height, data: img.data };
}

export function encode(img: Image): Buffer {
  const png = new PNG({ width: img.width, height: img.height });
  img.data.copy(png.data);
  return PNG.sync.write(png);
}

export function crop(img: Image, x: number, y: number, width: number, height: number): Image {
  const w = Math.max(0, Math.min(width, img.width - x));
  const h = Math.max(0, Math.min(height, img.height - y));
  const out = Buffer.alloc(w * h * 4);
  for (let row = 0; row < h; row++) {
    const src = ((y + row) * img.width + x) * 4;
    img.data.copy(out, row * w * 4, src, src + w * 4);
  }
  return { width: w, height: h, data: out };
}

export async function cropTop(png: Buffer, pixels: number): Promise<Buffer> {
  const img = decode(png);
  return encode(crop(img, 0, pixels, img.width, img.height - pixels));
}

/** Bilinear resize; good enough to line up a Figma render with a device screenshot. */
export function resize(img: Image, width: number, height: number): Image {
  if (width === img.width && height === img.height) return img;
  const out = Buffer.alloc(width * height * 4);
  const sx = img.width / width;
  const sy = img.height / height;
  for (let y = 0; y < height; y++) {
    const fy = Math.min(img.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(img.height - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.min(img.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(img.width - 1, x0 + 1);
      const wx = fx - x0;
      for (let c = 0; c < 4; c++) {
        const a = img.data[(y0 * img.width + x0) * 4 + c];
        const b = img.data[(y0 * img.width + x1) * 4 + c];
        const d = img.data[(y1 * img.width + x0) * 4 + c];
        const e = img.data[(y1 * img.width + x1) * 4 + c];
        out[(y * width + x) * 4 + c] = Math.round((a * (1 - wx) + b * wx) * (1 - wy) + (d * (1 - wx) + e * wx) * wy);
      }
    }
  }
  return { width, height, data: out };
}

/** Composite onto white so transparent Figma frames compare against opaque screenshots. */
export function flatten(img: Image): Image {
  const out = Buffer.from(img.data);
  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3] / 255;
    if (a === 1) continue;
    out[i] = Math.round(out[i] * a + 255 * (1 - a));
    out[i + 1] = Math.round(out[i + 1] * a + 255 * (1 - a));
    out[i + 2] = Math.round(out[i + 2] * a + 255 * (1 - a));
    out[i + 3] = 255;
  }
  return { ...img, data: out };
}

export function fillRect(img: Image, x: number, y: number, w: number, h: number, rgba: [number, number, number, number]): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(img.width, Math.ceil(x + w));
  const y1 = Math.min(img.height, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * img.width + xx) * 4;
      img.data[i] = rgba[0];
      img.data[i + 1] = rgba[1];
      img.data[i + 2] = rgba[2];
      img.data[i + 3] = rgba[3];
    }
  }
}

/** Draws a 2px outline, used to mark called-out regions on the diff image. */
export function strokeRect(
  img: Image,
  x: number,
  y: number,
  w: number,
  h: number,
  rgba: [number, number, number, number],
  t: number = 2
): void {
  fillRect(img, x, y, w, t, rgba);
  fillRect(img, x, y + h - t, w, t, rgba);
  fillRect(img, x, y, t, h, rgba);
  fillRect(img, x + w - t, y, t, h, rgba);
}
