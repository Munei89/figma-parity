# Demo

Self-contained demo of figma-parity that works without a real Figma token.

## What's Included

- **app/**: Simple HTML login page with intentional design drifts
- **fixtures/**: Mock Figma API responses and design renders
- **run-demo.mjs**: Script that runs parity checks against the demo app

## Intentional Drifts

The demo app has 3 deliberate mismatches from the design:

1. **Font size**: H1 is 24px (should be 28px)
2. **Button color**: Background is #0055ee (should be #0066ff)
3. **Button padding**: 12px (should be 16px)

## Running the Demo

```bash
# From repo root
npm run demo

# Or directly
npm run build && node examples/demo/run-demo.mjs
```

The demo will:
1. Start a local web server on port 3456
2. Run visual and style checks using Playwright
3. Generate a parity report at `examples/demo/report/report.html`
4. Show the detected mismatches

## How It Works

**No real Figma token needed** — the demo uses fixture data:

- `fixtures/file.json`: Mock Figma file structure
- `fixtures/1-1.png`: Pre-rendered design image
- `fixtures/comments.json`: Empty comments array
- `fixtures/dev-resources.json`: Empty dev resources

The `SnapshotSource` reads from the fixtures directory instead of calling the Figma API.

## Use Cases

- **Testing**: Verify parity checks work without Figma access
- **Development**: Quick feedback loop when working on features
- **Documentation**: Show what the tool does with concrete examples
- **CI**: Validate the build produces expected results
