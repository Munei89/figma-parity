# figma-parity

[![npm](https://img.shields.io/npm/v/@munei89/figma-parity)](https://www.npmjs.com/package/@munei89/figma-parity) [![CI](https://github.com/Munei89/figma-parity/actions/workflows/ci.yml/badge.svg)](https://github.com/Munei89/figma-parity/actions/workflows/ci.yml) ![license](https://img.shields.io/npm/l/@munei89/figma-parity)

Check that what shipped matches what was designed. `figma-parity` reads a Figma file — screens, styles, tokens, comments, dev resources **and the prototype wiring** — then drives your running app and reports where it drifts:

- **Visual** — pixel diff of every mapped screen against the Figma render, with the differing elements named ("Balance card/Balance amount — 15% of area").
- **Styles & copy** — per element: position, size, colour, typography, radius, padding, gap, borders, and the text itself, linked back to the Figma style/token the designer used.
- **Prototype flows** — every prototype interaction (navigate, overlay, swap, back, close, after-delay) is replayed in the app and checked to land on the right screen.
- **Report** — a self-contained HTML report (diff / design / app / overlay slider per screen, mismatch tables, flow results, prototype map) plus `report.json` for CI gating.

It runs three ways:

| Mode | Drives the app with | Use for |
|---|---|---|
| Web | Playwright (Chromium/Firefox/WebKit, or an existing Chrome over CDP) | CI, local runs |
| React Native | Appium (UiAutomator2 / XCUITest) via WebdriverIO | iOS/Android builds |
| Agent (MCP) | Claude in Chrome / Claude's built-in browser / any browser-capable agent | Exploratory QA, logged-in states, apps that are awkward to script |

## Install

```bash
npm i -D @munei89/figma-parity
# web
npm i -D playwright && npx playwright install chromium
# react native
npm i -D webdriverio && npx appium   # plus the uiautomator2 / xcuitest driver
```

The CLI is `figma-parity` once installed (or `npx @munei89/figma-parity <command>` without installing). Needs Node 20+ (Node 22.18+ to load `.ts` config files directly; use `.mjs` otherwise). Set `FIGMA_TOKEN` to a [personal access token](https://help.figma.com/hc/en-us/articles/8085703771159) with file read access.

## Quick start

```bash
export FIGMA_TOKEN=figd_...
npx figma-parity init --file "https://www.figma.com/design/AbC123/My-App" --base-url http://localhost:3000
# edit figma-parity.config.mjs: routes and markers for each screen
npx figma-parity run
open figma-parity-report/report.html
```

`init` reads the file and writes a config listing every screen (with a guessed route) and every prototype hotspot (with the test id it will be matched by), so setup is mostly filling in blanks.

Try it without a Figma account: `npm run build && node examples/demo/run-demo.mjs` serves a small app with planted regressions and writes a report to `examples/demo/report/`.

## Config

```js
/** @type {import("@munei89/figma-parity").ParityConfigInput} */
export default {
  figma: { file: "https://www.figma.com/design/AbC123/My-App", pages: ["App"] },
  target: {
    platform: "web",
    baseUrl: "http://localhost:3000",
    scale: 2,                       // device scale factor; Figma renders at the same scale
    storageState: "./auth.json",    // optional logged-in session
  },
  screens: {
    // key: Figma screen name, slug or node id
    "Login":          { route: "/login", marker: '[data-testid="screen-login"]' },
    "Order detail":   { route: "/orders/123", match: "/orders/:id" },
    "Reset password": { route: "/login?reset=1", match: "/login", marker: '[role="dialog"]' },
    "Dashboard":      { route: "/", mask: ['[data-testid="clock"]'], visualThreshold: 0.06 },
  },
  elements: {
    // Figma node name, path ("Header/Login") or id → selector, when the test id convention doesn't fit
    "Login/Primary button": "form button[type=submit]",
  },
  selectorStrategy: "testid",       // node "Login button" → [data-testid="login-button"]
  thresholds: { visual: 0.03, pixel: 0.12, region: 0.08, size: 2, color: 6, flowTimeoutMs: 5000 },
  output: { dir: "figma-parity-report", inline: false },
};
```

### How screens and elements are matched

- **Screens** are opened by `route` (web) or `deepLink` (RN) and recognised by `match`/`route` and/or `marker`. Flows need a way to recognise the destination, so give overlays and modals a `marker`.
- **Elements** use explicit `elements` mappings first, then the test id convention: the node name slugged (`"Login button"` → `login-button`) as `data-testid` on web or the accessibility id (RN `testID`) on native. Figma's default names (`Frame 12`, `Rectangle 3`) and names repeated within a screen are skipped.
- **Prototype hotspots** without a selector are tapped at their design position (`positionalFallback`, on by default) and marked as positional in the report — map them for a definitive result.

### React Native

```js
target: {
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
  statusBarHeight: 24, // crop if your frames don't draw the status bar
},
screens: {
  "Home": { deepLink: "myapp://home", marker: "screen-home" },   // marker = testID
},
```

On native, style checks cover position, size and copy (the accessibility tree doesn't expose colours or fonts); the pixel diff covers the rest. Design renders are scaled to the device width, so a 390pt frame compares fine against a 412dp phone — width and height differences are reported separately.

## Using it with Claude (MCP)

`figma-parity mcp` starts an MCP server. Add it to Claude (desktop / Claude Code):

```json
{
  "mcpServers": {
    "figma-parity": {
      "command": "npx",
      "args": ["-y", "@munei89/figma-parity", "mcp", "-c", "/path/to/figma-parity.config.mjs"],
      "env": { "FIGMA_TOKEN": "figd_..." }
    }
  }
}
```

Then ask Claude something like *"Use figma-parity to check the app in my browser against the design and give me the report."* Claude drives its own browser and the server does the measuring:

| Tool | What it does |
|---|---|
| `parity_overview` | Screens (with the URL to open each), flows, and the workflow |
| `parity_screen_spec` | Frame size, mapped elements, selectors, colours, typography, tokens, open Figma comments |
| `parity_design_image` | The Figma render as an image, for Claude's own side-by-side review |
| `parity_style_probe` → `parity_submit_styles` | JavaScript for Claude to run in the page; its output is compared exactly like the automated run |
| `parity_compare_screenshot` | Pixel diff from a PNG path/base64; returns the outlined diff image |
| `parity_record_review` | Claude's qualitative findings (high severity fails the screen) |
| `parity_flow_steps` → `parity_record_flow` | Each prototype interaction to perform and what should happen; Claude records the outcome |
| `parity_write_report` | Writes the HTML/JSON report |
| `parity_run_automated` | Runs the full headless check without Claude driving |

The style probe is the same measurement code the Playwright runner uses, so results from Claude's browser and from CI are directly comparable. You can also point the automated web runner at a browser you already have open with `target.cdpUrl` (Chrome started with `--remote-debugging-port`).

## CLI

```
figma-parity init      -f <url> [-p web|react-native] [--base-url] [-o file]
figma-parity run       [-c config] [--only "Login,Home"] [--headed] [--no-flows] [--fail-on fail|never]
figma-parity extract   [-c config] [-o design.json]     # the extractor on its own
figma-parity flows     [-c config] [--mermaid]          # print the prototype graph
figma-parity snapshot  [-c config] [-d dir] [-s scale]  # pin the design for offline/CI runs
figma-parity mcp       [-c config]
```

`run` exits non-zero when any screen or flow fails. `--json` prints the summary for scripts; `--markdown summary.md` writes a summary you can post as a PR comment.

## CI

In GitHub Actions, failing screens and flows show up as error annotations and the job summary gets a results table automatically.

```yaml
- run: npm ci && npx playwright install --with-deps chromium
- run: npm run build && (npm start &) && npx wait-on http://localhost:3000
- run: npx figma-parity run --markdown parity.md
  env: { FIGMA_TOKEN: "${{ secrets.FIGMA_TOKEN }}" }
- uses: actions/upload-artifact@v4
  if: always()
  with: { name: design-parity, path: figma-parity-report }
```

To pin the design (no Figma calls in CI, no rate limits), commit a snapshot: `figma-parity snapshot -s 2` and set `figma.snapshotDir`.

## Programmatic API

```ts
import { loadConfig, runParity, extractDesign, buildPrototypeGraph, FigmaClient } from "@munei89/figma-parity";

const { report, htmlPath } = await runParity(await loadConfig());
if (report.summary.flows.fail) process.exit(1);

// The extractor and the prototype parser are usable on their own:
const source = new FigmaClient({ token: process.env.FIGMA_TOKEN!, fileKey: "AbC123" });
const design = await extractDesign(source);           // screens, element specs, tokens, comments, dev resources
const graph = buildPrototypeGraph(design.file);       // edges, flows, dangling links
```

Anything implementing `FigmaSource` (four methods) can feed it — e.g. an adapter around an existing extractor. Anything implementing `Driver` can drive the app — e.g. Detox, Maestro or a device farm.

## How prototypes are read

No prototype player automation: the REST API already returns each node's `interactions` (trigger + actions with destination and navigation type), legacy `transitionNodeID`, and each page's `flowStartingPoints`. `figma-parity` turns that into a graph of screen → screen edges. In-screen state changes (`CHANGE_TO` variant swaps, `SCROLL_TO`) aren't navigation and are left out; links to deleted frames are reported as dangling.

## Limits worth knowing

- Figma renders text with its own engine, so text edges differ slightly from browsers. `thresholds.pixel` and `thresholds.visual` absorb that; the style checks are the precise layer.
- Pixel diffs need representative data. Mask live regions (`mask`) and seed predictable content in `setup`.
- Variables (Figma's newer token system) need an Enterprise plan to read via REST, so tokens are derived from the styles applied in the file.
- Screens that can only be reached through flows (no direct route/deep link) are marked unreachable for the visual check; their incoming flows are still tested.

## Contributing

```bash
npm install
npm test          # unit + MCP tests
npm run demo      # end-to-end against a local demo app (needs a Playwright browser)
```

Releases are published from GitHub Actions with npm provenance: bump the version, update `CHANGELOG.md`, then push a `v*` tag.

## License

MIT © Munei89
