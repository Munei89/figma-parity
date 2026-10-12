import { relativeRect, slug, solidFillHex, walk } from "./util.js";
const SCREEN_TYPES = new Set(["FRAME", "COMPONENT", "COMPONENT_SET"]);
/** Top-level frames on each page (including those nested in sections) are screens. */
export function findScreens(doc) {
    const out = [];
    for (const page of doc.children ?? []) {
        if (page.type !== "CANVAS")
            continue;
        const visit = (n) => {
            for (const child of n.children ?? []) {
                if (child.visible === false)
                    continue;
                if (child.type === "SECTION")
                    visit(child);
                else if (SCREEN_TYPES.has(child.type) && child.absoluteBoundingBox)
                    out.push({ node: child, page: page.name });
            }
        };
        visit(page);
    }
    return out;
}
function elementFromNode(node, origin, path, styleNames, components) {
    const box = node.absoluteBoundingBox;
    if (!box)
        return undefined;
    const el = { id: node.id, name: node.name, type: node.type, path, box: relativeRect(box, origin) };
    const fill = solidFillHex(node.fills);
    if (fill)
        el.fill = fill;
    const stroke = solidFillHex(node.strokes);
    if (stroke) {
        el.stroke = stroke;
        if (node.strokeWeight)
            el.strokeWeight = node.strokeWeight;
    }
    if (node.rectangleCornerRadii)
        el.radius = node.rectangleCornerRadii;
    else if (node.cornerRadius)
        el.radius = node.cornerRadius;
    if (node.opacity !== undefined && node.opacity < 1)
        el.opacity = node.opacity;
    if (node.layoutMode && node.layoutMode !== "NONE") {
        el.padding = {
            top: node.paddingTop ?? 0,
            right: node.paddingRight ?? 0,
            bottom: node.paddingBottom ?? 0,
            left: node.paddingLeft ?? 0,
        };
        if (node.itemSpacing)
            el.gap = node.itemSpacing;
    }
    if (node.type === "TEXT") {
        el.text = node.characters;
        const s = node.style ?? {};
        el.typography = {
            fontFamily: s.fontFamily,
            fontWeight: s.fontWeight,
            fontSize: s.fontSize,
            lineHeightPx: s.lineHeightPx,
            letterSpacing: s.letterSpacing,
        };
    }
    const names = styleNames(node);
    if (names)
        el.styleNames = names;
    if (node.componentId && components?.[node.componentId])
        el.componentName = components[node.componentId].name;
    return el;
}
export function buildScreenSpec(node, page, file, comments = [], devResources = []) {
    const origin = node.absoluteBoundingBox;
    const styleNames = (n) => {
        if (!n.styles)
            return undefined;
        const out = {};
        for (const [kind, id] of Object.entries(n.styles)) {
            const meta = file.styles?.[id];
            if (meta)
                out[kind] = meta.name;
        }
        return Object.keys(out).length ? out : undefined;
    };
    const elements = [];
    const ids = new Set();
    walk(node, (n, parents) => {
        if (n === node)
            return;
        if (n.visible === false)
            return false;
        const path = [...parents.slice(1).map((p) => p.name), n.name].join("/");
        const el = elementFromNode(n, origin, path, styleNames, file.components);
        if (el) {
            elements.push(el);
            ids.add(n.id);
        }
    });
    ids.add(node.id);
    const nodeOf = (c) => (c.client_meta && "node_id" in c.client_meta ? c.client_meta.node_id : undefined);
    return {
        id: node.id,
        name: node.name,
        slug: slug(node.name),
        page,
        size: { width: origin.width, height: origin.height },
        background: solidFillHex(node.fills),
        elements,
        comments: comments.filter((c) => !c.resolved_at && nodeOf(c) && ids.has(nodeOf(c))),
        devResources: devResources.filter((d) => ids.has(d.node_id)),
    };
}
/** Derives named tokens from the styles actually applied in the file. */
export function extractTokens(file) {
    const tokens = { colors: {}, typography: {} };
    walk(file.document, (n) => {
        if (!n.styles)
            return;
        for (const [kind, id] of Object.entries(n.styles)) {
            const meta = file.styles?.[id];
            if (!meta)
                continue;
            if (meta.styleType === "FILL" && (kind === "fill" || kind === "fills") && !(meta.name in tokens.colors)) {
                const hex = solidFillHex(n.fills);
                if (hex)
                    tokens.colors[meta.name] = hex;
            }
            if (meta.styleType === "TEXT" && kind === "text" && !(meta.name in tokens.typography) && n.style) {
                const s = n.style;
                tokens.typography[meta.name] = {
                    fontFamily: s.fontFamily,
                    fontWeight: s.fontWeight,
                    fontSize: s.fontSize,
                    lineHeightPx: s.lineHeightPx,
                    letterSpacing: s.letterSpacing,
                };
            }
        }
    });
    return tokens;
}
/** The extractor: file → screens, element specs, tokens, comments and dev resources. */
export async function extractDesign(source, opts = {}) {
    const [file, comments, devResources] = await Promise.all([
        source.getFile(),
        opts.includeComments === false ? Promise.resolve([]) : source.getComments().catch(() => []),
        opts.includeDevResources === false ? Promise.resolve([]) : source.getDevResources().catch(() => []),
    ]);
    const screens = findScreens(file.document)
        .filter(({ node, page }) => !opts.screens || opts.screens({ id: node.id, name: node.name, page }))
        .map(({ node, page }) => buildScreenSpec(node, page, file, comments, devResources));
    return {
        fileName: file.name,
        version: file.version,
        lastModified: file.lastModified,
        screens,
        tokens: extractTokens(file),
        file,
    };
}
