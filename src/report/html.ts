import type { ParityReport } from "../results.js";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const pct = (n: number | null | undefined, digits = 1) => (n === null || n === undefined ? "—" : `${(n * 100).toFixed(digits)}%`);

const STATUS_LABEL: Record<string, string> = {
  pass: "Pass",
  fail: "Fail",
  unmapped: "Unmapped",
  unreachable: "Unreachable",
  error: "Error",
  skipped: "Skipped",
  blocked: "Blocked",
};

const pill = (status: string) => `<span class="pill ${esc(status)}">${esc(STATUS_LABEL[status] ?? status)}</span>`;

function screenCard(s: ParityReport["screens"][number], img: (path: string) => string) {
  const v = s.visual;
  const st = s.styles;
  const route = s.target?.route ?? s.target?.deepLink ?? "";

  const images = v
    ? `<div class="viewer" data-viewer>
        <div class="tabs" role="tablist">
          <button role="tab" aria-selected="true" data-tab="diff">Diff</button>
          <button role="tab" aria-selected="false" data-tab="design">Design</button>
          <button role="tab" aria-selected="false" data-tab="app">App</button>
          <button role="tab" aria-selected="false" data-tab="overlay">Overlay</button>
        </div>
        <div class="stage">
          <img data-pane="diff" src="${esc(img(v.images.diff))}" alt="Pixel diff for ${esc(s.name)}" loading="lazy">
          <img data-pane="design" hidden src="${esc(img(v.images.design))}" alt="Figma design for ${esc(s.name)}" loading="lazy">
          <img data-pane="app" hidden src="${esc(img(v.images.app))}" alt="App screenshot for ${esc(s.name)}" loading="lazy">
          <div data-pane="overlay" hidden class="overlay">
            <img src="${esc(img(v.images.design))}" alt="">
            <div class="top"><img src="${esc(img(v.images.app))}" alt=""></div>
            <input type="range" min="0" max="100" value="50" aria-label="Reveal app over design">
          </div>
        </div>
      </div>`
    : "";

  const metrics = v
    ? `<dl class="metrics">
        <div><dt>Similarity</dt><dd>${pct(1 - v.mismatchRatio)}</dd></div>
        <div><dt>Threshold</dt><dd>≤ ${pct(v.threshold, 1)} diff</dd></div>
        <div><dt>Height Δ</dt><dd>${v.heightDelta > 0 ? "+" : ""}${v.heightDelta}px</dd></div>
        <div><dt>Width Δ</dt><dd>${v.widthDelta > 0 ? "+" : ""}${v.widthDelta}px</dd></div>
        ${st ? `<div><dt>Elements checked</dt><dd>${st.found}/${st.checked}</dd></div>` : ""}
      </dl>`
    : "";

  const regions = v?.regions.length
    ? `<h4>Where it differs</h4><ol class="regions">${v.regions
        .map((r) => `<li><span class="path">${esc(r.path)}</span><span class="num">${pct(r.ratio, 0)} of area</span></li>`)
        .join("")}</ol>`
    : "";

  const mismatches = st?.mismatches.length
    ? `<h4>Style &amp; content mismatches <span class="count">${st.mismatches.length}</span></h4>
      <div class="table-wrap"><table>
        <thead><tr><th>Element</th><th>Property</th><th>Design</th><th>App</th></tr></thead>
        <tbody>${st.mismatches
          .map(
            (m) => `<tr>
              <td><span class="path">${esc(m.path)}</span><code>${esc(m.selector)}</code></td>
              <td>${esc(m.property)}${m.token ? `<span class="token">${esc(m.token)}</span>` : ""}</td>
              <td>${swatch(m.expected)}${esc(m.expected)}</td>
              <td>${swatch(m.actual)}${esc(m.actual ?? "—")}</td>
            </tr>`
          )
          .join("")}</tbody>
      </table></div>`
    : "";

  const review = s.review?.findings.length
    ? `<h4>Visual review <span class="by">by ${esc(s.review.by)}</span></h4><ul class="findings">${s.review.findings
        .map(
          (f) =>
            `<li class="sev-${esc(f.severity)}"><strong>${esc(f.area)}</strong> ${esc(f.issue)}${f.suggestion ? `<em>${esc(f.suggestion)}</em>` : ""}</li>`
        )
        .join("")}</ul>`
    : "";

  const comments = s.openComments.length
    ? `<details><summary>Open Figma comments (${s.openComments.length})</summary><ul class="plain">${s.openComments
        .map((c) => `<li><strong>${esc(c.author ?? "")}</strong> ${esc(c.message)}</li>`)
        .join("")}</ul></details>`
    : "";

  const dev = s.devResources.length
    ? `<details><summary>Dev resources (${s.devResources.length})</summary><ul class="plain">${s.devResources
        .map((d) => `<li><a href="${esc(d.url)}" rel="noopener">${esc(d.name)}</a></li>`)
        .join("")}</ul></details>`
    : "";

  return `<article class="screen" id="screen-${esc(s.slug)}" data-status="${esc(s.status)}">
    <header>
      <div>
        <h3>${esc(s.name)}</h3>
        <p class="sub">${esc(s.page)} · ${s.size.width}×${s.size.height}${route ? ` · <code>${esc(route)}</code>` : ""}</p>
      </div>
      ${pill(s.status)}
    </header>
    ${s.error ? `<p class="error">${esc(s.error)}</p>` : ""}
    <div class="screen-body">
      ${images}
      <div class="details">${metrics}${regions}${mismatches}${review}${comments}${dev}</div>
    </div>
  </article>`;
}

