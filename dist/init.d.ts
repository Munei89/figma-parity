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
export declare function generateConfig(design: DesignExtract, graph: PrototypeGraph, o: InitOptions): string;
