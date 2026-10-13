# figma-parity

[![npm](https://img.shields.io/npm/v/@munei89/figma-parity)](https://www.npmjs.com/package/@munei89/figma-parity) [![CI](https://github.com/Munei89/figma-parity/actions/workflows/ci.yml/badge.svg)](https://github.com/Munei89/figma-parity/actions/workflows/ci.yml) ![license](https://img.shields.io/npm/l/@munei89/figma-parity)

Check that what shipped matches what was designed. `figma-parity` reads a Figma file — screens, styles, tokens, comments, dev resources **and the prototype wiring** — then drives your running app and reports where it drifts:

- **Visual** — pixel diff of every mapped screen against the Figma render, with differing elements named ("Balance card/Balance amount — 15% of area").
- **Styles & copy** — per element: position, size, color, typography, radius, padding, gap, borders, and the text itself, linked back to the Figma style/token the designer used.
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
```

**Web (Playwright)**:
```bash
npm i -D playwright
npx playwright install chromium
```

**React Native (Appium)**:
```bash
npm i -D webdriverio
npm i -g appium
appium driver install uiautomator2  # Android
appium driver install xcuitest      # iOS
```

## Requirements

- **Node.js**: 20 or later (22.18+ to load `.ts` config files directly; use `.mjs` otherwise)
- **Figma access token**: [Personal access token](https://help.figma.com/hc/en-us/articles/8085703771159) with file read access
- **Playwright** (web) or **Appium** (React Native): See install steps above

## Quick start

```bash
# Set your Figma token
export FIGMA_TOKEN=figd_...

# Generate a starter config from your Figma file
npx figma-parity init --file "https://www.figma.com/design/AbC123/My-App" --base-url http://localhost:3000

# Edit figma-parity.config.mjs to map screens and elements

# Run the checks
npx figma-parity run

# View the report
open figma-parity-report/report.html
```

`init` reads the file and writes a config listing every screen (with a guessed route) and every prototype hotspot (with the test id it will be matched by), so setup is mostly filling in blanks.

**Try it without a Figma account**: `npm run build && node examples/demo/run-demo.mjs` serves a small app with planted regressions and writes a report to `examples/demo/report/`.

## CLI

### `figma-parity init`

Generate a starter configuration from a Figma file.

```bash
figma-parity init --file <url> [options]
```

**Options**:
- `-f, --file <url>`: Figma file URL or key (required)
- `-p, --platform <platform>`: `web` or `react-native` (default: `web`)
- `--base-url <url>`: Web app base URL (default: `http://localhost:3000`)
- `-o, --out <path>`: Where to write (default: `figma-parity.config.mjs`)
- `--force`: Overwrite an existing config

**Example**:
```bash
figma-parity init -f "https://www.figma.com/design/AbC123/My-App" --base-url http://localhost:3000
```

### `figma-parity run`

Run visual, style, and flow checks and write the report.

```bash
figma-parity run [options]
```

**Options**:
- `-c, --config <path>`: Config file (default: auto-detect `figma-parity.config.{mjs,ts,js}`)
- `--only <screens>`: Comma-separated screen names/ids to check
- `--headed`: Show the browser (web only, default: headless)
- `--no-flows`: Skip prototype flow checks
- `--fail-on <level>`: Exit non-zero when: `fail` (default) or `never`
- `--json`: Print the summary as JSON (for scripts)
- `--markdown <file>`: Also write a Markdown summary (for PR comments)

**Examples**:
```bash
figma-parity run                              # Run all checks
figma-parity run --only "Login,Dashboard"     # Check specific screens
figma-parity run --headed                     # Show browser
figma-parity run --no-flows                   # Skip flow checks
figma-parity run --markdown summary.md        # Generate PR comment
```

### `figma-parity extract`

Extract screens, element specs, tokens, comments, and dev resources as JSON.

```bash
figma-parity extract [options]
```

**Options**:
- `-c, --config <path>`: Config file
- `-o, --out <path>`: Output file (default: `design.json`)

**Example**:
```bash
figma-parity extract -o design.json
```

### `figma-parity flows`

Print the prototype flow graph.

```bash
figma-parity flows [options]
```

**Options**:
- `-c, --config <path>`: Config file
- `--mermaid`: Print Mermaid diagram instead of text

**Example**:
```bash
figma-parity flows --mermaid > flows.mmd
```

### `figma-parity snapshot`

Save the design (file, comments, frame renders) to disk for offline/CI runs.

```bash
figma-parity snapshot [options]
```

**Options**:
- `-c, --config <path>`: Config file
- `-d, --dir <dir>`: Snapshot directory (default: `.figma-snapshot`)
- `-s, --scale <n>`: Render scale, should match your device scale factor (default: `1`)

**Example**:
```bash
figma-parity snapshot -s 2 -d .figma-cache
```

Then set `figma.snapshotDir: ".figma-cache"` in your config to use it.

### `figma-parity mcp`

Start the MCP server (stdio) so an agent like Claude can drive the checks from its own browser.

```bash
figma-parity mcp [options]
```

**Options**:
- `-c, --config <path>`: Config file

**Example**: See [MCP Integration](#using-it-with-claude-mcp) below.

## Config

Create a `figma-parity.config.mjs` (or `.ts`, `.js`) in your project root:

```js
/** @type {import("@munei89/figma-parity").ParityConfigInput} */
export default {
  figma: {
    file: "https://www.figma.com/design/AbC123/My-App",  // or just the file key
    // token: "figd_...",       // defaults to process.env.FIGMA_TOKEN
    // snapshotDir: ".figma-snapshot",  // use a snapshot instead of live API
    // pages: ["App"],          // only consider screens on these pages
  },
  target: {
    platform: "web",
    baseUrl: "http://localhost:3000",
    // browser: "chromium",     // or "firefox", "webkit"
    // headless: true,
    scale: 2,                   // device scale factor; Figma renders at the same scale
    // storageState: "./auth.json",  // Playwright storage state for logged-in sessions
    settleMs: 400,              // wait after navigation for animations (default: 400)
    // setup: async (page) => { /* one-time setup: login, seed data, etc. */ },
    // executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    // cdpUrl: "http://localhost:9222",  // connect to existing Chrome with --remote-debugging-port
  },
  screens: {
    // Key: Figma screen name, slug, or node id
    "Login": {
      route: "/login",
      marker: '[data-testid="screen-login"]',  // selector that's only present on this screen
      // ready: '[data-testid="login-form"]',   // wait for this before capturing (defaults to marker)
      // mask: ['[data-testid="timestamp"]'],   // hide before screenshot
      // visualThreshold: 0.05,                 // override threshold for this screen
      // skip: false,                           // skip this screen entirely
    },
    "Order detail": {
      route: "/orders/123",
      match: "/orders/:id",    // recognise by pattern when URL has dynamic params
    },
    "Reset password": {
      route: "/login?reset=1",
      match: "/login",
      marker: '[role="dialog"]',  // overlays/modals need a marker
    },
    "Dashboard": {
      route: "/",
      mask: ['[data-testid="clock"]'],  // mask live data
      visualThreshold: 0.06,
    },
  },
  elements: {
    // Figma node name, path ("Header/Login button") or id → selector
    // Use this when the test id convention doesn't fit
    "Login/Primary button": "form button[type=submit]",
    "Header/Logo": "header img.logo",
  },
  selectorStrategy: "testid",  // "testid" (node "Login button" → [data-testid="login-button"]) or "none"
  positionalFallback: true,    // tap hotspot coordinates when no selector found (marked in report)
  checks: {
    visual: true,
    styles: true,
    flows: true,
  },
  thresholds: {
    visual: 0.03,        // max fraction of differing pixels before screen fails
    pixel: 0.12,         // individual pixel RGB delta (0..1) to count as mismatch
    region: 0.08,        // min fraction of element area to report it
    size: 2,             // position/size tolerance (px)
    color: 6,            // color delta (0..255 per channel, alpha-premultiplied)
    flowTimeoutMs: 5000, // how long to wait for flow navigation
  },
  output: {
    dir: "figma-parity-report",
    inline: false,       // embed images as base64 in HTML (larger file, but portable)
  },
};
```

### How screens and elements are matched

- **Screens** are opened by `route` (web) or `deepLink` (RN) and recognised by `match`/`route` and/or `marker`. Flows need a way to recognise the destination, so give overlays and modals a `marker`.
- **Elements** use explicit `elements` mappings first, then the test id convention: the node name slugged (`"Login button"` → `login-button`) as `data-testid` on web or accessibility id (RN `testID`) on native. Figma's default names (`Frame 12`, `Rectangle 3`) and names repeated within a screen are skipped.
- **Prototype hotspots** without a selector are tapped at their design position when `positionalFallback` is enabled (default: `true`) and marked as positional in the report — map them for definitive results.

### React Native

```js
target: {
  platform: "react-native",
  appium: {
    hostname: "127.0.0.1",  // defaults
    port: 4723,
    path: "/",
    capabilities: {
      platformName: "Android",
      "appium:automationName": "UiAutomator2",
      "appium:appPackage": "com.example.app",
      "appium:appActivity": ".MainActivity",
      "appium:noReset": true,
    },
  },
  settleMs: 800,             // default: 800 (animations take longer on devices)
  statusBarHeight: 24,       // crop if your frames don't draw the status bar
  // setup: async (driver) => { /* one-time setup */ },
},
screens: {
  "Home": {
    deepLink: "myapp://home",
    marker: "screen-home",   // testID in React Native
  },
},
```

**Note**: On native, style checks cover position, size, and copy (the accessibility tree doesn't expose colors or fonts); the pixel diff covers the rest. Design renders are scaled to the device width, so a 390pt frame compares fine against a 412dp phone — width and height differences are reported separately.

## Using it with Claude (MCP)

`figma-parity mcp` starts an [Model Context Protocol](https://modelcontextprotocol.io/) server. Add it to Claude (desktop / Claude Code):

```json
{
  "mcpServers": {
    "figma-parity": {
      "command": "npx",
      "args": ["-y", "@munei89/figma-parity", "mcp", "-c", "/absolute/path/to/figma-parity.config.mjs"],
      "env": {
        "FIGMA_TOKEN": "figd_..."
      }
    }
  }
}
```

Then ask Claude: *"Use figma-parity to check the app in my browser against the design and give me the report."*

Claude drives its own browser and the MCP server does the measuring. Available tools (11 total):

| Tool | What it does |
|---|---|
| `parity_overview` | Screens (with the URL to open each), flows, and the workflow |
| `parity_screen_spec` | Frame size, mapped elements, selectors, colors, typography, tokens, open Figma comments |
| `parity_design_image` | The Figma render as an image, for Claude's own side-by-side review |
| `parity_style_probe` | Returns JavaScript for Claude to run in the page to measure styles |
| `parity_submit_styles` | Compares the probe results against the design and records mismatches |
| `parity_compare_screenshot` | Pixel diff from a PNG path/base64; returns the outlined diff image |
| `parity_record_review` | Records Claude's qualitative findings (high severity fails the screen) |
| `parity_flow_steps` | Lists prototype interactions to test (where to start, what to tap, expected destination) |
| `parity_record_flow` | Records the outcome of one prototype interaction Claude performed |
| `parity_write_report` | Writes the HTML/JSON report with all recorded results |
| `parity_run_automated` | Runs the full headless check without Claude driving |

The style probe is the same measurement code the Playwright runner uses, so results from Claude's browser and from CI are directly comparable. You can also point the automated web runner at a browser you already have open with `target.cdpUrl` (Chrome started with `--remote-debugging-port=9222`).

## CI

In GitHub Actions, failing screens and flows show up as error annotations and the job summary gets a results table automatically.

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Start app
  run: npm run build && (npm start &) && npx wait-on http://localhost:3000

- name: Run design parity checks
  run: npx figma-parity run --markdown parity.md
  env:
    FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}

- name: Upload report
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: design-parity-report
    path: figma-parity-report
```

To pin the design (no Figma calls in CI, no rate limits), commit a snapshot:

```bash
figma-parity snapshot -s 2 -d .figma-cache
git add .figma-cache
git commit -m "Add Figma snapshot for CI"
```

Then set `figma.snapshotDir: ".figma-cache"` in your config.

## Programmatic API

```ts
import {
  loadConfig,
  runParity,
  extractDesign,
  buildPrototypeGraph,
  FigmaClient,
  type ParityReport,
} from "@munei89/figma-parity";

// Run a full parity check
const { report, htmlPath } = await runParity(await loadConfig());
if (report.summary.flows.fail) process.exit(1);

// Use the extractor and prototype parser independently
const source = new FigmaClient({
  token: process.env.FIGMA_TOKEN!,
  fileKey: "AbC123",
});

const design = await extractDesign(source);  // screens, element specs, tokens, comments, dev resources
const graph = buildPrototypeGraph(design.file);  // edges, flows, dangling links
console.log(`Found ${design.screens.length} screens and ${graph.flows.length} prototype flows`);
```

**Key exports**:
- `loadConfig(path?)` — Load and validate config
- `runParity(config, options?)` — Run checks and write report
- `extractDesign(source, options?)` — Extract design from Figma
- `buildPrototypeGraph(file)` — Build prototype flow graph
- `FigmaClient` — Figma REST API client
- `SnapshotSource` — Read from snapshot directory
- `WebDriver`, `ReactNativeDriver` — Platform drivers
- `ParitySession` — Shared state for manual runs
- `writeReport(session)` — Generate HTML/JSON report

Anything implementing `FigmaSource` (four methods) can feed it — e.g. an adapter around an existing extractor. Anything implementing `Driver` can drive the app — e.g. Detox, Maestro, or a device farm.

## Environment Variables

- `FIGMA_TOKEN`: Figma personal access token (required unless `figma.token` is set in config)

## How prototypes are read

No prototype player automation: the REST API already returns each node's `interactions` (trigger + actions with destination and navigation type), legacy `transitionNodeID`, and each page's `flowStartingPoints`. `figma-parity` turns that into a graph of screen → screen edges. In-screen state changes (`CHANGE_TO` variant swaps, `SCROLL_TO`) aren't navigation and are left out; links to deleted frames are reported as dangling.

## Troubleshooting

### "Set FIGMA_TOKEN" error

Create a [personal access token](https://help.figma.com/hc/en-us/articles/8085703771159) with file read access and set it:

```bash
export FIGMA_TOKEN=figd_...
```

Or add it to your config: `figma: { token: "figd_..." }`.

### Playwright browser not found

Install the browser:

```bash
npx playwright install chromium
```

### Appium connection refused

Make sure Appium is running:

```bash
appium
```

And the driver is installed:

```bash
appium driver install uiautomator2  # Android
appium driver install xcuitest      # iOS
```

### Text rendering differences

Figma renders text with its own engine, so text edges differ slightly from browsers. The default `thresholds.pixel` and `thresholds.visual` values absorb this; style checks are the precise layer for typography.

### Screens not found

- Check that `screens` keys match the Figma frame names (or slugs/ids)
- Use `figma-parity extract -o design.json` to see available screens
- Set `figma.pages` if your screens are on specific pages

### Flows timing out

- Increase `thresholds.flowTimeoutMs` (default: 5000)
- Check that `marker` is set for overlays and modals
- Verify `settleMs` is long enough for animations

## Limits worth knowing

- **Text rendering**: Figma's text engine differs slightly from browsers; `thresholds.pixel` and `thresholds.visual` absorb this
- **Representative data**: Pixel diffs need predictable content; mask live regions (`mask`) and seed data in `setup`
- **Variables**: Figma's newer token system needs an Enterprise plan to read via REST, so tokens are derived from applied styles
- **Unreachable screens**: Screens without a direct route/deep link are marked unreachable for the visual check (but their incoming flows are tested)

## Contributing

```bash
git clone https://github.com/Munei89/figma-parity
cd figma-parity
npm install

# Run tests
npm test

# Build
npm run build

# Type check
npm run typecheck

# End-to-end demo (requires a Playwright browser)
npm run demo
```

Pull requests welcome! Please ensure tests pass and add tests for new features.

## License

MIT © Flint (Flintdesignz), Munei89
