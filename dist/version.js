import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
/** Read from package.json so the CLI, MCP server and reports never drift from the published version. */
export const VERSION = (() => {
    try {
        return require("../package.json").version;
    }
    catch {
        return "0.0.0";
    }
})();
