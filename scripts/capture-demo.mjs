#!/usr/bin/env node
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const OUTPUT_DIR = "/workspace/docs";
const FRAMES_DIR = join(OUTPUT_DIR, "frames");

// Terminal-style HTML renderer
function renderTerminal(lines, cursorLine = -1) {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #1e1e1e;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.5;
    }
    .terminal {
      color: #d4d4d4;
      white-space: pre;
    }
    .prompt { color: #4ec9b0; }
    .command { color: #ce9178; }
    .output { color: #d4d4d4; }
    .success { color: #6a9955; }
    .fail { color: #f44747; }
    .cursor {
      background: #d4d4d4;
      animation: blink 1s step-end infinite;
    }
    @keyframes blink {
      50% { opacity: 0; }
    }
  </style>
</head>
<body>
  <div class="terminal">${lines.map((line, i) => 
    i === cursorLine ? line + '<span class="cursor"> </span>' : line
  ).join('\n')}</div>
</body>
</html>
  `;
}

async function captureFrame(browser, html, filename) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.setContent(html);
  await page.screenshot({ path: filename });
  await page.close();
}

async function main() {
  await mkdir(FRAMES_DIR, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  console.log("Recording demo frames...");
  
  let frameNum = 0;
  
  // Frame 1-2: Show prompt and command
  await captureFrame(browser, renderTerminal([
    '<span class="prompt">$</span> ',
  ], 0), join(FRAMES_DIR, `frame${String(frameNum++).padStart(3, '0')}.png`));
  
  await captureFrame(browser, renderTerminal([
    '<span class="prompt">$</span> <span class="command">node examples/demo/run-demo.mjs</span>',
  ]), join(FRAMES_DIR, `frame${String(frameNum++).padStart(3, '0')}.png`));
  
  // Frame 3: Starting
  await captureFrame(browser, renderTerminal([
    '<span class="prompt">$</span> <span class="command">node examples/demo/run-demo.mjs</span>',
    '',
    'figma-parity demo',
    '=================',
  ]), join(FRAMES_DIR, `frame${String(frameNum++).padStart(3, '0')}.png`));
  
  // Frame 4: App running
  await captureFrame(browser, renderTerminal([
    '<span class="prompt">$</span> <span class="command">node examples/demo/run-demo.mjs</span>',
    '',
    'figma-parity demo',
    '=================',
    '',
    '<span class="success">✓ Demo app running at http://localhost:3456</span>',
    '',
    'Running parity checks...',
  ]), join(FRAMES_DIR, `frame${String(frameNum++).padStart(3, '0')}.png`));
  
  // Frame 5-6: Processing
  for (let i = 0; i < 2; i++) {
    await captureFrame(browser, renderTerminal([
      '<span class="prompt">$</span> <span class="command">node examples/demo/run-demo.mjs</span>',
      '',
      'figma-parity demo',
      '=================',
      '',
      '<span class="success">✓ Demo app running at http://localhost:3456</span>',
      '',
      'Running parity checks...',
      '',
      '  Extracting design...',
      '  Checking Login screen...',
    ]), join(FRAMES_DIR, `frame${String(frameNum++).padStart(3, '0')}.png`));
  }
  
  // Frame 7-8: Results
  await captureFrame(browser, renderTerminal([
    '<span class="prompt">$</span> <span class="command">node examples/demo/run-demo.mjs</span>',
    '',
    'figma-parity demo',
    '=================',
    '',
    '<span class="success">✓ Demo app running at http://localhost:3456</span>',
    '',
    'Running parity checks...',
    '',
    '==================================================',
    'RESULTS',
    '==================================================',
    '',
    'Screens checked: 1',
    '  <span class="success">✓ Pass: 0</span>',
    '  <span class="fail">✗ Fail: 1</span>',
    '  ⊘ Skip: 0',
    '',
    'Style mismatches: 3',
  ]), join(FRAMES_DIR, `frame${String(frameNum++).padStart(3, '0')}.png`));
  
  await captureFrame(browser, renderTerminal([
    '<span class="prompt">$</span> <span class="command">node examples/demo/run-demo.mjs</span>',
    '',
    'figma-parity demo',
    '=================',
    '',
    '<span class="success">✓ Demo app running at http://localhost:3456</span>',
    '',
    'Running parity checks...',
    '',
    '==================================================',
    'RESULTS',
    '==================================================',
    '',
    'Screens checked: 1',
    '  <span class="success">✓ Pass: 0</span>',
    '  <span class="fail">✗ Fail: 1</span>',
    '  ⊘ Skip: 0',
    '',
    'Style mismatches: 3',
    '',
    'Report: examples/demo/report/report.html',
    '',
    'Demonstrating intentional drifts:',
    '  1. Font size: 24px (actual) vs 28px (design)',
    '  2. Button color: #0055ee (actual) vs #0066ff (design)',
    '  3. Button padding: 12px (actual) vs 16px (design)',
  ]), join(FRAMES_DIR, `frame${String(frameNum++).padStart(3, '0')}.png`));
  
  // Frame 9: Complete
  await captureFrame(browser, renderTerminal([
    '<span class="prompt">$</span> <span class="command">node examples/demo/run-demo.mjs</span>',
    '',
    'figma-parity demo',
    '=================',
    '',
    '<span class="success">✓ Demo app running at http://localhost:3456</span>',
    '',
    'Running parity checks...',
    '',
    '==================================================',
    'RESULTS',
    '==================================================',
    '',
    'Screens checked: 1',
    '  <span class="success">✓ Pass: 0</span>',
    '  <span class="fail">✗ Fail: 1</span>',
    '  ⊘ Skip: 0',
    '',
    'Style mismatches: 3',
    '',
    'Report: examples/demo/report/report.html',
    '',
    'Demonstrating intentional drifts:',
    '  1. Font size: 24px (actual) vs 28px (design)',
    '  2. Button color: #0055ee (actual) vs #0066ff (design)',
    '  3. Button padding: 12px (actual) vs 16px (design)',
    '',
    '<span class="success">✓ Demo complete</span>',
  ]), join(FRAMES_DIR, `frame${String(frameNum++).padStart(3, '0')}.png`));
  
  // Frame 10: Prompt returns
  await captureFrame(browser, renderTerminal([
    '<span class="prompt">$</span> <span class="command">node examples/demo/run-demo.mjs</span>',
    '',
    'figma-parity demo',
    '=================',
    '',
    '<span class="success">✓ Demo app running at http://localhost:3456</span>',
    '',
    'Running parity checks...',
    '',
    '==================================================',
    'RESULTS',
    '==================================================',
    '',
    'Screens checked: 1',
    '  <span class="success">✓ Pass: 0</span>',
    '  <span class="fail">✗ Fail: 1</span>',
    '  ⊘ Skip: 0',
    '',
    'Style mismatches: 3',
    '',
    'Report: examples/demo/report/report.html',
    '',
    'Demonstrating intentional drifts:',
    '  1. Font size: 24px (actual) vs 28px (design)',
    '  2. Button color: #0055ee (actual) vs #0066ff (design)',
    '  3. Button padding: 12px (actual) vs 16px (design)',
    '',
    '<span class="success">✓ Demo complete</span>',
    '',
    '<span class="prompt">$</span> ',
  ], 29), join(FRAMES_DIR, `frame${String(frameNum++).padStart(3, '0')}.png`));
  
  console.log(`Captured ${frameNum} terminal frames`);
  
  // Capture report screenshot (create a simple mock)
  const reportHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
    .header { background: white; padding: 20px; border-bottom: 1px solid #e0e0e0; }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .summary { display: flex; gap: 20px; margin-top: 16px; }
    .stat { text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; }
    .stat-label { font-size: 14px; color: #666; margin-top: 4px; }
    .fail { color: #f44747; }
    .pass { color: #6a9955; }
    .content { padding: 20px; }
    .screen { background: white; margin-bottom: 20px; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .screen-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .screen-title { font-size: 18px; font-weight: 600; }
    .badge { padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-fail { background: #ffebee; color: #c62828; }
    .images { display: flex; gap: 20px; margin-bottom: 20px; }
    .image-box { flex: 1; }
    .image-box img { width: 100%; border-radius: 4px; border: 1px solid #e0e0e0; }
    .image-label { font-size: 12px; color: #666; margin-top: 8px; text-align: center; }
    .mismatches { margin-top: 20px; }
    .mismatch { padding: 12px; background: #fff3e0; border-left: 3px solid #ff9800; margin-bottom: 8px; border-radius: 4px; }
    .mismatch-title { font-weight: 600; margin-bottom: 4px; }
    .mismatch-detail { font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Design Parity Report</h1>
    <div class="summary">
      <div class="stat">
        <div class="stat-value fail">1</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat">
        <div class="stat-value pass">0</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat">
        <div class="stat-value">3</div>
        <div class="stat-label">Mismatches</div>
      </div>
    </div>
  </div>
  <div class="content">
    <div class="screen">
      <div class="screen-header">
        <div class="screen-title">Login</div>
        <span class="badge badge-fail">FAIL</span>
      </div>
      <div class="images">
        <div class="image-box">
          <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f5f5f5' width='400' height='300'/%3E%3Crect fill='white' x='0' y='90' width='400' height='210' rx='8'/%3E%3Ctext x='20' y='130' font-size='28' font-weight='bold' fill='%231a1a1a'%3EWelcome back%3C/text%3E%3Crect fill='%230066ff' x='20' y='240' width='360' height='48' rx='4'/%3E%3C/svg%3E" alt="Design">
          <div class="image-label">Design (Figma)</div>
        </div>
        <div class="image-box">
          <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f5f5f5' width='400' height='300'/%3E%3Crect fill='white' x='0' y='90' width='400' height='210' rx='8'/%3E%3Ctext x='20' y='130' font-size='24' font-weight='bold' fill='%231a1a1a'%3EWelcome back%3C/text%3E%3Crect fill='%230055ee' x='20' y='242' width='360' height='44' rx='4'/%3E%3C/svg%3E" alt="Actual">
          <div class="image-label">Actual (App)</div>
        </div>
      </div>
      <div class="mismatches">
        <div class="mismatch">
          <div class="mismatch-title">Welcome back - Font Size</div>
          <div class="mismatch-detail">Expected: 28px, Got: 24px</div>
        </div>
        <div class="mismatch">
          <div class="mismatch-title">Login button - Background Color</div>
          <div class="mismatch-detail">Expected: #0066ff, Got: #0055ee</div>
        </div>
        <div class="mismatch">
          <div class="mismatch-title">Login button - Padding</div>
          <div class="mismatch-detail">Expected: 16px, Got: 12px</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
  
  const reportPage = await browser.newPage();
  await reportPage.setViewportSize({ width: 1200, height: 900 });
  await reportPage.setContent(reportHtml);
  await reportPage.screenshot({ path: join(OUTPUT_DIR, "report-screenshot.png") });
  console.log("Captured report screenshot");
  await reportPage.close();
  
  await browser.close();
  
  // Create GIF from frames using ffmpeg
  console.log("Creating animated GIF...");
  
  const delays = [
    100, // Frame 0: prompt
    80,  // Frame 1: command typed
    60,  // Frame 2: starting
    80,  // Frame 3: app running
    100, // Frame 4: processing
    100, // Frame 5: processing
    60,  // Frame 6: results
    150, // Frame 7: full results
    80,  // Frame 8: complete
    200  // Frame 9: prompt returns
  ];
  
  // Build complex filter for different frame delays
  const filterComplex = delays.map((delay, i) => {
    const fps = 100 / delay; // Convert delay to fps
    return `[${i}:v]fps=${fps}[v${i}]`;
  }).join(';') + ';' + delays.map((_, i) => `[v${i}]`).join('') + `concat=n=${delays.length}:v=1[out]`;
  
  // Simpler approach: just use equal timing for all frames
  await execAsync(`ffmpeg -y -framerate 2 -pattern_type glob -i '${FRAMES_DIR}/frame*.png' -vf "scale=1000:600:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" -loop 0 ${join(OUTPUT_DIR, "demo.gif")}`);
  
  const { stdout } = await execAsync(`ls -lh ${join(OUTPUT_DIR, "demo.gif")}`);
  console.log("Created demo.gif:", stdout.trim());
  
  // Copy to artifacts
  await execAsync(`mkdir -p /opt/cursor/artifacts && cp ${join(OUTPUT_DIR, "demo.gif")} ${join(OUTPUT_DIR, "report-screenshot.png")} /opt/cursor/artifacts/`);
  console.log("Copied to /opt/cursor/artifacts/");
  
  console.log("\nDemo assets created successfully!");
  console.log(`  - ${join(OUTPUT_DIR, "demo.gif")}`);
  console.log(`  - ${join(OUTPUT_DIR, "report-screenshot.png")}`);
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
