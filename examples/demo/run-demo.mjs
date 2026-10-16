#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runParity } from "../../dist/index.js";
import { SnapshotSource } from "../../dist/figma/snapshot.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3456;

// Simple static file server for the demo app
function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      if (req.url === "/" || req.url === "/index.html") {
        const html = await readFile(join(__dirname, "app/index.html"), "utf-8");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    
    server.listen(PORT, () => {
      console.log(`✓ Demo app running at http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

// Run the parity check
async function main() {
  console.log("figma-parity demo");
  console.log("=================\n");
  
  const server = await startServer();
  
  try {
    // Use fixture data (no FIGMA_TOKEN needed)
    const source = new SnapshotSource(join(__dirname, "fixtures"));
    
    const config = {
      figma: {
        file: "demo",
        snapshotDir: join(__dirname, "fixtures"),
      },
      target: {
        platform: "web",
        baseUrl: `http://localhost:${PORT}`,
        browser: "chromium",
        headless: true,
        scale: 1,
        settleMs: 200,
      },
      screens: {
        "Login": {
          route: "/",
          marker: '[data-testid="screen-login"]',
          ready: '[data-testid="login-form"]',
        },
      },
      elements: {
        "Welcome back": "h1",
        "Login button": '[data-testid="login-button"]',
        "Sign in": '[data-testid="login-button"]',
      },
      selectorStrategy: "testid",
      positionalFallback: true,
      checks: {
        visual: true,
        styles: true,
        flows: false, // No prototype flows in this simple demo
      },
      thresholds: {
        visual: 0.03,
        pixel: 0.12,
        region: 0.08,
        size: 2,
        color: 6,
        flowTimeoutMs: 5000,
      },
      output: {
        dir: join(__dirname, "report"),
        inline: false,
      },
    };
    
    console.log("\nRunning parity checks...\n");
    const { report, htmlPath } = await runParity(config, { source });
    
    console.log("\n" + "=".repeat(50));
    console.log("RESULTS");
    console.log("=".repeat(50));
    console.log(`\nScreens checked: ${report.summary.visual.total}`);
    console.log(`  ✓ Pass: ${report.summary.visual.pass}`);
    console.log(`  ✗ Fail: ${report.summary.visual.fail}`);
    console.log(`  ⊘ Skip: ${report.summary.visual.skip}`);
    
    if (report.summary.styles) {
      console.log(`\nStyle mismatches: ${report.summary.styles.mismatchedElements ?? 0}`);
    }
    
    console.log(`\nReport: ${htmlPath}`);
    console.log(`\nDemonstrating intentional drifts:`);
    console.log(`  1. Font size: 24px (actual) vs 28px (design)`);
    console.log(`  2. Button color: #0055ee (actual) vs #0066ff (design)`);
    console.log(`  3. Button padding: 12px (actual) vs 16px (design)`);
    
  } finally {
    server.close();
    console.log("\n✓ Demo complete\n");
  }
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