function swatch(v: unknown) {
  return typeof v === "string" && /^#[0-9a-f]{6,8}$/i.test(v) ? `<i class="sw" style="background:${esc(v)}"></i>` : "";
}

function flowRow(f: ParityReport["flows"][number], img: (path: string) => string) {
  const arrow = f.edge.kind === "overlay" ? "⇢" : f.edge.kind === "back" || f.edge.kind === "close" ? "↩" : "→";
  return `<tr data-status="${esc(f.status)}">
    <td>${pill(f.status)}</td>
    <td><span class="route">${esc(f.fromName)} <b>${arrow}</b> ${esc(f.toName ?? f.edge.kind)}</span>
      <span class="path">${esc(f.edge.hotspot.path)}</span></td>
    <td>${esc(f.edge.trigger.replace(/^ON_/, "").toLowerCase())}<span class="kind">${esc(f.edge.kind)}</span></td>
    <td>${esc(f.method)}${f.selector ? `<code>${esc(f.selector)}</code>` : ""}</td>
    <td class="note">${esc(f.note ?? "")}${f.actual ? `<span class="actual">ended at ${esc(f.actual)}</span>` : ""}${f.screenshot ? ` <a href="${esc(img(f.screenshot))}" target="_blank" rel="noopener">screenshot</a>` : ""}</td>
  </tr>`;
}

