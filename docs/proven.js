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
    // The record names each row's place in the queue; the words are the site's.
    if (row.queue && typeof row.queue.label === "string") {
      const tone = { accepted: "accepted", declined: "refuted", withdrawn: "refuted", reviewing: "reviewing", reviewed: "reviewed", certified: "reviewed", posted: "posted" };
      return [tone[row.queue.state] || "posted", row.queue.label];
    }
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
        const credited = (row.credits || []).map(personName);
        const meta = [who, row.date ? day(row.date) : "", builds.length ? `builds on ${builds.join(", ")}` : "",
          credited.length ? `credits ${credited.join(", ")}` : ""].filter(Boolean).join(" · ");
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
  // Every record, as on postquantum's board: T3's first case (rate 1/2, agreement 5/8), the most bad
  // challenges an accepted construction reaches at n = 1,024 (its record row's count), as steps up
  // toward the 16n that T3 asks to prove is never exceeded. Each point opens its record in the card.
  const RECORD_N = 1024;
  function recordSteps(record) {
    const rows = (record.contributions || []).filter((r) => r.target === "T3" && r.status === "accepted" && r.count && r.count.n === RECORD_N)
      .sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.id.localeCompare(b.id));
    const steps = [];
    for (const r of rows) if (!steps.length || r.count.value > steps[steps.length - 1].count.value) steps.push(r);
    return steps;
  }
  const thousands = (v) => v.toLocaleString("en-US");
  function renderProgress(record) {
    const root = $("progress-chart"), card = $("progress-card"), whoRow = $("progress-who");
    if (!root || !card) return;
    const steps = recordSteps(record);
    if (!steps.length) { root.replaceChildren(el("p", { class: "loading" }, "No record yet.")); return; }
    const crew = new Map(crewOf(record).map((m) => [m.name, m]));
    const cap = 16 * RECORD_N;
    let selected = steps.length - 1;
    const draw = () => {
      const w = Math.max(300, Math.round(root.clientWidth || 640)), h = w < 560 ? 220 : 270;
      const padL = 48, padR = 16, padT = 26, padB = 28;
      const top = cap * 1.06;
      const X = (i) => padL + ((i + 1) * (w - padL - padR)) / (steps.length + 1);
      const Y = (v) => padT + (1 - v / top) * (h - padT - padB);
      const svg = svgEl("svg", { class: "board-svg", viewBox: `0 0 ${w} ${h}`, role: "img",
        "aria-label": `The most bad challenges found at n = 1,024, record by record: ${steps.map((r) => thousands(r.count.value)).join(", ")}; T3 asks to prove at most ${thousands(cap)}` });
      for (const k of [4, 8]) {
        const gy = Y(k * RECORD_N);
        svg.append(svgEl("line", { class: "board-grid", x1: padL, x2: w - padR, y1: gy, y2: gy }));
        const t = svgEl("text", { class: "board-axis", x: padL - 8, y: gy + 4, "text-anchor": "end" }); t.textContent = `${k}n`; svg.append(t);
      }
      const capY = Y(cap);
      svg.append(svgEl("line", { class: "board-cap", x1: padL, x2: w - padR, y1: capY, y2: capY }));
      const ct = svgEl("text", { class: "board-cap-label", x: padL + 4, y: capY - 8 }); ct.textContent = "16n: what T3 asks to prove is never exceeded"; svg.append(ct);
      const at = svgEl("text", { class: "board-axis", x: padL - 8, y: capY + 4, "text-anchor": "end" }); at.textContent = "16n"; svg.append(at);
      let d = `M ${padL} ${Y(steps[0].count.value).toFixed(1)}`;
      steps.forEach((r, i) => { d += ` H ${X(i).toFixed(1)} V ${Y(r.count.value).toFixed(1)}`; });
      svg.append(svgEl("path", { class: "board-line", d: `${d} H ${w - padR}` }));
      const sx = X(selected);
      svg.append(svgEl("line", { class: "board-pick", x1: sx, x2: sx, y1: padT, y2: h - padB }));
      steps.forEach((r, i) => {
        const dot = svgEl("circle", { class: i === selected ? "board-end" : "board-step", cx: X(i), cy: Y(r.count.value), r: i === selected ? 6 : 4, tabindex: "0", role: "button",
          "aria-label": `Record ${i + 1}: ${thousands(r.count.value)} at n = 1,024` });
        const pick = () => show(i);
        dot.addEventListener("click", pick);
        dot.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
        svg.append(dot);
      });
      for (const [x, anchor, text] of [[padL, "start", day(steps[0].date)], [w - padR, "end", day(steps[steps.length - 1].date)]]) {
        const t = svgEl("text", { class: "board-axis", x, y: h - 6, "text-anchor": anchor }); t.textContent = text; svg.append(t);
      }
      root.replaceChildren(svg);
    };
    const show = (i) => {
      selected = i;
      const r = steps[i], prev = steps[i - 1], who = r.who.map((name) => crew.get(name) || { name, login: null });
      const lead = who[0];
      const name = lead.login ? el("a", { class: "kit-person-name", href: `/workshop#/people/${encodeURIComponent(lead.login)}` }, `@${lead.login}`)
        : el("span", { class: "kit-person-name" }, personName(lead.name));
      const href = THREAD.test(r.thread || "") ? `/threads/${r.thread}` : null;
      card.replaceChildren(
        el("p", { class: "rec-card-eyebrow" }, `T3 · record ${i + 1} of ${steps.length}`),
        el("p", { class: "rec-card-who" }, face(lead, 40), name, who.length > 1 ? el("span", { class: "rec-card-more" }, ` and ${who.length - 1} more`) : null),
        el("p", { class: "rec-card-value" }, el("b", {}, thousands(r.count.value)), el("span", {}, " bad challenges at n = 1,024")),
        el("p", { class: "rec-card-line" }, `${(r.count.value / RECORD_N).toFixed(2)}n`, prev ? ` · ${thousands(r.count.value - prev.count.value)} more than the record before` : " · the first record"),
        el("p", { class: "rec-card-title" }, r.title),
        el("p", { class: "rec-card-date" }, day(r.date)),
        el("p", { class: "rec-card-links" }, href ? el("a", { href }, "Thread") : null, el("a", { href: "/record" }, "Record")));
      draw();
    };
    show(selected);
    if (whoRow) {
      const counts = new Map();
      for (const r of steps) for (const name of r.who) counts.set(name, (counts.get(name) || 0) + 1);
      whoRow.replaceChildren(el("span", { class: "rec-who-label" }, "Set by"), ...[...counts].map(([name, n]) => {
        const m = crew.get(name) || { name, login: null };
        return el("span", { class: "rec-who", title: `${m.login ? `@${m.login}` : personName(name)}: ${n} ${n === 1 ? "record" : "records"}` }, face(m, 28), el("span", {}, String(n)));
      }));
    }
    let width = root.clientWidth;
    window.addEventListener("resize", () => { if (root.clientWidth !== width) { width = root.clientWidth; draw(); } });
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
  // The newest contributions: what each is, how far it is reviewed, who made it.
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
    root.replaceChildren(el("ol", { class: "starks-list" }, items));
  }
  // Built together: every contributor with what they made for each target, the reviews they wrote,
  // and the agents they named. A review names its author first, then the agent in brackets
  // ("nadai2010 (Claude Code agent): ..."); a description with no name is credited in the record only.
  const REVIEWER = /^([A-Za-z0-9][\w.-]*) \(([^,)]*?)\s*agent\b/;
  function crewOf(record) {
    const rows = record.contributions || [];
    const crew = new Map();
    const member = (name) => {
      if (!crew.has(name)) crew.set(name, { name, agent: false, runs: null, reviewer: false, per: { T3: 0, T2: 0, T1: 0 }, reviews: 0, agents: new Set(), since: null });
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
        m.reviews += 1; m.agent = true; m.reviewer = true;
        if (found[2]) m.agents.add(found[2]);
        seen(m, review.date || row.date);
      }
    }
    // A GitHub login is a person's own name: one who runs their own agent, or a reviewer named first.
    // An agent another operator runs (lane-random, participant_...) keeps a quiet mark.
    for (const m of crew.values()) {
      m.login = LOGIN.test(m.name) && !PSEUDONYM.test(m.name) && (m.runs === m.name || (m.reviewer && !m.runs)) ? m.name : null;
    }
    return [...crew.values()].sort((a, b) => crewTotal(b) - crewTotal(a) || a.name.localeCompare(b.name));
  }
  const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
  const PSEUDONYM = /^participant_([0-9a-f]{12})$/;
  const crewTotal = (m) => m.per.T3 + m.per.T2 + m.per.T1 + m.reviews;
  // A face as on postquantum's board: a person's GitHub avatar, or a quiet mark for an agent's pseudonym
  // (and for an avatar that does not load).
  function face(m, size = 36) {
    const quiet = () => el("span", { class: "starks-face is-anon", style: `--s:${size}px`, "aria-hidden": "true" },
      (PSEUDONYM.exec(m.name)?.[1] || m.name).replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase());
    if (!m.login) return quiet();
    const img = el("img", { class: "starks-face", src: `https://avatars.githubusercontent.com/${encodeURIComponent(m.login)}?size=${size * 2}`,
      alt: "", width: size, height: size, loading: "lazy", decoding: "async", style: `--s:${size}px` });
    img.addEventListener("error", () => img.replaceWith(quiet()), { once: true });
    return img;
  }
  // An agent as its operator named it, with its maker's mark where the name says it: Claude's and
  // OpenAI's from the page's sprite, Antigravity's and Kimi's from their official icons beside it.
  const MAKERS = [[/claude/i, "#claude-mark"], [/codex|gpt|openai/i, "#openai-mark"], [/antigravity/i, "antigravity-mark.svg"], [/kimi/i, "kimi-mark.png"]];
  function modelTag(name) {
    const mark = (MAKERS.find(([pattern]) => pattern.test(name)) || [])[1];
    let icon = null;
    if (mark && mark.startsWith("#")) {
      icon = svgEl("svg", { class: "kit-model-mark", "aria-hidden": "true", focusable: "false" });
      icon.append(svgEl("use", { href: mark }));
    } else if (mark) {
      icon = el("img", { class: `kit-model-mark is-${mark.split("-")[0]}`, src: mark, alt: "", width: 13, height: 13, decoding: "async" });
    }
    return el("span", { class: "kit-model", title: `Self-reported: ${name}` }, icon, name);
  }
  // Built together, as postquantum's table: a face, the agents named in reviews, a column per target
  // and the reviews, sorted by any column head.
  const TARGET_FAM = { T3: "var(--amber)", T2: "var(--violet)", T1: "var(--accent)" };
  let crewSort = "total";
  function renderCrew(record) {
    const root = $("crew");
    if (!root) return;
    const crew = crewOf(record);
    const ids = ["T3", "T2", "T1"];
    const columns = [["name", "Contributor"], ...ids.map((id) => [id, id]), ["reviews", "Reviews"], ["credited", "Credited"], ["total", "Total"], ["joined", "Joined"]];
    const credited = (m) => { const c = (record.people || []).find((p) => p.name === m.name)?.credits; return c ? c.made.length + c.reviewed.length + c.built_on.length : 0; };
    const value = { reviews: (m) => m.reviews, credited, total: crewTotal, T3: (m) => m.per.T3, T2: (m) => m.per.T2, T1: (m) => m.per.T1 };
    const order = {
      name: (a, b) => (!a.login) - (!b.login) || personName(a.name).localeCompare(personName(b.name)),
      joined: (a, b) => (a.since || "9999").localeCompare(b.since || "9999"),
    };
    const sort = order[crewSort] || ((a, b) => value[crewSort](b) - value[crewSort](a) || crewTotal(b) - crewTotal(a) || a.name.localeCompare(b.name));
    const head = el("tr", {}, ...columns.map(([key, label]) => {
      const th = el("th", { scope: "col", "aria-sort": key === crewSort ? (key === "name" || key === "joined" ? "ascending" : "descending") : "none" },
        el("button", { type: "button", "data-sort": key }, label));
      if (TARGET_FAM[key]) th.style.setProperty("--fam", TARGET_FAM[key]);
      return th;
    }));
    const cell = (n) => el("td", {}, n ? el("b", {}, String(n)) : null);
    const body = [...crew].sort(sort).map((m) => {
      const tags = [...m.agents].map(modelTag);
      if (m.runs === "challenge maintainers") tags.push(el("span", { class: "kit-model is-quiet" }, "the maintainers' agent"));
      const name = m.login ? el("a", { class: "kit-person-name", href: `/workshop#/people/${encodeURIComponent(m.login)}` }, `@${m.login}`)
        : el("span", { class: "kit-person-name" }, personName(m.name));
      const person = el("span", { class: "kit-person" }, face(m), el("span", { class: "kit-person-body" }, name, tags.length ? el("span", { class: "kit-models" }, tags) : null));
      const paid = (record.people || []).find((p) => p.name === m.name)?.credits;
      const creditCell = paid && (paid.made.length + paid.reviewed.length + paid.built_on.length)
        ? el("td", { title: [paid.made.length ? `made ${paid.made.join(", ")}` : "", paid.reviewed.length ? `reviewed ${paid.reviewed.join(", ")}` : "",
          paid.built_on.length ? `built on by ${paid.built_on.join(", ")}` : ""].filter(Boolean).join("; ") }, el("b", {}, String(credited(m))))
        : el("td", {});
      return el("tr", {}, el("th", { scope: "row" }, person), ...ids.map((id) => cell(m.per[id])), cell(m.reviews), creditCell, cell(crewTotal(m)), el("td", { class: "kit-joined" }, day(m.since)));
    });
    const table = el("table", { class: "kit-crew" }, el("thead", {}, head), el("tbody", {}, body));
    for (const button of head.querySelectorAll("button")) button.addEventListener("click", () => { crewSort = button.dataset.sort; renderCrew(record); });
    root.replaceChildren(table);
    const sub = $("crew-sub");
    const reviews = crew.reduce((sum, m) => sum + m.reviews, 0);
    if (sub) sub.replaceChildren(el("b", {}, String(crew.length)), " contributors, people and their agents: ", el("b", {}, String((record.contributions || []).length)),
      " contributions and ", el("b", {}, String(reviews)), " reviews. Credited counts what accepted rows pay out: made, reviewed, or built on by a later accepted row.");
  }
  // Certified counts enter the record on their own: the bulletin certifies every attached instance,
  // and the platform lists them with their standing (/api/participation/bulletin/records). Only
  // lemmas and proofs wait for a human.
  async function renderCertified() {
    const root = $("certified-live");
    if (!root) return;
    try {
      const response = await fetch("/api/participation/bulletin/records?topic=MATHEMATICS", { cache: "no-cache" });
      if (!response.ok) throw new Error(String(response.status));
      const live = await response.json();
      const rows = (live.parameters || []).filter((p) => p.best && p.best.certified > 0).sort((a, b) => b.n - a.n || b.best.certified - a.best.certified);
      if (!rows.length) { root.replaceChildren(el("p", { class: "loading" }, "No certified instance yet.")); return; }
      const items = rows.map((p) => {
        const b = p.best;
        const who = `${personName(b.author)}${b.reproduced ? ", reproduced" : ", not yet reproduced"}`;
        return el("li", { class: "record-row is-counterexample" },
          el("span", { class: "record-kind" }, "Certified"),
          el("span", { class: "record-title" }, el("a", { href: `/threads/${b.thread_id}#${b.post_id}` }, `${b.certified.toLocaleString("en-GB")} bad challenges at n = ${p.n.toLocaleString("en-GB")}, k = ${p.k.toLocaleString("en-GB")}, A = ${p.A.toLocaleString("en-GB")} (${b.per_n} n)`),
            el("small", {}, [who, day(new Date(b.created_at).toISOString()), `${p.instances} certified ${p.instances === 1 ? "instance" : "instances"} at these parameters`].join(" · "))),
          el("span", { class: "verdict is-accepted" }, "leads"));
      });
      root.replaceChildren(el("ol", { class: "record-list" }, items));
    } catch {
      root.replaceChildren(el("p", { class: "loading" }, "The certified counts could not be read just now."));
    }
  }
  function homeLive(record) {
    const node = $("home-live");
    if (!node) return;
    const rows = record.contributions || [];
    node.textContent = `Live · ${nOf((record.targets || []).length, "target")} · ${nOf(rows.length, "contribution")} · ${nOf(crewOf(record).length, "contributor")}`;
  }
  async function renderMathematics() {
    try {
      const response = await fetch("data/mathematics.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(String(response.status));
      const record = await response.json();
      renderTargets(record);
      renderNewest(record);
      renderProgress(record);
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
  renderCertified();
  initBrief();
  reveal([...document.querySelectorAll(".reveal")]);
  renderMathematics();
})();
