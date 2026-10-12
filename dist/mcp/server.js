import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { runParity } from "../runner.js";
import { VERSION } from "../version.js";
import { ParityAgentApi } from "./api.js";
const json = (v) => ({ content: [{ type: "text", text: JSON.stringify(v, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] });
export function createMcpServer(load) {
    const server = new McpServer({ name: "figma-parity", version: VERSION });
    let api;
    const getApi = () => (api ??= load().then(ParityAgentApi.create).catch((e) => ((api = undefined), Promise.reject(e))));
    const screen = z.string().describe("Figma screen name, slug or node id");
    const tool = (name, description, inputSchema, run) => server.registerTool(name, { description, inputSchema }, (async (args) => {
        try {
            return await run(args, await getApi());
        }
        catch (e) {
            return fail(e);
        }
    }));
    tool("parity_overview", "Start here. Lists the Figma screens (with the URL/deep link to open each), prototype flows, and the workflow for checking the running app against the design.", {}, (_a, api) => json(api.overview()));
    tool("parity_screen_spec", "Design spec for one screen: frame size, how to open it, and each mapped element with its selector, position, colours, typography, text and design tokens.", { screen }, ({ screen: s }, api) => json(api.screenSpec(s)));
    tool("parity_design_image", "Returns the Figma render of a screen as an image so you can compare it visually with what the browser shows.", { screen, scale: z.number().min(0.25).max(3).optional().describe("Render scale, default 1") }, async ({ screen: s, scale }, api) => {
        const png = await api.designImage(s, scale ?? 1);
        return { content: [{ type: "image", data: png.toString("base64"), mimeType: "image/png" }] };
    });
    tool("parity_style_probe", "Returns JavaScript to run in the app's page (e.g. with your browser's JavaScript tool) once the screen is open. Its return value is a JSON string to pass to parity_submit_styles.", { screen }, ({ screen: s }, api) => {
        const p = api.styleProbe(s);
        return { content: [{ type: "text", text: `Run this in the page (${p.selectors} selectors), then pass the returned string to parity_submit_styles:\n\n${p.script}` }] };
    });
    tool("parity_submit_styles", "Compares the measurements returned by the style probe against the design and records the result for the report.", { screen, probe_result: z.string().describe("The JSON string the probe script returned") }, ({ screen: s, probe_result }, api) => json(api.submitStyles(s, probe_result)));
    tool("parity_compare_screenshot", "Pixel-diffs a PNG screenshot of the app (file path or base64) against the Figma frame and records it. Returns the diff image with the differing areas outlined.", {
        screen,
        path: z.string().optional().describe("Path to a PNG on this machine"),
        base64: z.string().optional().describe("PNG as base64 (data URI ok)"),
        viewport_width: z.number().optional().describe("CSS width the screenshot was taken at; defaults to the frame width"),
    }, async ({ screen: s, path, base64, viewport_width }, api) => {
        const { result, summary } = await api.compareScreenshot(s, { path, base64, viewportWidth: viewport_width });
        return {
            content: [
                { type: "text", text: JSON.stringify(summary, null, 2) },
                { type: "image", data: result.images.diff.toString("base64"), mimeType: "image/png" },
            ],
        };
    });
    tool("parity_record_review", "Records what you saw when comparing the design image with the live screen (layout, spacing, colour, copy, missing or extra elements). High-severity findings fail the screen.", {
        screen,
        findings: z
            .array(z.object({
            severity: z.enum(["high", "medium", "low"]),
            area: z.string().describe("Element or region, e.g. 'Header / Login button'"),
            issue: z.string(),
            suggestion: z.string().optional(),
        }))
            .describe("Empty array if the screen matches"),
    }, ({ screen: s, findings }, api) => json(api.recordReview(s, findings)));
    tool("parity_flow_steps", "Prototype interactions to test: where to start, which element to interact with (selector, or its position in the design), and where the app should end up. Optionally filter by source screen.", { screen: screen.optional() }, ({ screen: s }, api) => json(api.flowSteps(s)));
    tool("parity_record_flow", "Records the outcome of one prototype interaction you performed in the browser.", {
        edge_id: z.string(),
        status: z.enum(["pass", "fail", "blocked", "skipped"]),
        actual: z.string().optional().describe("Where the app ended up (URL/screen)"),
        note: z.string().optional(),
    }, ({ edge_id, status, actual, note }, api) => json(api.recordFlow(edge_id, status, actual, note)));
    tool("parity_write_report", "Writes report.html and report.json with everything recorded so far and returns their paths and the summary.", {}, async (_a, api) => json(await api.writeReport()));
    tool("parity_run_automated", "Runs the full automated check (headless Playwright for web, Appium for React Native) without the agent driving, and writes the report.", { only: z.array(z.string()).optional().describe("Limit to these screens") }, async ({ only }) => {
        const config = await load();
        const { report, htmlPath } = await runParity(config, { only });
        return json({ htmlPath, summary: report.summary });
    });
    return server;
}
export async function startMcpServer(opts = {}) {
    const server = createMcpServer(() => loadConfig(opts.configPath));
    await server.connect(new StdioServerTransport());
}
