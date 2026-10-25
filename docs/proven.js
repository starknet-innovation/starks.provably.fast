// starks.provably.fast: the targets board, the query count, Built together and the brief on the
// home page (kit.css draws them), the record page and the background's regime chart, all from
// data/mathematics.json (written by `python3 -m proven.mathematics board`). Nothing moves.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const SVG = "http://www.w3.org/2000/svg";
  // ?capture renders the final state at once, for the share image (og.png).
  const capture = new URLSearchParams(location.search).has("capture");
  if (capture) document.documentElement.classList.add("capture");
  const still = capture || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window);

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "class") node.className = value; else node.setAttribute(key, value);
    }
    for (const child of children.flat()) {
      if (child !== null && child !== undefined) node.append(child instanceof Node ? child : String(child));
    }
    return node;
  }
  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }

  function initTheme() {
    try {
      const saved = localStorage.getItem("pf-theme");
      if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
    } catch { /* storage unavailable */ }
    const button = $("theme-toggle");
    const current = () => document.documentElement.dataset.theme
      || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const label = () => button.setAttribute("aria-label", `Switch to ${current() === "dark" ? "light" : "dark"} theme`);
    label();
    button.addEventListener("click", () => {
      const next = current() === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      label();
      try { localStorage.setItem("pf-theme", next); } catch { /* storage unavailable */ }
    });
  }

  // Scroll reveals: one observer for every block that animates in.
  function reveal(nodes, onIn) {
    if (still) { nodes.forEach((n) => { n.classList.add("is-in"); if (onIn) onIn(n); }); return; }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        if (onIn) onIn(entry.target);
        io.unobserve(entry.target);
      }
    }, { threshold: 0.15 });
    nodes.forEach((n) => io.observe(n));
  }

  // Agreement thresholds by rate. a1 is the first-order curve of Dao, Kominers and Thaler
  // (ePrint 2026/2056, equation 31): one branch below rho_c = 11 - 3 sqrt(13), another above.
  const RHO_C = 11 - 3 * Math.sqrt(13);
  function a1(r) {
    if (r >= RHO_C) return (3 * r + 2 * Math.sqrt(r * (5 - r) * (2 - r))) / (8 - r);
    const t = Math.sqrt(r / 2);
    let lo = 0, hi = 1;
    for (let i = 0; i < 60; i += 1) { const m = (lo + hi) / 2; if (m * m * (m + 3) < t) lo = m; else hi = m; }
    return t * (1 + lo);
  }
  const CURVES = [
    { id: "unique", name: "unique decoding", formula: "(1 + ρ) / 2", f: (r) => (1 + r) / 2 },
    { id: "johnson", name: "Johnson", formula: "√ρ", f: (r) => Math.sqrt(r) },
    { id: "first", name: "first order", formula: "a₁(ρ)", f: a1 },
    { id: "capacity", name: "limit", formula: "ρ", f: (r) => r },
  ];

  function regimeChart() {
    const root = $("regime-plot");
    if (!root) return;
    let drawn = 0;
    const draw = () => {
      const width = Math.round(Math.min(1000, Math.max(300, root.clientWidth || 1000)));
      if (Math.abs(width - drawn) < 40) return;
      drawn = width;
      buildRegime(root, width);
    };
    draw();
    if ("ResizeObserver" in window) new ResizeObserver(draw).observe(root);
  }
  function buildRegime(root, W) {
    const read = $("regime-read");
    const narrow = W < 720, tiny = W < 480;
    const H = narrow ? Math.round(W * 0.8) : 430, L = 54, R = 18, T = 14, B = 46;
    const X = (r) => L + r * (W - L - R), Y = (a) => T + (1 - a) * (H - T - B);
    const svg = svgEl("svg", { class: "regime-svg", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-labelledby": "regime-title regime-desc", });
    const desc = svgEl("desc", { id: "regime-desc" });
    desc.textContent = "Agreement thresholds by code rate, with marks at the rates provers use, 1/8, 1/4 and 1/2. Above the Johnson curve the count of bad challenges is known to be linear. Between the first-order curve and the Johnson curve a quadratic bound is known; T1 asks for a linear one. Between the limit and the first-order curve the known bounds are polynomial, with exponents that depend on the rate and the gap; T3 asks for a small one.";
    const defs = svgEl("defs");
    const hatch = svgEl("pattern", { id: "rg-hatch", width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    hatch.append(svgEl("line", { class: "rg-hatch-line", x1: 0, y1: 0, x2: 0, y2: 7 }));
    defs.append(hatch);
    svg.append(desc, defs);
    // Grid and axes.
    const grid = svgEl("g", { class: "rg-fade" });
    const ticks = [[0, "0"], [0.25, "1/4"], [0.5, "1/2"], [0.75, "3/4"], [1, "1"]];
    for (const [v, label] of ticks) {
      grid.append(svgEl("line", { class: "rg-grid", x1: X(v), x2: X(v), y1: Y(0), y2: Y(1) }));
      grid.append(svgEl("line", { class: "rg-grid", x1: X(0), x2: X(1), y1: Y(v), y2: Y(v) }));
      const tx = svgEl("text", { class: "rg-axis", x: X(v), y: Y(0) + 20, "text-anchor": "middle" }); tx.textContent = label; grid.append(tx);
      const ty = svgEl("text", { class: "rg-axis", x: L - 10, y: Y(v) + 4, "text-anchor": "end" }); ty.textContent = label; grid.append(ty);
    }
    const xt = svgEl("text", { class: "rg-axis-title", x: X(1), y: Y(0) + 40, "text-anchor": "end" }); xt.textContent = "code rate ρ";
    const yt = svgEl("text", { class: "rg-axis-title", x: L - 10, y: Y(1) - 2, "text-anchor": "end" }); yt.textContent = "";
    const ytl = svgEl("text", { class: "rg-axis-title", x: X(0) + 8, y: Y(1) + 16 }); ytl.textContent = "agreement a";
    grid.append(xt, yt, ytl);
    svg.append(grid);
    // Where provers run: the rates deployed STARKs use.
    const provers = svgEl("g", { class: "rg-fade", style: "--d: 1.1s" });
    for (const r of [0.125, 0.25, 0.5]) provers.append(svgEl("line", { class: "rg-prover", x1: X(r), x2: X(r), y1: Y(1), y2: Y(0) }));
    const pl = svgEl("text", { class: "rg-prover-text", x: X(0.125) + 6, y: Y(1) + 34 }); pl.textContent = tiny ? "provers run here" : "where provers run: rates 1/8, 1/4 and 1/2";
    provers.append(pl);
    svg.append(provers);
    // Bands between the curves.
    const N = 240, rs = Array.from({ length: N + 1 }, (_, i) => 0.0005 + (0.999 - 0.0005) * (i / N));
    const line = (f) => rs.map((r, i) => `${i ? "L" : "M"}${X(r).toFixed(1)} ${Y(f(r)).toFixed(1)}`).join(" ");
    const band = (upper, lower) => `${line(upper)} ${rs.slice().reverse().map((r) => `L${X(r).toFixed(1)} ${Y(lower(r)).toFixed(1)}`).join(" ")} Z`;
    const bands = svgEl("g", { class: "rg-fade", style: "--d: .9s" });
    bands.append(
      svgEl("path", { class: "rg-band-linear", d: band(() => 1, CURVES[1].f) }),
      svgEl("path", { class: "rg-band-quad", d: band(CURVES[1].f, a1) }),
      svgEl("path", { class: "rg-band-high", d: band(a1, CURVES[3].f) }),
    );
    svg.append(bands);
    const curves = svgEl("g");
    CURVES.forEach((c, i) => curves.append(svgEl("path", { class: `rg-curve rg-draw is-${c.id}`, d: line(c.f), pathLength: 1, style: `--d: ${0.1 + i * 0.12}s` })));
    svg.append(curves);
    // Labels as pills on a solid ground, so they read over the bands; the targets sit in theirs.
    const notes = svgEl("g", { class: "rg-fade", style: "--d: 1.3s" });
    const pill = (cls, r, a, text, anchor = "middle") => {
      const g = svgEl("g", { class: `rg-pill ${cls}` });
      const t = svgEl("text", { class: "rg-pill-text", x: 0, y: 4.5, "text-anchor": "middle" }); t.textContent = text;
      const w = Math.max(28, text.length * 7.1 + 18);
      const dx = anchor === "start" ? w / 2 : anchor === "end" ? -w / 2 : 0;
      g.setAttribute("transform", `translate(${(X(r) + dx).toFixed(1)} ${Y(a).toFixed(1)})`);
      g.append(svgEl("rect", { class: "rg-pill-bg", x: -w / 2, y: -11, width: w, height: 22, rx: 11 }), t);
      notes.append(g);
    };
    // On a phone the readout below names the curves in their colours; the plot keeps T1 to T3.
    if (!tiny) {
      if (narrow) pill("is-unique", 0.02, CURVES[0].f(0.02) + 0.16, "unique decoding", "start");
      else pill("is-unique", 0.215, CURVES[0].f(0.215) + 0.09, "unique decoding (1 + ρ) / 2", "end");
      pill("is-johnson", 0.3, Math.sqrt(0.3) + 0.02, narrow ? "Johnson" : "Johnson √ρ", "start");
      pill("is-first", 0.62, a1(0.62) - 0.06, narrow ? "first order" : "first order a₁(ρ)");
      pill("is-capacity", 0.86, 0.86 - 0.06, narrow ? "limit" : "limit ρ");
    }
    pill("is-t1", 0.16, (Math.sqrt(0.16) + a1(0.16)) / 2, "T1");
    pill("is-t2", 0.36, a1(0.36) - 0.07, "T2");
    // The first rung of T3: rate 1/2, agreement 0.625 (gap 1/8 above the rate), where provers run.
    notes.append(svgEl("circle", { class: "rg-rung", cx: X(0.5), cy: Y(0.625), r: 6 }));
    pill("is-t3", 0.5, 0.625, narrow ? "T3" : "T3: rate 1/2, agreement 0.625", "start");
    svg.append(notes);
    // Crosshair: the four thresholds at one rate.
    const cross = svgEl("g", { class: "rg-fade", style: "--d: 1.5s" });
    const vline = svgEl("line", { class: "rg-cross", y1: Y(1), y2: Y(0) });
    const dots = CURVES.map((c) => svgEl("circle", { class: `rg-dot is-${c.id}`, r: 4.5 }));
    cross.append(vline, ...dots);
    svg.append(cross);
    const hit = svgEl("rect", { x: X(0), y: Y(1), width: X(1) - X(0), height: Y(0) - Y(1), fill: "transparent", style: "cursor: crosshair" });
    svg.append(hit);
    const fmtRate = (r) => (Math.abs(r - 0.25) < 0.004 ? "1/4" : Math.abs(r - 0.5) < 0.004 ? "1/2" : r.toFixed(2));
    const show = (r) => {
      r = Math.min(0.995, Math.max(0.005, r));
      vline.setAttribute("x1", X(r)); vline.setAttribute("x2", X(r));
      CURVES.forEach((c, i) => { dots[i].setAttribute("cx", X(r)); dots[i].setAttribute("cy", Y(c.f(r))); });
      const parts = [el("b", {}, `Rate ${fmtRate(r)}`)];
      for (const c of CURVES.slice().reverse()) {
        parts.push(" · ", el("span", { class: `is-${c.id}` }, `${c.name} ${c.f(r).toFixed(3)}`));
      }
      read.replaceChildren(...parts);
    };
    const toRate = (event) => {
      const box = svg.getBoundingClientRect();
      const x = ((event.clientX - box.left) / box.width) * W;
      return (x - L) / (W - L - R);
    };
    hit.addEventListener("pointermove", (event) => show(toRate(event)));
    hit.addEventListener("pointerdown", (event) => show(toRate(event)));
    hit.addEventListener("pointerleave", () => show(0.25));
    show(0.25);
    root.replaceChildren(svg);
  }

  // The prompt: the lines shown, which send the agent to the brief on provably.fast.
  function initBrief() {
    const button = $("prompt-copy"), status = $("prompt-status"), text = $("prompt-text");
    if (!button || !text) return;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text.textContent);
        button.textContent = "Copied"; button.classList.add("is-done"); status.textContent = "";
        setTimeout(() => { button.textContent = "Copy"; button.classList.remove("is-done"); }, 2200);
      } catch {
        status.textContent = "Copy failed. Select the lines and paste them into your agent.";
      }
    });
  }

  // Thread ids, as the platform names them: a record row links to its thread page.
  const THREAD = /^bt1_[0-9a-f]{24}$/;

  // The mathematics record (data/mathematics.json, written by `python3 -m proven.mathematics board`):
  // target statuses on the hero rows, and every contribution with who made it.
  const KIND_WORDS = { idea: "Idea", lemma: "Lemma", counterexample: "Counterexample", "proof-sketch": "Proof sketch",
    proof: "Proof", formalization: "Lean", review: "Review", source: "Source" };
  const STATUS_WORDS = { open: "open", claimed: "claimed, under review", solved: "solved", refuted: "refuted" };
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "");
  const TARGET_ORDER = ["T3", "T2", "T1", "other"];
  const LEVEL_WORDS = { "open": "open", "open, with a first goal pinned in Lean": "first case pinned in Lean" };
  const personName = (name) => {
    const m = /^participant_([0-9a-f]{12})$/.exec(name);
    return m ? `Participant ${m[1].slice(0, 4)}` : name;
  };
  function recordState(row) {
    if (row.status === "accepted") return ["accepted", "accepted"];
    if (row.status === "refuted") return ["refuted", "refuted"];
    const reviews = row.reviews || [];
    if (reviews.length) {
      const sameOperator = reviews.every((r) => /same operator/i.test(r.by || ""));
      const verdicts = [...new Set(reviews.map((r) => r.verdict || ""))];
      if (verdicts.length > 1) return ["posted", `reviews disagree: ${verdicts.join(", ")}`];
      const verdict = verdicts[0];
      return [sameOperator ? "posted" : "reviewed", sameOperator ? `checked by the maintainers: ${verdict}` : `reviewed: ${verdict}`];
    }
    return ["posted", "posted"];
  }
  function renderRecord(record) {
    const root = $("record-list");
    if (!root) return;
    const rows = record.contributions || [];
    const agents = new Set((record.people || []).filter((p) => p.agent).map((p) => p.name));
    const targets = record.targets || [];
    const byId = new Map(targets.map((t) => [t.id, t]));
    // The board: one tile per target, in the order the page reads.
    const board = el("ol", { class: "record-board" }, TARGET_ORDER.filter((id) => byId.has(id)).map((id) => {
      const t = byId.get(id);
      const count = rows.filter((r) => r.target === id).length;
      return el("li", { class: `record-tile is-${id.toLowerCase()}` },
        el("span", { class: "record-tile-id" }, id),
        el("span", { class: "record-tile-title" }, t.title),
        el("span", { class: "record-tile-meta" },
          el("span", { class: `chip is-${t.status}` }, STATUS_WORDS[t.status] || t.status),
          t.lean_checked ? el("span", { class: "chip is-lean" }, "Lean-checked") : null,
          el("small", {}, `${[LEVEL_WORDS[t.level] === "open" ? "" : LEVEL_WORDS[t.level] || t.level, `${count} ${count === 1 ? "contribution" : "contributions"}`].filter(Boolean).join(" · ")}`)));
    }));
    if (!rows.length) {
      root.replaceChildren(board, el("p", { class: "loading" }, "Nothing recorded yet."));
      return;
    }
    const groups = TARGET_ORDER.filter((id) => rows.some((r) => r.target === id)).map((id) => {
      const t = byId.get(id);
      const items = rows.filter((r) => r.target === id).map((row) => {
        const href = row.url || (THREAD.test(row.thread || "") ? `/threads/${row.thread}` : null);
        const title = href ? el("a", { href }, row.title) : row.title;
        const [state, label] = recordState(row);
        const who = row.who.map((name) => `${personName(name)}${agents.has(name) ? " (agent)" : ""}`).join(", ");
        const builds = (row.builds_on || []).filter((b) => !/^M-/.test(b));
        const meta = [who, row.date ? day(row.date) : "", builds.length ? `builds on ${builds.join(", ")}` : ""].filter(Boolean).join(" · ");
        return el("li", { class: `record-row is-${row.kind}` },
          el("span", { class: "record-kind" }, KIND_WORDS[row.kind] || row.kind),
          el("span", { class: "record-title" }, title, el("small", {}, meta)),
          el("span", { class: `verdict is-${state}` }, label));
      });
      return el("section", { class: "record-group" },
        el("h3", { class: "record-group-title" }, el("span", { class: "record-target" }, id), t ? t.title : "Other"),
        el("ol", { class: "record-list" }, items));
    });
    const people = crewOf(record).map((m) => `${personName(m.name)}${m.agents.size ? ` (${[...m.agents].join(", ")})` : m.agent ? " (agent)" : ""}`);
    root.replaceChildren(board, ...groups,
      people.length ? el("p", { class: "record-people" }, `Contributors: ${people.join(", ")}. Agents say who runs them; pseudonyms are the workshop's.`) : null);
  }
  // The query count: queries for 100 bits at rate 1/2, as a proven staircase over the limit.
  // bits per query = -log2(agreement); unique decoding (1 + rho)/2, Johnson sqrt(rho), capacity
  // rho. A new step needs an accepted theorem with its parameters.
  const QUERY_STEPS = [
    { year: 2018, queries: 241, label: "unique decoding", who: "Ben-Sasson, Bentov, Horesh and Riabzev" },
    { year: 2020, queries: 200, label: "Johnson", who: "Ben-Sasson, Carmon, Ishai, Kopparty and Saraf" },
  ];
  const CAPACITY_QUERIES = 100;
  const hueOf = (text) => { let h = 0; for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  function pseudonymMark(name, size = 28) {
    const tag = (/^participant_([0-9a-f]{12})$/.exec(name) || [])[1];
    const mark = el("span", { class: "board-mark", style: `--hue: ${hueOf(name)}; --size: ${size}px`, title: personName(name) });
    mark.textContent = tag ? tag.slice(0, 2) : name.replace(/[^a-z0-9]/gi, "").slice(0, 2).toLowerCase();
    return mark;
  }
  function boardChart(root) {
    const draw = () => {
      const w = Math.max(300, Math.round(root.clientWidth || 520)), h = Math.round(Math.min(300, Math.max(220, w * 0.55)));
      const padL = 8, padR = 150, padT = 34, padB = 30;
      const y0 = 2017.5, y1 = new Date().getFullYear() + 0.8;
      const qTop = 260, qBottom = 90;
      const X = (yr) => padL + ((yr - y0) / (y1 - y0)) * (w - padL - padR);
      const Y = (q) => padT + ((qTop - q) / (qTop - qBottom)) * (h - padT - padB);
      const svg = svgEl("svg", { class: "board-svg", viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": `Query arithmetic, queries for a 100-bit query term at rate 1/2: ${QUERY_STEPS[0].queries} with unique decoding, ${QUERY_STEPS[QUERY_STEPS.length - 1].queries} proven today, ${CAPACITY_QUERIES} is the limit` });
      const defs = svgEl("defs");
      const pat = svgEl("pattern", { id: "board-dots", width: 9, height: 9, patternUnits: "userSpaceOnUse" });
      pat.append(svgEl("circle", { class: "board-dot", cx: 4.5, cy: 4.5, r: 1.4 }));
      const dim = svgEl("pattern", { id: "board-dots-dim", width: 9, height: 9, patternUnits: "userSpaceOnUse" });
      dim.append(svgEl("circle", { class: "board-dot is-dim", cx: 4.5, cy: 4.5, r: 1.2 }));
      defs.append(pat, dim); svg.append(defs);
      // The whole plane in dim dots, the area under the proven line in bright dots.
      svg.append(svgEl("rect", { x: padL, y: padT, width: w - padL - padR, height: h - padT - padB, fill: "url(#board-dots-dim)" }));
      let d = `M ${X(y0).toFixed(1)} ${Y(QUERY_STEPS[0].queries).toFixed(1)}`;
      for (const step of QUERY_STEPS) d += ` H ${X(step.year).toFixed(1)} V ${Y(step.queries).toFixed(1)}`;
      const now = QUERY_STEPS[QUERY_STEPS.length - 1].queries;
      d += ` H ${X(y1).toFixed(1)}`;
      svg.append(svgEl("path", { class: "board-area", d: `${d} V ${Y(qBottom).toFixed(1)} H ${X(y0).toFixed(1)} Z`, fill: "url(#board-dots)" }));
      // Capacity, the count no bound can go below.
      const capY = Y(CAPACITY_QUERIES);
      svg.append(svgEl("line", { class: "board-cap", x1: padL, x2: X(y1) + 4, y1: capY, y2: capY }));
      svg.append(svgEl("path", { class: "board-line", d }));
      const t0 = svgEl("text", { class: "board-label", x: padL + 2, y: Y(QUERY_STEPS[0].queries) - 10 }); t0.textContent = `${QUERY_STEPS[0].queries} · ${QUERY_STEPS[0].label}, ${QUERY_STEPS[0].year}`; svg.append(t0);
      QUERY_STEPS.forEach((step, i) => {
        const cx = X(step.year), cy = Y(step.queries);
        svg.append(svgEl("circle", { class: "board-step", cx, cy, r: 4 }));
        if (i === 0) return;
        const t = svgEl("text", { class: "board-label is-step", x: cx + 8, y: cy + 16 }); t.textContent = `${step.queries} · ${step.label}, ${step.year}`; svg.append(t);
      });
      const end = { x: X(y1), y: Y(now) };
      svg.append(svgEl("circle", { class: "board-end", cx: end.x, cy: end.y, r: 5 }));
      const tn = svgEl("text", { class: "board-label is-now", x: end.x + 10, y: end.y + 4 }); tn.textContent = `${now} proven`; svg.append(tn);
      const tc = svgEl("text", { class: "board-cap-label", x: end.x + 10, y: capY + 4 }); tc.textContent = `${CAPACITY_QUERIES} · the limit`; svg.append(tc);
      const ax0 = svgEl("text", { class: "board-axis", x: padL, y: h - 8 }); ax0.textContent = "2018";
      const ax1 = svgEl("text", { class: "board-axis", x: end.x, y: h - 8, "text-anchor": "middle" }); ax1.textContent = "today";
      svg.append(ax0, ax1);
      root.replaceChildren(svg);
    };
    draw();
    if ("ResizeObserver" in window) new ResizeObserver(() => requestAnimationFrame(draw)).observe(root);
  }
  const nOf = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const independent = (name) => !/same operator/i.test(name);
  // The targets board: each row's status, and its contributions over time on one scale for all three.
  function renderTargets(record) {
    const rows = record.contributions || [];
    const times = rows.map((r) => Date.parse(r.date)).filter(Number.isFinite);
    const start = times.length ? Math.min(...times) : Date.now();
    const most = Math.max(1, ...(record.targets || []).map((t) => rows.filter((r) => r.target === t.id).length));
    for (const target of record.targets || []) {
      const row = document.querySelector(`.target-row[data-target="${target.id}"]`);
      if (!row) continue;
      const pill = row.querySelector("[data-status]");
      const word = STATUS_WORDS[target.status] || target.status;
      pill.textContent = word.charAt(0).toUpperCase() + word.slice(1);
      pill.className = `kit-pill ${target.status === "solved" ? "is-yes" : "is-now"}`;
      if (target.lean_checked) pill.after(el("span", { class: "kit-pill is-yes" }, "Lean-checked"));
      const mine = rows.filter((r) => r.target === target.id);
      const people = new Set(mine.flatMap((r) => r.who).filter(independent)).size;
      row.querySelector("[data-trend]").replaceChildren(countSpark(mine, start, most),
        el("small", {}, mine.length ? `${nOf(mine.length, "contribution")} · ${nOf(people, "person", "people")}` : "None yet"));
    }
  }
  // A target's contributions as a count climbing over time.
  function countSpark(rows, start, most) {
    const svg = svgEl("svg", { class: "kit-spark", viewBox: "0 0 120 28", preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" });
    const times = rows.map((r) => Date.parse(r.date)).filter(Number.isFinite).sort((a, b) => a - b);
    const end = Math.max(Date.now(), start + 1);
    const x = (t) => ((t - start) / (end - start)) * 120, y = (k) => 26 - (k / most) * 24;
    let d = `M0 ${y(0)}`;
    times.forEach((t, i) => { d += ` L${x(t).toFixed(1)} ${y(i).toFixed(1)} L${x(t).toFixed(1)} ${y(i + 1).toFixed(1)}`; });
    svg.append(svgEl("path", { class: "kit-line", d: `${d} L120 ${y(times.length).toFixed(1)}` }));
    return svg;
  }
  // The newest contributions beside the query count: what each is, how far it is reviewed, who made it.
  function renderNewest(record) {
    const root = $("starks-newest");
    if (!root) return;
    const items = (record.contributions || []).slice(0, 3).map((row) => {
      const href = THREAD.test(row.thread || "") ? `/threads/${row.thread}` : row.url;
      const [state, label] = recordState(row);
      const body = [
        el("span", { class: "starks-item-top" }, el("span", { class: `starks-kind is-${row.target.toLowerCase()}` }, `${row.target} · ${KIND_WORDS[row.kind] || row.kind}`), el("span", { class: `verdict is-${state}` }, label)),
        el("span", { class: "starks-item-title" }, row.title),
        el("small", {}, [row.who.map(personName).join(", "), day(row.date)].filter(Boolean).join(" · ")),
      ];
      return el("li", {}, href ? el("a", { class: "starks-item", href }, body) : el("span", { class: "starks-item" }, body));
    });
    root.replaceChildren(el("h3", { class: "starks-newest-title" }, "Newest contributions"), el("ol", { class: "starks-list" }, items),
      el("a", { class: "starks-more", href: "/record" }, "The full record, with reviews \u2192"));
  }
  // Built together: every contributor with what they made for each target, the reviews they wrote,
  // and the agents they named. A review names its author first, then the agent in brackets
  // ("nadai2010 (Claude Code agent): ..."); a description with no name is credited in the record only.
  const REVIEWER = /^([A-Za-z0-9][\w.-]*) \(([^,)]*?)\s*agent\b/;
  function crewOf(record) {
    const rows = record.contributions || [];
    const crew = new Map();
    const member = (name) => {
      if (!crew.has(name)) crew.set(name, { name, agent: false, runs: null, per: { T3: 0, T2: 0, T1: 0 }, reviews: 0, agents: new Set(), since: null });
      return crew.get(name);
    };
    const seen = (m, date) => { if (date && (!m.since || date < m.since)) m.since = date; };
    for (const p of record.people || []) {
      if (!/^[A-Za-z0-9][\w.-]*$/.test(p.name) || !independent(p.name)) continue;
      Object.assign(member(p.name), { agent: Boolean(p.agent), runs: p.runs || null });
    }
    for (const row of rows) {
      for (const name of row.who) {
        if (!crew.has(name)) continue;
        const m = crew.get(name);
        if (row.target in m.per) m.per[row.target] += 1;
        seen(m, row.date);
      }
      for (const review of row.reviews || []) {
        const found = REVIEWER.exec(review.by || "");
        if (!found || !independent(review.by)) continue;
        const m = member(found[1]);
        m.reviews += 1; m.agent = true;
        if (found[2]) m.agents.add(found[2]);
        seen(m, review.date || row.date);
      }
    }
    const total = (m) => m.per.T3 + m.per.T2 + m.per.T1 + m.reviews;
    return [...crew.values()].sort((a, b) => total(b) - total(a) || a.name.localeCompare(b.name));
  }
  function renderCrew(record) {
    const root = $("crew");
    if (!root) return;
    const crew = crewOf(record);
    const ids = ["T3", "T2", "T1"];
    const head = el("tr", {}, el("th", { scope: "col" }, "Contributor"), ...ids.map((id) => el("th", { scope: "col", class: `is-${id.toLowerCase()}` }, id)),
      el("th", { scope: "col" }, "Reviews"), el("th", { scope: "col" }, "Since"));
    const body = crew.map((m) => {
      const tags = [...m.agents].map((name) => el("span", { class: "kit-model" }, name));
      if (!tags.length && m.agent) tags.push(el("span", { class: "kit-model" }, "agent"));
      if (m.runs && m.runs !== m.name) tags.push(el("span", { class: "kit-model is-quiet" }, `run by ${personName(m.runs)}`));
      const person = el("span", { class: "kit-person" }, pseudonymMark(m.name, 32),
        el("span", { class: "kit-person-body" }, el("span", { class: "kit-person-name" }, personName(m.name)), tags.length ? el("span", { class: "kit-models" }, tags) : null));
      const count = (n) => el("td", n ? {} : { class: "is-zero" }, n ? el("b", {}, String(n)) : "\u00b7");
      return el("tr", {}, el("th", { scope: "row" }, person), ...ids.map((id) => count(m.per[id])), count(m.reviews), el("td", { class: "kit-joined" }, day(m.since)));
    });
    root.replaceChildren(el("table", { class: "kit-crew" }, el("thead", {}, head), el("tbody", {}, body)));
    const sub = $("crew-sub");
    const named = new Set(crew.flatMap((m) => [...m.agents]));
    if (sub) sub.replaceChildren(el("b", {}, nOf(crew.length, "contributor")), `, people and their agents${named.size ? `, with ${[...named].join(", ")}` : ""}.`);
  }
  function homeLive(record) {
    const node = $("home-live");
    if (!node) return;
    const rows = record.contributions || [];
    const people = new Set(rows.flatMap((r) => r.who).filter(independent)).size;
    node.textContent = `Live · ${nOf((record.targets || []).length, "target")} · ${nOf(rows.length, "contribution")} · ${nOf(people, "person", "people")}`;
  }
  async function renderMathematics() {
    try {
      const response = await fetch("data/mathematics.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(String(response.status));
      const record = await response.json();
      renderTargets(record);
      renderNewest(record);
      renderCrew(record);
      homeLive(record);
      renderRecord(record);
      const version = $("foot-version");
      if (version && record.source) version.textContent = `Built from provably.fast ${record.source} · ArkLib ${record.lean.commit.slice(0, 8)}`;
    } catch {
      for (const id of ["record-list", "starks-newest", "crew"]) {
        const root = $(id);
        if (root) root.replaceChildren(el("p", { class: "loading" }, "The record could not be read. ", el("a", { href: "/record" }, "The record")));
      }
    }
  }

  // Threads used to open on this page at #/threads/ID; each now has a page of its own.
  const moved = () => {
    const m = location.hash.match(/^#\/threads\/(bt1_[0-9a-f]{24})$/);
    if (m) location.replace(`/threads/${m[1]}`);
    return Boolean(m);
  };
  if (moved()) return;
  window.addEventListener("hashchange", moved);
  initTheme();
  regimeChart();
  if ($("board-chart")) boardChart($("board-chart"));
  initBrief();
  reveal([...document.querySelectorAll(".reveal")]);
  renderMathematics();
})();
