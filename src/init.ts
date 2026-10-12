import { slug } from "./figma/util.js";
import type { DesignExtract } from "./figma/extract.js";
import type { PrototypeGraph } from "./figma/prototype.js";

export interface InitOptions {
  file: string;
  platform: "web" | "react-native";
  baseUrl?: string;
}

/**
 * Generates a starter config from the real file: every screen listed with a
 * guessed route, and every prototype hotspot listed with the test id it would
 * be matched by, so wiring things up is mostly filling in blanks.
 */
export function generateConfig(design: DesignExtract, graph: PrototypeGraph, o: InitOptions): string {
  const web = o.platform === "web";
  const inFlow = new Set(graph.flows.flatMap((f) => f.screens));
  const screens = [...design.screens].sort((a, b) => Number(inFlow.has(b.id)) - Number(inFlow.has(a.id)));

  const screenLines = screens.map((s, i) => {
    const key = JSON.stringify(s.name);
    const marker = web ? `'[data-testid="screen-${s.slug}"]'` : `"screen-${s.slug}"`;
    const open = web ? `route: "${i === 0 ? "/" : `/${s.slug}`}"` : `deepLink: "myapp://${s.slug}"`;
    const note = inFlow.has(s.id) ? "" : " // not in any prototype flow";
    return `    ${key}: { ${open}, marker: ${marker} },${note}`;
  });

  const hotspots = new Map<string, string>();
  for (const e of graph.edges) {
    const from = design.screens.find((s) => s.id === e.from);
    if (!from) continue;
    const key = `${from.name}/${e.hotspot.path}`;
    const tid = slug(e.hotspot.name);
    hotspots.set(key, web ? `[data-testid="${tid}"]` : tid);
  }

  const elementLines = [...hotspots].map(([k, v]) => `    // ${JSON.stringify(k)}: ${JSON.stringify(v)},`);

  const target = web
    ? `  target: {
    platform: "web",
    baseUrl: ${JSON.stringify(o.baseUrl ?? "http://localhost:3000")},
    scale: 1,
    // storageState: "./auth.json",       // reuse a logged-in session
    // setup: async (page) => { ... },    // log in, seed data, dismiss banners
    // cdpUrl: "http://127.0.0.1:9222",  // drive an existing Chrome instead of launching one
  },`
    : `  target: {
    platform: "react-native",
    appium: {
      port: 4723,
      capabilities: {
        platformName: "Android",
        "appium:automationName": "UiAutomator2",
        "appium:appPackage": "com.example.app",
        "appium:appActivity": ".MainActivity",
        "appium:noReset": true,
      },
    },
    // statusBarHeight: 24, // dp to crop if your frames don't draw a status bar
  },`;

  return `// figma-parity config — generated from "${design.fileName}" (${design.screens.length} screens, ${graph.edges.length} prototype links)
// Docs: https://github.com/Munei89/figma-parity#readme. Keys under \`screens\` and \`elements\` can be Figma names, paths or node ids.

/** @type {import("@flintdesignz/figma-parity").ParityConfigInput} */
export default {
  figma: {
    file: ${JSON.stringify(o.file)},
    // token: process.env.FIGMA_TOKEN,   // default
    // snapshotDir: ".figma-snapshot",   // pin a design version for CI (\`figma-parity snapshot\`)
  },
${target}

  screens: {
${screenLines.join("\n")}
  },

  // Hotspots from the prototype. With selectorStrategy "testid" these are found
  // automatically when your components use the slug as a test id; map any that differ.
  elements: {
${elementLines.join("\n")}
  },

  selectorStrategy: "testid",
  thresholds: { visual: 0.03, size: 2, color: 6 },
  output: { dir: "figma-parity-report" },
};
`;
}
