import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type ParityConfig } from "../config.js";
export declare function createMcpServer(load: () => Promise<ParityConfig>): McpServer;
export declare function startMcpServer(opts?: {
    configPath?: string;
}): Promise<void>;
