import type { FileResponse, Rect } from "./types.js";
import { findScreens } from "./extract.js";
import { relativeRect, walk } from "./util.js";

export type EdgeKind = "navigate" | "overlay" | "swap" | "back" | "close" | "url";

export interface FlowEdge {
  /** Stable id: `${triggerNodeId}:${index}` */
  id: string;
  from: string;
  to: string | null;
  kind: EdgeKind;
  trigger: string;
  timeoutMs?: number;
  url?: string;
  /** The hotspot the user interacts with. */
  hotspot: { id: string; name: string; path: string; box: Rect };
  transition?: string;
}

export interface Flow {
  name: string;
  start: string;
  /** Screens reachable from the start, in BFS order. */
  screens: string[];
  edges: string[];
}

export interface PrototypeGraph {
  screens: Record<string, { id: string; name: string }>;
  edges: FlowEdge[];
  flows: Flow[];
  /** Edges whose destination couldn't be resolved to a screen (deleted frames etc). */
  dangling: FlowEdge[];
}

const NAV_KIND: Record<string, "navigate" | "overlay" | "swap"> = {
  NAVIGATE: "navigate",
  OVERLAY: "overlay",
  SWAP: "swap",
};

/**
 * Reads prototype wiring straight from the file: node `interactions`
 * (current API), legacy `transitionNodeID`, and each page's
 * `flowStartingPoints`. No prototype player automation needed.
 */
/**
 * Build a prototype flow graph from a Figma file.
 * Parses interactions, transitionNodeID, and flowStartingPoints into a graph of screen → screen edges.
 * @param file - Figma file response
 * @returns Prototype graph with screens, edges, flows, and dangling links
 */
export function buildPrototypeGraph(file: FileResponse): PrototypeGraph {
  const screenNodes = findScreens(file.document).map((s) => s.node);
  const screens: PrototypeGraph["screens"] = {};
  const owner = new Map<string, string>(); // any node id -> owning screen id

  for (const s of screenNodes) {
    screens[s.id] = { id: s.id, name: s.name };
    walk(s, (n) => void owner.set(n.id, s.id));
  }

  const edges: FlowEdge[] = [];
  const dangling: FlowEdge[] = [];

  for (const screen of screenNodes) {
    const origin = screen.absoluteBoundingBox!;

    walk(screen, (n, parents) => {
      if (n.visible === false) return false;

      const hotspot = {
        id: n.id,
        name: n.name,
        path: [...parents.slice(1).map((p) => p.name), n.name].join("/"),
        box: n.absoluteBoundingBox ? relativeRect(n.absoluteBoundingBox, origin) : { x: 0, y: 0, width: 0, height: 0 },
      };

      let i = 0;
      const push = (e: Omit<FlowEdge, "id" | "from" | "hotspot">, rawDest?: string | null) => {
        const edge = { id: `${n.id}:${i++}`, from: screen.id, hotspot, ...e } as FlowEdge;
        if (rawDest !== undefined) {
          const dest = rawDest ? owner.get(rawDest) : undefined;
          if (!dest) {
            dangling.push({ ...edge, to: null });
            return;
          }
          edge.to = dest;
        }
        edges.push(edge);
      };

      if (n.interactions?.length) {
        for (const it of n.interactions) {
          const trigger = it.trigger?.type ?? "ON_CLICK";
          const timeoutMs = it.trigger?.timeout !== undefined ? it.trigger.timeout * 1000 : undefined;
          for (const a of it.actions ?? []) {
            const transition = a.transition?.type;
            if (a.type === "NODE") {
              const kind = NAV_KIND[a.navigation ?? "NAVIGATE"];
              if (!kind) continue; // SCROLL_TO / CHANGE_TO are in-screen state, not navigation
              push({ to: null, kind, trigger, timeoutMs, transition }, a.destinationId ?? null);
            } else if (a.type === "BACK") push({ to: null, kind: "back", trigger, timeoutMs });
            else if (a.type === "CLOSE") push({ to: null, kind: "close", trigger, timeoutMs });
            else if (a.type === "URL" && a.url) push({ to: null, kind: "url", trigger, url: a.url });
          }
        }
      } else if (n.transitionNodeID) {
        push({ to: null, kind: "navigate", trigger: "ON_CLICK" }, n.transitionNodeID);
      }
    });
  }

  // Flows: explicit starting points per page, else the page's prototype start node.
  const starts: { name: string; nodeId: string }[] = [];
  for (const page of file.document.children ?? []) {
    if (page.flowStartingPoints?.length) starts.push(...page.flowStartingPoints);
    else if (page.prototypeStartNodeID) starts.push({ name: page.name, nodeId: page.prototypeStartNodeID });
  }

  const outgoing = new Map<string, FlowEdge[]>();
  for (const e of edges) outgoing.set(e.from, [...(outgoing.get(e.from) ?? []), e]);

  const flows: Flow[] = [];
  for (const s of starts) {
    const start = owner.get(s.nodeId);
    if (!start) continue;
    const seen = [start];
    const flowEdges: string[] = [];
    for (let q = 0; q < seen.length; q++) {
      for (const e of outgoing.get(seen[q]) ?? []) {
        flowEdges.push(e.id);
        if (e.to && !seen.includes(e.to)) seen.push(e.to);
      }
    }
    flows.push({ name: s.name, start, screens: seen, edges: flowEdges });
  }

  return { screens, edges, flows, dangling };
}

/** Mermaid flowchart text, handy for docs and the report. */
export function graphToMermaid(g: PrototypeGraph): string {
  const id = (s: string) => `s${s.replace(/[^A-Za-z0-9]/g, "_")}`;
  const esc = (s: string) => s.replace(/"/g, "'");
  const lines = ["flowchart LR"];
  for (const s of Object.values(g.screens)) lines.push(`  ${id(s.id)}["${esc(s.name)}"]`);
  for (const e of g.edges) {
    if (!e.to) continue;
    const arrow = e.kind === "overlay" ? "-.->" : "-->";
    lines.push(`  ${id(e.from)} ${arrow}|"${esc(e.hotspot.name)}"| ${id(e.to)}`);
  }
  return lines.join("\n");
}