export function renderHtml(r: ParityReport, img: (path: string) => string = (p) => p): string {
  const s = r.summary;
  const testedScreens = r.screens.filter((x) => x.visual || x.styles || x.review);
  const unmapped = r.screens.filter((x) => x.status === "unmapped");

  const issues = [
    ...r.screens.filter((x) => x.status === "fail" || x.status === "error").map((x) => ({ href: `#screen-${x.slug}`, label: x.name, why: x.error ?? summariseScreen(x) })),
    ...r.flows.filter((f) => f.status === "fail").map((f) => ({ href: "#flows", label: `${f.fromName} → ${f.toName ?? f.edge.kind}`, why: f.note ?? "Flow failed" })),
  ];

  const scoreClass = s.score === null ? "" : s.score >= 90 ? "good" : s.score >= 70 ? "ok" : "bad";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design parity · ${esc(r.meta.figmaFile)}</title>
<style>
:root{--bg:#f6f6f4;--surface:#fff;--ink:#17181a;--muted:#6b6e74;--line:#e4e4e0;--accent:#3b4cca;
--pass:#147a4b;--pass-bg:#e3f4ea;--fail:#c0262d;--fail-bg:#fde7e7;--warn:#9a5b00;--warn-bg:#fdf1dc;--idle:#5d6168;--idle-bg:#eceeef;
--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--sans:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#111214;--surface:#191a1d;--ink:#ececea;--muted:#9a9da3;--line:#2a2c30;--accent:#8c98ff;
--pass:#5fd39a;--pass-bg:#173527;--fail:#ff7a7f;--fail-bg:#3d1a1c;--warn:#f2b45a;--warn-bg:#3a2a12;--idle:#a6a9ae;--idle-bg:#26282c}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 var(--sans)}
a{color:var(--accent)}code{font:12px var(--mono);background:var(--idle-bg);padding:1px 5px;border-radius:4px;word-break:break-all}
.wrap{max-width:1280px;margin:0 auto;padding:32px 20px 80px}
.masthead{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end;border-bottom:1px solid var(--line);padding-bottom:24px}
.eyebrow{font:600 11px var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0 0 6px}
h1{font-size:30px;line-height:1.15;margin:0;letter-spacing:-.02em}h2{font-size:18px;margin:48px 0 16px;letter-spacing:-.01em}
h3{font-size:16px;margin:0}h4{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:20px 0 8px}
.sub{color:var(--muted);margin:4px 0 0}
.score{text-align:right}.score b{display:block;font:700 56px/1 var(--sans);letter-spacing:-.04em}
.score.good b{color:var(--pass)}.score.ok b{color:var(--warn)}.score.bad b{color:var(--fail)}.score span{color:var(--muted);font-size:12px}
.tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:24px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.tile dt{color:var(--muted);font-size:12px}.tile dd{margin:4px 0 0;font:600 22px var(--sans);font-variant-numeric:tabular-nums}
.tile small{color:var(--muted);font-weight:400;font-size:12px;margin-left:4px}
.issues{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:4px 16px;margin:0;list-style:none}
.issues li{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}.issues li:last-child{border:0}
.issues a{font-weight:600;white-space:nowrap}.issues span{color:var(--muted)}
.toolbar{display:flex;gap:8px;align-items:center;margin-bottom:12px}
.toolbar button,.tabs button{font:inherit;font-size:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:6px;padding:4px 10px;cursor:pointer}
.toolbar button[aria-pressed=true],.tabs button[aria-selected=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.pill{display:inline-block;font:600 11px var(--sans);padding:3px 8px;border-radius:999px;white-space:nowrap;background:var(--idle-bg);color:var(--idle)}
.pill.pass{background:var(--pass-bg);color:var(--pass)}.pill.fail,.pill.error{background:var(--fail-bg);color:var(--fail)}
.pill.blocked,.pill.unreachable{background:var(--warn-bg);color:var(--warn)}
.screen{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:16px}
.screen>header{display:flex;justify-content:space-between;gap:12px;align-items:start}
.screen-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;margin-top:14px}
.screen-body:has(.viewer:only-child),.screen-body:not(:has(.viewer)){grid-template-columns:1fr}
.error{background:var(--fail-bg);color:var(--fail);border-radius:6px;padding:8px 10px;margin:12px 0 0}
.tabs{display:flex;gap:4px;margin-bottom:8px}
.stage{border:1px solid var(--line);border-radius:8px;overflow:auto;max-height:720px;background:repeating-conic-gradient(var(--idle-bg) 0 25%,transparent 0 50%) 0 0/16px 16px}
.stage img{display:block;width:100%;height:auto}
.overlay{position:relative}.overlay .top{position:absolute;inset:0;overflow:hidden;clip-path:inset(0 50% 0 0)}
.overlay input{position:sticky;bottom:8px;left:0;width:calc(100% - 16px);margin:8px}
.metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin:0}
.metrics div{border:1px solid var(--line);border-radius:8px;padding:8px 10px}.metrics dt{color:var(--muted);font-size:11px}.metrics dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums}
.regions{margin:0;padding-left:20px}.regions li{display:flex;justify-content:space-between;gap:8px;padding:2px 0}
.path{display:block;font-size:12px;color:var(--muted);word-break:break-word}.regions .path{color:var(--ink);display:inline}
.num{color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.count{background:var(--fail-bg);color:var(--fail);border-radius:999px;padding:1px 7px;margin-left:4px;letter-spacing:0}
.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600;padding:6px 8px;border-bottom:1px solid var(--line)}
td{padding:8px;border-bottom:1px solid var(--line);vertical-align:top}td code{display:inline-block;margin-top:2px}
.token,.kind,.by,.actual{display:block;font-size:11px;color:var(--muted)}
.sw{display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid var(--line);vertical-align:-2px;margin-right:6px}
.findings{list-style:none;padding:0;margin:0}.findings li{border-left:3px solid var(--idle);padding:4px 10px;margin-bottom:6px}
.findings .sev-high{border-color:var(--fail)}.findings .sev-medium{border-color:var(--warn)}.findings em{display:block;color:var(--muted)}
details{margin-top:12px}summary{cursor:pointer;color:var(--muted);font-size:13px}.plain{padding-left:18px}
.flows{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:6px 12px}
.route{font-weight:600}.route b{color:var(--muted);font-weight:400}.note{color:var(--muted);max-width:360px}
.graph{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px;overflow:auto}
.graph pre{font:12px var(--mono);white-space:pre-wrap;margin:0}
.unmapped{columns:3 220px;padding-left:18px}.snippet{font:12px var(--mono);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:12px;overflow:auto}
.tokens{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
.tokens div{display:flex;gap:8px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:8px;font-size:12px}
.tokens .sw{width:24px;height:24px;margin:0;flex:none}.type-sample{width:24px;text-align:center;font-size:16px;flex:none}
[hidden]{display:none!important}
@media (max-width:860px){.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.screen-body{grid-template-columns:1fr}.masthead{grid-template-columns:1fr}.score{text-align:left}}
</style>
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <div>
      <p class="eyebrow">Design parity report · ${esc(r.meta.tool)} ${esc(r.meta.version)}</p>
      <h1>${esc(r.meta.figmaFile)}</h1>
      <p class="sub">${esc(r.meta.platform)} · <code>${esc(r.meta.target)}</code> · Figma updated ${esc(new Date(r.meta.figmaLastModified).toLocaleString())} · generated ${esc(new Date(r.meta.generatedAt).toLocaleString())}</p>
    </div>
    <div class="score ${scoreClass}"><b>${s.score ?? "—"}</b><span>parity score</span></div>
  </header>

  <dl class="tiles">
    <div class="tile"><dt>Screens passing</dt><dd>${s.screens.pass}<small>/ ${s.screens.pass + s.screens.fail} tested</small></dd></div>
    <div class="tile"><dt>Avg. visual similarity</dt><dd>${pct(s.visual.averageSimilarity)}</dd></div>
    <div class="tile"><dt>Style mismatches</dt><dd>${s.styles.mismatches}<small>across ${s.styles.checked} elements</small></dd></div>
    <div class="tile"><dt>Prototype flows passing</dt><dd>${s.flows.pass}<small>/ ${s.flows.pass + s.flows.fail} tested · ${s.flows.total} total</small></dd></div>
  </dl>

  ${issues.length ? `<h2>Needs attention</h2><ul class="issues">${issues.map((i) => `<li><a href="${esc(i.href)}">${esc(i.label)}</a><span>${esc(i.why)}</span></li>`).join("")}</ul>` : ""}

  <h2>Screens</h2>
  <div class="toolbar" role="group" aria-label="Filter screens">
    <button aria-pressed="true" data-filter="all">All (${testedScreens.length})</button>
    <button aria-pressed="false" data-filter="fail">Failing (${testedScreens.filter((x) => x.status === "fail").length})</button>
  </div>
  <div id="screens">${testedScreens.map((x) => screenCard(x, img)).join("") || `<p class="sub">No screens were tested. Map screens in your config to start comparing.</p>`}</div>

  <h2 id="flows">Prototype flows</h2>
  ${
    r.flows.length
      ? `<div class="flows table-wrap"><table>
      <thead><tr><th>Status</th><th>Transition</th><th>Trigger</th><th>Driven by</th><th>Notes</th></tr></thead>
      <tbody>${r.flows.map((f) => flowRow(f, img)).join("")}</tbody></table></div>`
      : `<p class="sub">No prototype interactions were checked.</p>`
  }
  ${r.danglingEdges.length ? `<p class="sub">${r.danglingEdges.length} prototype link(s) point at frames that no longer exist in the file.</p>` : ""}

  <h2>Prototype map</h2>
  <div class="graph"><pre class="mermaid">${esc(r.mermaid)}</pre></div>
  <p class="sub">Paste into <a href="https://mermaid.live" rel="noopener">mermaid.live</a> if the diagram doesn't render offline.</p>

  ${
    unmapped.length
      ? `<h2>Unmapped screens <span class="count">${unmapped.length}</span></h2>
    <p class="sub">These frames exist in Figma but aren't in <code>screens</code>, so they weren't compared.</p>
    <ul class="unmapped">${unmapped.map((u) => `<li>${esc(u.name)} <span class="path">${esc(u.page)}</span></li>`).join("")}</ul>
    <pre class="snippet">screens: {\n${unmapped
      .slice(0, 8)
      .map((u) => `  ${JSON.stringify(u.name)}: { route: "/${esc(u.slug)}", marker: '[data-testid="screen-${esc(u.slug)}"]' },`)
      .join("\n")}\n}</pre>`
      : ""
  }

  ${
    Object.keys(r.tokens.colors).length || Object.keys(r.tokens.typography).length
      ? `<h2>Design tokens in use</h2><div class="tokens">${Object.entries(r.tokens.colors)
          .map(([n, hex]) => `<div><i class="sw" style="background:${esc(hex)}"></i><span>${esc(n)}<span class="path">${esc(hex)}</span></span></div>`)
          .join("")}${Object.entries(r.tokens.typography)
          .map(
            ([n, t]) =>
              `<div><span class="type-sample" style="font-weight:${esc(t.fontWeight ?? 400)}">Aa</span><span>${esc(n)}<span class="path">${esc([t.fontFamily, t.fontSize && `${t.fontSize}px`, t.lineHeightPx && `/${Math.round(t.lineHeightPx)}`, t.fontWeight].filter(Boolean).join(" "))}</span></span></div>`
          )
          .join("")}</div>`
      : ""
  }
</div>
<script>
document.querySelectorAll("[data-viewer]").forEach((v) => {
  v.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    v.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    v.querySelectorAll("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.tab));
  }));
  const range = v.querySelector("input[type=range]");
  const top = v.querySelector(".overlay .top");
  range && range.addEventListener("input", () => (top.style.clipPath = "inset(0 " + (100 - range.value) + "% 0 0)"));
});
document.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll("[data-filter]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  document.querySelectorAll(".screen").forEach((s) => (s.hidden = b.dataset.filter === "fail" && s.dataset.status !== "fail"));
}));
</script>
<script type="module">
try {
  const { default: mermaid } = await import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs");
  mermaid.initialize({ startOnLoad: false, theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "neutral" });
  await mermaid.run({ querySelector: ".mermaid" });
} catch { /* offline: the graph stays as text */ }
</script>
</body>
</html>`;
}

function summariseScreen(s: ParityReport["screens"][number]) {
  const parts = [];
  if (s.visual?.status === "fail") parts.push(`${pct(s.visual.mismatchRatio)} of pixels differ`);
  if (s.styles?.mismatches.length) parts.push(`${s.styles.mismatches.length} style mismatch${s.styles.mismatches.length === 1 ? "" : "es"}`);
  const high = s.review?.findings.filter((f) => f.severity === "high").length;
  if (high) parts.push(`${high} high-severity review finding${high === 1 ? "" : "s"}`);
  return parts.join(" · ") || "Failed";
}
