/** Parses CSS colours as browsers report them (rgb/rgba/color(srgb)/hex) into #rrggbb[aa]. */
export function cssColorToHex(input) {
    if (!input)
        return undefined;
    const s = input.trim().toLowerCase();
    if (s === "transparent")
        return "#00000000";
    const hex = s.match(/^#([0-9a-f]{3,8})$/);
    if (hex) {
        let h = hex[1];
        if (h.length === 3 || h.length === 4)
            h = [...h].map((c) => c + c).join("");
        return h.length === 8 && h.endsWith("ff") ? `#${h.slice(0, 6)}` : `#${h}`;
    }
    const to2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
    const fmt = (r, g, b, a) => a >= 0.999 ? `#${to2(r)}${to2(g)}${to2(b)}` : `#${to2(r)}${to2(g)}${to2(b)}${to2(a * 255)}`;
    const rgb = s.match(/^rgba?\(([^)]+)\)$/);
    if (rgb) {
        const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
        const [r, g, b] = parts.slice(0, 3).map((p) => (p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p)));
        const aRaw = parts[3];
        const a = aRaw === undefined ? 1 : aRaw.endsWith("%") ? parseFloat(aRaw) / 100 : parseFloat(aRaw);
        if ([r, g, b, a].some((v) => v === undefined || Number.isNaN(v)))
            return undefined;
        return fmt(r, g, b, a);
    }
    const srgb = s.match(/^color\(srgb\s+([^)]+)\)$/);
    if (srgb) {
        const parts = srgb[1].split(/[\s/]+/).filter(Boolean).map(parseFloat);
        const [r = 0, g = 0, b = 0, a = 1] = parts;
        return fmt(r * 255, g * 255, b * 255, a);
    }
    return undefined;
}
export function hexToRgba(hex) {
    const h = hex.replace("#", "");
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length >= 8 ? n(6) : 255];
}
/** Largest per-channel difference, alpha-premultiplied against white so near-invisible colours compare sensibly. */
export function colorDistance(a, b) {
    const flat = (hex) => {
        const [r, g, bl, al] = hexToRgba(hex);
        const f = al / 255;
        return [r * f + 255 * (1 - f), g * f + 255 * (1 - f), bl * f + 255 * (1 - f)];
    };
    const x = flat(a);
    const y = flat(b);
    return Math.max(...x.map((v, i) => Math.abs(v - y[i])));
}
