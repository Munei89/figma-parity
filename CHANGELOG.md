# Changelog

## 0.1.0 — 2026-10-13

**Package renamed** from `@flintdesignz/figma-parity` to `@munei89/figma-parity`. Update your `package.json` and imports. No breaking changes to the API.

First release:

- Figma extraction: screens, element specs (geometry, fills, strokes, radii, auto-layout padding/gap, typography, copy), tokens from applied styles, open comments, dev resources.
- Prototype graph from `interactions`, legacy `transitionNodeID` and `flowStartingPoints`: navigate, overlay, swap, back, close, after-delay; dangling links reported.
- Web runner (Playwright, or an existing Chrome over CDP) and React Native runner (Appium via WebdriverIO).
- Checks: pixel diff with per-element attribution, style/copy comparison linked to Figma tokens, prototype flow replay with positional fallback.
- HTML + JSON report; Markdown summary; GitHub Actions annotations and job summary.
- MCP server so Claude (or any browser-capable agent) can drive the checks from its own browser.
- CLI: `init`, `run`, `extract`, `flows`, `snapshot`, `mcp`.
