// starks.provably.fast: the targets board, the latest advances, the bounds, the query count, the
// people behind it and the brief on the home page (kit.css draws them), the record page and the
// background's regime chart, all from data/mathematics.json (written by `python3 -m proven.mathematics
// board`). Nothing moves.
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

  // A ratio as a small fraction where it is one (1/2, 5/8), else three decimals.
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const frac = (x, n) => { const g = gcd(x, n); return n / g <= 64 ? `${x / g}/${n / g}` : (x / n).toFixed(3); };
  function regimeChart() {
    const root = $("regime-plot");
    if (!root) return;
    let drawn = 0, marks = [];
    const draw = (force) => {
      const width = Math.round(Math.min(1000, Math.max(300, root.clientWidth || 1000)));
      if (!force && Math.abs(width - drawn) < 40) return;
      drawn = width;
      buildRegime(root, width, marks);
    };
    draw();
    if ("ResizeObserver" in window) new ResizeObserver(() => draw()).observe(root);
    if (!capture) {
      Promise.all([certifiedMarks(), loadRecord().catch(() => null), loadProfiles()]).then(([found, record, profiles]) => {
        const steps = record ? recordSteps(record) : [];
        acceptedRecord = steps[steps.length - 1] || null;
        regimeProfiles = profiles;
        marks = found;
        if (found.length) draw(true);
      });
    }
  }
  // The certified counts placed on the chart: one mark per rate and agreement, holding every size
  // certified there, best count per point of the domain first.
  async function certifiedMarks() {
    try {
      const [response, profiles] = await Promise.all([fetch("/api/participation/bulletin/records?topic=MATHEMATICS", { cache: "no-cache" }), loadProfiles()]);
      if (!response.ok) return [];
      const live = await response.json();
      // The bulletin names the earliest of a tie as best; everyone leading at a setting is credited.
      const leaders = new Map();
      for (const i of live.instances || []) {
        if (!i || !i.leading || typeof i.author !== "string") continue;
        const key = `${i.p} ${i.n} ${i.k} ${i.A}`;
        if (!leaders.has(key)) leaders.set(key, new Set());
        leaders.get(key).add(i.author);
      }
      const named = (author) => ({ author, login: profiles.get(author) || null });
      const at = new Map();
      for (const p of live.parameters || []) {
        if (!p.best || !(p.best.certified > 0) || !(p.n > 0) || !(p.k > 0) || !(p.A > p.k) || p.A > p.n) continue;
        const key = `${p.k / p.n} ${p.A / p.n}`;
        if (!at.has(key)) at.set(key, { r: p.k / p.n, a: p.A / p.n, rows: [] });
        const tied = [...(leaders.get(`${p.p} ${p.n} ${p.k} ${p.A}`) || [])].filter((a) => a !== p.best.author).map(named);
        at.get(key).rows.push({ ...p, login: profiles.get(p.best.author) || null, tied });
      }
      return [...at.values()].map((m) => ({ ...m, rows: m.rows.sort((x, y) => y.best.per_n - x.best.per_n || y.n - x.n) }));
    } catch {
      return [];
    }
  }
  // The mark picked in the card, kept across redraws by its best setting.
  let regimePick = null, regimeFilter = null, acceptedRecord = null, regimeProfiles = null;
  const rowId = (p) => `${p.p}-${p.n}-${p.k}-${p.A}`;
  function buildRegime(root, W, marks = []) {
    const read = $("regime-read");
    const narrow = W < 820, tiny = W < 480;
    const H = narrow ? Math.round(W * 0.8) : 430, L = 54, R = 18, T = 14, B = 46;
    const X = (r) => L + r * (W - L - R), Y = (a) => T + (1 - a) * (H - T - B);
    const svg = svgEl("svg", { class: "regime-svg", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-labelledby": "regime-title regime-desc", });
    const desc = svgEl("desc", { id: "regime-desc" });
    desc.textContent = "Agreement thresholds by code rate, with marks at the rates provers use, 1/8, 1/4 and 1/2. Above the Johnson curve the count of bad challenges is known to be linear. Between the first-order curve and the Johnson curve a quadratic bound is known; T1 asks for a linear one. Between the limit and the first-order curve the known bounds are polynomial, with exponents that depend on the rate and the gap; T3 asks for a small one.";
    const defs = svgEl("defs");
    const hatch = svgEl("pattern", { id: "rg-hatch", width: 10, height: 10, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    hatch.append(svgEl("line", { class: "rg-hatch-line is-t3", x1: 0, y1: 0, x2: 0, y2: 10 }), svgEl("line", { class: "rg-hatch-line is-t2", x1: 5, y1: 0, x2: 5, y2: 10 }));
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
    const curvePills = new Map();
    const pill = (cls, r, a, text, anchor = "middle") => {
      const g = svgEl("g", { class: `rg-pill ${cls}` });
      const t = svgEl("text", { class: "rg-pill-text", x: 0, y: 4.5, "text-anchor": "middle" }); t.textContent = text;
      const w = Math.max(28, text.length * 7.1 + 18);
      // A label anchored at a point starts just clear of it, so a mark there stays visible.
      const dx = anchor === "start" ? w / 2 + 9 : anchor === "end" ? -w / 2 : 0;
      g.setAttribute("transform", `translate(${(X(r) + dx).toFixed(1)} ${Y(a).toFixed(1)})`);
      g.append(svgEl("rect", { class: "rg-pill-bg", x: -w / 2, y: -11, width: w, height: 22, rx: 11 }), t);
      notes.append(g);
      const curve = CURVES.find((c) => cls === `is-${c.id}`);
      if (curve) curvePills.set(curve, g);
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
    // A quiet chart (the home page's) names a curve only while the pointer is near it.
    const quiet = root.classList.contains("is-quiet");
    if (quiet) svg.classList.add("is-quiet");
    const nearCurve = (event) => {
      if (!quiet) return;
      const box = svg.getBoundingClientRect();
      const r = Math.min(0.995, Math.max(0.005, toRate(event)));
      const a = 1 - (((event.clientY - box.top) / box.height) * H - T) / (H - T - B);
      const near = CURVES.reduce((best, c) => (Math.abs(c.f(r) - a) < Math.abs(best.f(r) - a) ? c : best));
      curvePills.forEach((g, c) => g.classList.toggle("is-shown", c === near && Math.abs(c.f(r) - a) < 0.08));
    };
    hit.addEventListener("pointermove", (event) => { show(toRate(event)); nearCurve(event); });
    hit.addEventListener("pointerdown", (event) => { show(toRate(event)); nearCurve(event); });
    hit.addEventListener("pointerleave", () => { show(0.25); curvePills.forEach((g) => g.classList.remove("is-shown")); });
    show(0.25);
    if (marks.length) {
      // Marks closer than a dot's width merge, so the crowded corners stay legible; a merged mark
      // keeps every setting it holds.
      const clusters = [];
      for (const m of marks) {
        const x = X(m.r), y = Y(m.a);
        const near = clusters.find((c) => Math.hypot(c.x - x, c.y - y) < 7);
        if (near) near.rows.push(...m.rows); else clusters.push({ x, y, rows: [...m.rows] });
      }
      // Within a mark, the setting with the most sizes certified leads, largest size first.
      const settingOf = (p) => `${p.k / p.n} ${p.A / p.n}`;
      for (const c of clusters) {
        const sizes = new Map();
        for (const p of c.rows) sizes.set(settingOf(p), (sizes.get(settingOf(p)) || 0) + 1);
        c.rows.sort((p, q) => sizes.get(settingOf(q)) - sizes.get(settingOf(p)) || settingOf(p).localeCompare(settingOf(q)) || q.n - p.n);
      }
      const one = (q) => (q.login ? `@${q.login}` : personName(q.author));
      const who = (p) => [one({ author: p.best.author, login: p.login }), ...(p.tied || []).map(one)].join(", ");
      const setting = (rows) => {
        const byA = [...rows].sort((p, q) => p.A / p.n - q.A / q.n), rates = [...new Set(rows.map((p) => frac(p.k, p.n)))];
        const lo = frac(byA[0].A, byA[0].n), hi = frac(byA[byA.length - 1].A, byA[byA.length - 1].n);
        return `Rate ${rates.join(", ")} · agreement ${lo === hi ? lo : `${lo} to ${hi}`}`;
      };
      const card = $("regime-card");
      // At T3's rung, the maintainers' record names the accepted construction (its record row).
      const accepted = (c) => {
        const step = c.rows.some((p) => p.k * 2 === p.n && p.A * 8 === p.n * 5) && acceptedRecord;
        if (!step) return null;
        const holder = step.who.map((name) => one({ author: name, login: (regimeProfiles && regimeProfiles.get(name)) || (PSEUDONYM.test(name) ? null : name) })).join(", ");
        return el("p", { class: "rec-card-line" }, "Accepted record: ", el("a", { href: `/record#${step.id}` }, step.id), ` · ${thousands(step.count.value)} at n = ${thousands(step.count.n)} by ${holder}`);
      };
      const circles = new Map(), tells = new Map();
      const mine = (p) => Boolean(regimeFilter) && [p.login || p.best.author, ...(p.tied || []).map((q) => q.login || q.author)].includes(regimeFilter);
      const pick = (c) => {
        regimePick = rowId(c.rows[0]);
        circles.forEach((circle, k) => circle.classList.toggle("is-picked", k === c));
        if (!card) return;
        const best = c.rows[0], b = best.best, m = { name: b.author, login: best.login };
        const name = m.login ? el("a", { class: "kit-person-name", href: `/workshop#/people/${encodeURIComponent(m.login)}` }, `@${m.login}`)
          : el("span", { class: "kit-person-name" }, personName(b.author));
        card.replaceChildren(
          el("p", { class: "rec-card-eyebrow" }, setting(c.rows)),
          el("p", { class: "rec-card-who" }, face(m, 40), name, el("span", { class: "rec-card-more" },
            (best.tied || []).length ? ` and ${best.tied.map(one).join(", ")} posted it` : "posted it")),
          el("p", { class: "rec-card-value" }, el("b", {}, thousands(b.certified)), el("span", {}, ` bad challenges at n = ${thousands(best.n)}`)),
          el("p", { class: "rec-card-line" }, `${b.per_n}n per point of the domain · ${b.reproduced ? "reproduced" : "not yet reproduced"}`),
          // With a face picked below the chart, that person's rows come first and stand out.
          c.rows.length > 1 ? el("ul", { class: "rec-card-list" }, [...c.rows].sort((p, q) => mine(q) - mine(p)).slice(0, 6).map((p) =>
            el("li", mine(p) ? { class: "is-mine" } : {}, el("b", {}, `n = ${thousands(p.n)}`), ` ${thousands(p.best.certified)} (${p.best.per_n}n) · ${who(p)}`))) : null,
          c.rows.length > 6 ? el("p", { class: "rec-card-date" }, `and ${c.rows.length - 6} more here`) : null,
          accepted(c),
          el("p", { class: "rec-card-date" }, "Whose construction it is, and what it builds on, is in the post."),
          el("p", { class: "rec-card-links" }, el("a", { href: `/threads/${b.thread_id}#${b.post_id}` }, "Post"), el("a", { href: "/record#certified" }, "All counts")));
      };
      const markGroup = svgEl("g", { class: "rg-marks" });
      for (const c of clusters) {
        const best = c.rows[0], b = best.best;
        const label = `${setting(c.rows)}: ` + c.rows.map((p) => `n = ${thousands(p.n)}, ${thousands(p.best.certified)} bad challenges (${p.best.per_n}n), posted by ${who(p)}${p.best.reproduced ? ", reproduced" : ""}`).join("; ");
        const a = svgEl("a", { href: `/threads/${b.thread_id}#${b.post_id}`, "aria-label": label });
        const r = Math.min(9, 3 + Math.log2(1 + Math.max(...c.rows.map((p) => p.best.per_n))) * 0.7);
        const rate = best.k / best.n, agree = best.A / best.n;
        const zone = agree >= Math.sqrt(rate) ? "linear" : agree >= a1(rate) ? "t1" : "open";
        const circle = svgEl("circle", { class: `rg-mark is-${zone}${c.rows.some((p) => p.best.reproduced) ? " is-reproduced" : ""}`, cx: c.x.toFixed(1), cy: c.y.toFixed(1), r: r.toFixed(1) });
        circles.set(c, circle);
        a.append(circle);
        const tell = () => {
          const rate = (c.x - L) / (W - L - R);
          vline.setAttribute("x1", c.x); vline.setAttribute("x2", c.x);
          CURVES.forEach((curve, i) => { dots[i].setAttribute("cx", c.x); dots[i].setAttribute("cy", Y(curve.f(rate))); });
          read.replaceChildren(el("b", {}, setting(c.rows)), ` · ${nOf(c.rows.length, "count")} certified · largest: `,
            el("b", {}, thousands(b.certified)), ` at n = ${thousands(best.n)} (${b.per_n}n), posted by ${who(best)}${b.reproduced ? ", reproduced" : ""}`);
        };
        tells.set(c, tell);
        a.addEventListener("pointerenter", tell); a.addEventListener("focus", tell);
        // With a card beside the chart, a mark opens in the card; without one it opens its post.
        if (card) a.addEventListener("click", (event) => { event.preventDefault(); pick(c); tell(); });
        markGroup.append(a);
      }
      // The labels stay readable above the marks; the pointer passes through them.
      svg.append(markGroup, notes);
      const rung = clusters.find((c) => c.rows.some((p) => p.k * 2 === p.n && p.A * 8 === p.n * 5));
      const first = clusters.find((c) => c.rows.some((p) => rowId(p) === regimePick)) || rung || clusters[0];
      pick(first);
      if (card) {
        tells.get(first)();
        hit.addEventListener("pointerleave", () => tells.get(clusters.find((c) => circles.get(c).classList.contains("is-picked")) || first)());
      }
      const whoRow = $("regime-who");
      if (whoRow) {
        const counts = new Map();
        for (const p of clusters.flatMap((c) => c.rows)) {
          for (const q of [{ author: p.best.author, login: p.login }, ...(p.tied || [])]) {
            const key = q.login || q.author;
            if (!counts.has(key)) counts.set(key, { m: { name: q.author, login: q.login }, n: 0 });
            counts.get(key).n += 1;
          }
        }
        // Each face filters the chart to the marks that person posted a best count at; again clears.
        const keysOf = (c) => new Set(c.rows.flatMap((p) => [p.login || p.best.author, ...(p.tied || []).map((q) => q.login || q.author)]));
        if (regimeFilter && !counts.has(regimeFilter)) regimeFilter = null;
        const buttons = new Map();
        const applyFilter = () => {
          circles.forEach((circle, c) => circle.classList.toggle("is-dimmed", Boolean(regimeFilter) && !keysOf(c).has(regimeFilter)));
          buttons.forEach((button, key) => button.setAttribute("aria-pressed", String(key === regimeFilter)));
        };
        whoRow.replaceChildren(el("span", { class: "rec-who-label" }, "Posted by"), ...[...counts].sort(([, x], [, y]) => y.n - x.n).map(([key, { m, n }]) => {
          const label = m.login ? `@${m.login}` : personName(m.name);
          const button = el("button", { type: "button", class: "rec-who", "aria-pressed": "false", title: `${label}: posted the best count at ${nOf(n, "setting")}. Show only theirs.` },
            face(m, 28), el("span", {}, String(n)));
          button.addEventListener("click", () => {
            regimeFilter = regimeFilter === key ? null : key;
            applyFilter();
            const picked = clusters.find((c) => circles.get(c).classList.contains("is-picked"));
            const target = regimeFilter && !keysOf(picked).has(regimeFilter) ? clusters.find((c) => keysOf(c).has(regimeFilter)) : picked;
            pick(target);
            tells.get(target)();
          });
          buttons.set(key, button);
          return button;
        }));
        applyFilter();
      }
    }
    root.replaceChildren(svg);
  }

  // The prompt: four lines that send the agent to the state, the brief and the task list. Copy takes
  // all of it, and one click on the text selects it whole.
  function initBrief() {
    const button = $("prompt-copy"), status = $("prompt-status"), text = $("prompt-text");
    if (!button || !text) return;
    const words = button.textContent;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text.textContent);
        button.textContent = "Copied"; button.classList.add("is-done"); status.textContent = "";
        setTimeout(() => { button.textContent = words; button.classList.remove("is-done"); }, 2200);
      } catch {
        status.textContent = "Copy failed. Select the lines and paste them into your agent.";
      }
    });
  }

  // Thread ids, as the platform names them: a record row links to its thread page.
  const THREAD = /^bt1_[0-9a-f]{24}$/;
  // A link taken from record data: https or same-origin only, never javascript: or data:.
  const safeHref = (url) => (typeof url === "string" && (/^https:\/\//i.test(url) || /^\/(?!\/)/.test(url)) ? url : null);

  // The mathematics record (data/mathematics.json, written by `python3 -m proven.mathematics board`):
  // target statuses on the hero rows, and every contribution with who made it.
  const KIND_WORDS = { idea: "Idea", lemma: "Lemma", counterexample: "Counterexample", "proof-sketch": "Proof sketch",
    proof: "Proof", formalization: "Lean", review: "Review", source: "Source" };
  const STATUS_WORDS = { open: "open", claimed: "claimed, under review", solved: "solved", refuted: "refuted" };
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "");
  const TARGET_ORDER = ["T3", "T2", "T1", "other"];
  const LEVEL_WORDS = { "open": "open", "open, with a first goal pinned in Lean": "first case pinned in Lean" };
  const personName = (name) => {
    if (name === "challenge maintainers") return "The maintainers' agents";
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
    const reviews = (row.reviews || []).filter((r) => r.verdict !== "read");
    if (reviews.length) {
      const sameOperator = reviews.every((r) => /same operator/i.test(r.by || ""));
      const verdicts = [...new Set(reviews.map((r) => r.verdict || ""))];
      if (verdicts.length > 1) return ["posted", `reviews disagree: ${verdicts.join(", ")}`];
      const verdict = verdicts[0];
      return [sameOperator ? "posted" : "reviewed", sameOperator ? `checked by the maintainers: ${verdict}` : `reviewed: ${verdict}`];
    }
    return ["posted", "posted"];
  }
  // What is waiting for a review, by what a review earns (a fifth of the row's points), with the
  // thread to read: the way into points for anyone who checks work.
  function renderQueue(record) {
    const root = $("record-queue"), share = record.points?.share || 0.2;
    if (!root) return;
    const waiting = (record.contributions || []).filter((r) => r.queue?.state && !["accepted", "declined", "withdrawn"].includes(r.queue.state) && r.points)
      .sort((a, b) => b.points - a.points || (b.date || "").localeCompare(a.date || ""));
    if (!waiting.length) { root.replaceChildren(); return; }
    const total = waiting.reduce((t, r) => t + r.points, 0);
    root.replaceChildren(el("h2", { class: "chapter-sub" }, `${nOf(waiting.length, "result")} waiting for a review: ${total.toLocaleString("en-US")} points once reviewed`),
      el("p", { class: "chapter-note" }, `A review earns ${Math.round(share * 100)}% of the result, half of it the day it is posted. Read the thread and post your review there.`),
      el("ol", { class: "queue-list" }, waiting.slice(0, 12).map((r) => el("li", {},
        el("b", { class: "queue-earn" }, `+${Math.round(share * r.points)}`),
        el("span", { class: "queue-what" }, el("a", { href: THREAD.test(r.thread || "") ? `/threads/${r.thread}` : `#${r.id}` }, clip(r.title, 120)),
          el("small", {}, `${r.id} · ${r.target} · ${r.who.map(personName).join(", ")} · ${day(r.date)}`))))),
      waiting.length > 12 ? el("p", { class: "chapter-note" }, `${waiting.length - 12} more in the table below, sorted by status.`) : "");
  }
  function renderRecord(record) {
    const root = $("record-list");
    if (!root) return;
    renderQueue(record);
    const rows = record.contributions || [];
    const agents = new Set((record.people || []).filter((p) => p.agent).map((p) => p.name));
    const crew = crewOf(record).byName;
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
          el("small", {}, `${[LEVEL_WORDS[t.level] === "open" ? "" : LEVEL_WORDS[t.level] || t.level, `${count} ${count === 1 ? "contribution" : "contributions"}`].filter(Boolean).join(" · ")}`)),
        reviewBar(rows.filter((r) => r.target === id)));
    }));
    if (!rows.length) {
      root.replaceChildren(board, el("p", { class: "loading" }, "Nothing recorded yet."));
      return;
    }
    const table = recordTable(rows, crew, agents);
    const people = contributors(crewOf(record)).map((m) => el("span", { class: "record-who" }, githubPerson(m, 24),
      m.agents.size ? ` (${[...m.agents].join(", ")})` : m.agent ? " (agent)" : null));
    const progress = recordSteps(record).length ? el("section", { class: "starks-panel record-progress", "aria-labelledby": "progress-title" },
      el("div", { class: "rec-chart-col" },
        el("h2", { class: "record-viz-title", id: "progress-title" }, "T3: the most bad challenges found at n = 1,024"),
        el("div", { class: "board-chart", id: "progress-chart" }),
        el("p", { class: "rec-who-row", id: "progress-who" })),
      el("aside", { class: "rec-card", id: "progress-card", "aria-live": "polite" })) : null;
    root.replaceChildren(board, laneTimeline(rows, crew), progress, table,
      people.length ? el("div", { class: "record-people" }, el("span", {}, "Contributors"), ...people,
        el("span", {}, "Agents say who runs them; pseudonyms are the workshop's.")) : null);
  }
  // Every contribution as one table, sorted by any column head; a row opens to its reviews, what it
  // builds on and who it credits.
  const STAGE_RANK = { accepted: 0, reviewed: 1, posted: 2, refuted: 3 };
  // A table sorted by any column head: columns are [key, label, value, ascending first]; a row
  // function may return one row or several. The sort state is the caller's, so it survives a redraw.
  // With a limit, only the first rows of the current sort show until the reader asks for the rest.
  function sortableTable(wrap, { columns, rows, sort, row, tie, note, limit = Infinity }) {
    let all = false;
    const draw = () => {
      const [, , value] = columns.find(([k]) => k === sort.key);
      const sorted = rows.slice().sort((a, b) => {
        const x = value(a), y = value(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || tie(a, b);
      });
      const head = el("tr", {}, columns.map(([key, label]) => el("th", { scope: "col", class: `is-${key}`,
        "aria-sort": key === sort.key ? (sort.dir > 0 ? "ascending" : "descending") : "none" },
        el("button", { type: "button", "data-sort": key }, label))));
      const shown = all ? sorted : sorted.slice(0, limit);
      const table = el("table", { class: "record-table" }, el("thead", {}, head), el("tbody", {}, shown.flatMap(row)));
      for (const button of head.querySelectorAll("button")) {
        button.addEventListener("click", () => {
          const key = button.dataset.sort;
          sort.dir = key === sort.key ? -sort.dir : columns.find(([k]) => k === key)[3] ? 1 : -1;
          sort.key = key;
          draw();
          wrap.querySelector(`button[data-sort="${key}"]`).focus();
        });
      }
      let more = null;
      if (rows.length > limit) {
        more = el("button", { type: "button", class: "record-table-more", "aria-expanded": String(all) }, all ? "Show fewer" : `Show all ${rows.length}`);
        more.addEventListener("click", () => { all = !all; draw(); wrap.querySelector(".record-table-more").focus(); });
      }
      // The note and the show-all toggle share a row above the table, so the toggle is found before the scroll.
      wrap.replaceChildren(el("div", { class: "record-table-head" }, el("p", { class: "record-table-note" }, note), more || ""), el("div", { class: "record-table-scroll" }, table));
    };
    draw();
    return wrap;
  }
  let recordSort = { key: "date", dir: -1 };
  const openRows = new Set(/^#M-\d+$/.test(location.hash) ? [location.hash.slice(1)] : []);
  function recordTable(rows, crew, agents) {
    const wrap = el("div", { class: "record-table-wrap" });
    const person = (name, size) => el("span", { class: "record-who" }, githubPerson(crew.get(name)?.login ? crew.get(name) : { name, login: null }, size),
      agents.has(name) ? el("small", {}, " agent") : null);
    const columns = [
      ["id", "#", (r) => r.id, true], ["target", "Target", (r) => TARGET_ORDER.indexOf(r.target), true], ["kind", "Kind", (r) => KIND_WORDS[r.kind] || r.kind, true],
      ["title", "Contribution", (r) => r.title.toLowerCase(), true], ["who", "By", (r) => personName(r.who[0] || "").toLowerCase(), true],
      ["date", "Date", (r) => r.date || ""], ["count", "Count", (r) => (r.count ? r.count.value : -1)],
      ["reviews", "Reviews", (r) => (r.reviews || []).length], ["points", "Points", (r) => (r.points || 0) * (r.status === "accepted" ? 1 : 0.001)],
      ["state", "Status", (r) => STAGE_RANK[stageOf(r)] ?? 9, true],
    ];
    // A review names its author first; that name reads as it does elsewhere on the page.
    const reviewer = (by) => {
      const found = REVIEWER.exec(by);
      const m = found && crew.get(found[1]);
      return found ? [el("span", { class: "record-who" }, githubPerson(m && m.login ? m : { name: found[1], login: null }, 16)), by.slice(found[1].length)] : by;
    };
    const details = (r) => {
      const href = safeHref(r.url) || (THREAD.test(r.thread || "") ? `/threads/${r.thread}` : null);
      const builds = (r.builds_on || []).map((b) => (/^M-\d+$/.test(b) ? el("a", { href: `#${b}` }, b) : b));
      const reviews = (r.reviews || []).map((v) => el("li", {}, el("span", { class: `verdict is-${/same operator/i.test(v.by || "") ? "posted" : "reviewed"}` }, v.verdict || "reviewed"),
        " ", reviewer(v.by || ""), v.date ? ` · ${day(v.date)}` : "", safeHref(v.url) ? [" · ", el("a", { href: safeHref(v.url) }, "link")] : null));
      const facts = [
        builds.length ? el("p", {}, el("b", {}, "Builds on "), builds.flatMap((b, i) => (i ? [", ", b] : [b]))) : null,
        (r.credits || []).length ? el("p", {}, el("b", {}, "Credits "), r.credits.flatMap((c, i) => (i ? [", ", person(c, 16)] : [person(c, 16)]))) : null,
        r.count ? el("p", {}, el("b", {}, "Count "), `${thousands(r.count.value)} bad challenges at n = ${thousands(r.count.n)} (${(r.count.value / r.count.n).toFixed(2)}n)`) : null,
        r.queue && r.queue.since ? el("p", {}, el("b", {}, "Status "), `${recordState(r)[1]} since ${day(r.queue.since)}`) : null,
        reviews.length ? el("div", {}, el("b", {}, "Reviews"), el("ul", { class: "record-reviews" }, reviews)) : el("p", {}, el("b", {}, "Reviews "), "none yet"),
        href ? el("p", {}, el("a", { class: "record-open", href }, "Open the thread")) : null,
      ];
      return el("div", { class: "record-detail" }, facts);
    };
    const row = (r) => {
      const [state, label] = recordState(r);
      const open = openRows.has(r.id);
      const more = el("tr", { class: `record-more is-${r.kind}`, id: `${r.id}-more` }, el("td", { colspan: columns.length }, details(r)));
      more.hidden = !open;
      const toggle = el("button", { type: "button", class: "record-toggle", "aria-expanded": String(open), "aria-controls": `${r.id}-more`, title: r.title }, r.title);
      toggle.addEventListener("click", () => {
        more.hidden = !more.hidden;
        toggle.setAttribute("aria-expanded", String(!more.hidden));
        if (more.hidden) openRows.delete(r.id); else openRows.add(r.id);
      });
      return [el("tr", { id: r.id, class: `record-tr is-${r.kind}` },
        el("td", { class: "is-id" }, r.id),
        el("td", { class: "is-target" }, el("span", { class: `record-target-pill is-${r.target.toLowerCase()}` }, r.target)),
        el("td", { class: "is-kind" }, el("span", { class: "record-kind" }, KIND_WORDS[r.kind] || r.kind)),
        el("td", { class: "is-title" }, toggle),
        el("td", { class: "is-who" }, r.who.map((name) => person(name, 20))),
        el("td", { class: "is-date" }, day(r.date)),
        el("td", { class: "is-count" }, r.count ? thousands(r.count.value) : ""),
        el("td", { class: "is-reviews" }, (r.reviews || []).length ? String(r.reviews.length) : ""),
        el("td", { class: `is-points${r.status === "accepted" ? "" : " is-pending"}` }, r.points && r.status !== "refuted" ? String(r.points) : ""),
        el("td", { class: "is-state" }, el("span", { class: `verdict is-${state}` }, label), (r.bonus || []).includes("lean") ? el("span", { class: "verdict is-accepted record-lean", title: "Kernel-checked in Lean against the pinned ArkLib" }, "Lean") : "")), more];
    };
    sortableTable(wrap, { columns, rows, sort: recordSort, row, limit: 10, tie: (a, b) => b.id.localeCompare(a.id),
      note: `${nOf(rows.length, "contribution")}. Sort by any column; open a row for its reviews, what it builds on and who it credits.` });
    // A row the address names past the first 10 shows the whole table first.
    const reveal = (id) => {
      if (wrap.querySelector(`[id="${id}"]`) || !rows.some((r) => r.id === id)) return;
      wrap.querySelector(".record-table-more")?.click();
      document.getElementById(id)?.scrollIntoView();
    };
    openRows.forEach(reveal);
    // A timeline dot or a card link opens its row, even when the address already names it.
    const openRow = (id) => {
      reveal(id);
      const toggle = document.getElementById(id)?.querySelector(".record-toggle");
      if (toggle && toggle.getAttribute("aria-expanded") !== "true") toggle.click();
    };
    window.addEventListener("hashchange", () => { if (/^#M-\d+$/.test(location.hash)) openRow(location.hash.slice(1)); });
    document.addEventListener("click", (event) => {
      const link = event.target.closest && event.target.closest('a[href^="#M-"]');
      if (link && link.getAttribute("href") === location.hash) openRow(location.hash.slice(1));
    });
    return wrap;
  }
  // How far each contribution has been reviewed, in the verdict colours: one stage per row.
  const STAGES = [["accepted", "accepted"], ["reviewed", "reviewed"], ["posted", "posted"], ["refuted", "refuted"]];
  const stageOf = (row) => { const s = recordState(row)[0]; return s === "reviewing" ? "posted" : s; };
  function reviewBar(rows) {
    if (!rows.length) return null;
    const n = new Map(STAGES.map(([k]) => [k, 0]));
    for (const r of rows) n.set(stageOf(r), (n.get(stageOf(r)) || 0) + 1);
    const shown = STAGES.filter(([k]) => n.get(k));
    return el("span", { class: "review-bar-wrap" },
      el("span", { class: "review-bar", role: "img", "aria-label": shown.map(([k, w]) => `${n.get(k)} ${w}`).join(", ") },
        shown.map(([k]) => el("span", { class: `is-${k}`, style: `flex-grow: ${n.get(k)}` }))),
      el("small", {}, shown.map(([k, w]) => `${n.get(k)} ${w}`).join(" · ")));
  }
  // The three lanes over time: a dot per contribution in its target's row, coloured by how far it
  // is reviewed. Same-day dots pack into a small grid on their day; links to the recorded rows a
  // contribution builds on arc above its row, and light up with it. T3's records carry their count.
  // A readout under the plot names the dot in focus, the newest until another is picked.
  function laneTimeline(rows, crew) {
    const lanes = TARGET_ORDER.filter((id) => id !== "other");
    const dated = rows.filter((r) => lanes.includes(r.target) && Number.isFinite(Date.parse(r.date)))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    if (!dated.length) return null;
    const DAY = 864e5, GAP = 11;
    const today = Date.parse(new Date().toISOString().slice(0, 10));
    const t0 = Date.parse(dated[0].date) - DAY, t1 = Math.max(Date.parse(dated[dated.length - 1].date), today) + DAY;
    const sameDay = new Map();
    for (const r of dated) {
      const key = `${r.target} ${r.date}`;
      if (!sameDay.has(key)) sameDay.set(key, []);
      sameDay.get(key).push(r.id);
    }
    const byId = new Map(dated.map((r) => [r.id, r]));
    const records = new Set(recordSteps({ contributions: rows }).map((r) => r.id));
    const links = dated.flatMap((r) => (r.builds_on || []).filter((b) => byId.has(b)).map((b) => [b, r.id]));
    const who = (r) => r.who.map((name) => { const m = crew.get(name); return m && m.login ? `@${m.login}` : personName(name); }).join(", ");
    const root = el("figure", { class: "lane-timeline" });
    const caption = el("figcaption", { class: "lane-key" },
      el("span", { class: "record-viz-title" }, "Every contribution, by target"),
      ...STAGES.map(([k, w]) => el("span", { class: `lane-key-item is-${k}` }, w)),
      el("span", { class: "lane-key-item is-record" }, "T3 record at n = 1,024"),
      el("span", { class: "lane-key-item is-arc" }, "builds on"));
    const plot = el("div", { class: "board-chart" });
    const read = el("p", { class: "lane-read", "aria-live": "polite" });
    const show = (r) => {
      const [state, label] = recordState(r);
      read.replaceChildren(el("span", { class: `record-target-pill is-${r.target.toLowerCase()}` }, r.target), ` ${KIND_WORDS[r.kind] || r.kind} · ${day(r.date)} · ${who(r)} · `,
        el("span", { class: `verdict is-${state}` }, label), el("span", { class: "lane-read-title" }, r.title));
    };
    let drawn = 0;
    const draw = () => {
      const W = Math.max(300, Math.round(plot.clientWidth || 900));
      if (W === drawn) return;
      drawn = W;
      const padL = 46, padR = 14, padT = 22, axis = 24;
      const X = (t) => padL + ((t - t0) / (t1 - t0)) * (W - padL - padR);
      const dayW = (W - padL - padR) / ((t1 - t0) / DAY);
      // A day's dots pack into a grid on its day. A day too busy for ten rows packs tighter, with
      // smaller dots, so one busy day does not set the height of its whole lane.
      const ROWS = 10, room = Math.max(dayW, GAP);
      const pack = new Map([...sameDay].map(([key, ids]) => {
        let c = Math.max(1, Math.floor(room / GAP)), g = GAP;
        while (Math.ceil(ids.length / c) * g > ROWS * GAP && room / (c + 1) >= 3.5) g = room / ++c;
        return [key, { g, c: Math.min(c, ids.length), n: Math.ceil(ids.length / c) }];
      }));
      const laneH = new Map(lanes.map((id) => [id, Math.max(44, 26 + Math.max(GAP, ...[...pack].filter(([k]) => k.startsWith(`${id} `)).map(([, p]) => p.n * p.g)))]));
      const laneTop = new Map();
      let y = padT;
      for (const id of lanes) { laneTop.set(id, y); y += laneH.get(id); }
      const H = y + axis;
      const at = new Map();
      for (const [key, ids] of sameDay) {
        const [id, date] = key.split(" ");
        const { g, c, n } = pack.get(key), x = X(Date.parse(date)), mid = laneTop.get(id) + laneH.get(id) / 2;
        ids.forEach((rid, i) => at.set(rid, [x + ((i % c) - (c - 1) / 2) * g, mid + (Math.floor(i / c) - (n - 1) / 2) * g, g]));
      }
      const svg = svgEl("svg", { class: "board-svg lane-svg", viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": "Contributions over time for T3, T2 and T1" });
      lanes.forEach((id, i) => {
        const top = laneTop.get(id), h = laneH.get(id);
        if (i) svg.append(svgEl("line", { class: "board-grid", x1: padL, x2: W - padR, y1: top, y2: top }));
        const t = svgEl("text", { class: `lane-label is-${id.toLowerCase()}`, x: 0, y: top + h / 2 }); t.textContent = id;
        const n = svgEl("text", { class: "board-axis", x: 0, y: top + h / 2 + 14 }); n.textContent = String(dated.filter((r) => r.target === id).length);
        svg.append(t, n);
      });
      // A tick a week from the first contribution, and today's.
      for (let t = Date.parse(dated[0].date); t < today - 3 * DAY; t += 7 * DAY) {
        const x = X(t);
        svg.append(svgEl("line", { class: "board-grid", x1: x, x2: x, y1: padT, y2: H - axis }));
        const label = svgEl("text", { class: "board-axis", x, y: H - 6, "text-anchor": "middle" }); label.textContent = day(new Date(t).toISOString()); svg.append(label);
      }
      const tx = X(today);
      svg.append(svgEl("line", { class: "lane-today", x1: tx, x2: tx, y1: padT - 6, y2: H - axis }));
      const tl = svgEl("text", { class: "board-axis", x: tx, y: H - 6, "text-anchor": "end" }); tl.textContent = "today"; svg.append(tl);
      // Links: within a row, an arc above it; across rows, an S between them.
      const paths = links.map(([from, to]) => {
        const [x1, y1] = at.get(from), [x2, y2] = at.get(to);
        const d = byId.get(from).target === byId.get(to).target
          ? `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${((x1 + x2) / 2).toFixed(1)} ${(Math.min(y1, y2) - Math.min(34, 8 + Math.abs(x2 - x1) * 0.18)).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
          : `M${x1.toFixed(1)} ${y1.toFixed(1)} C${(x1 + 30).toFixed(1)} ${y1.toFixed(1)} ${(x2 - 30).toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
        const path = svgEl("path", { class: "lane-arc", d });
        svg.append(path);
        return [from, to, path];
      });
      // T3's records, labelled where they do not crowd: newest first.
      let lastX = Infinity;
      for (const r of [...dated].reverse()) {
        if (!records.has(r.id)) continue;
        const [x] = at.get(r.id), top = Math.min(...sameDay.get(`${r.target} ${r.date}`).map((id) => at.get(id)[1]));
        if (lastX - x < 46) continue;
        lastX = x;
        const t = svgEl("text", { class: "lane-count", x, y: top - 9, "text-anchor": "middle" }); t.textContent = thousands(r.count.value); svg.append(t);
      }
      const dots = new Map();
      for (const r of dated) {
        const [cx, cy, g] = at.get(r.id), [, label] = recordState(r);
        const a = svgEl("a", { href: `#${r.id}`, "aria-label": `${r.id}, ${r.target} ${KIND_WORDS[r.kind] || r.kind}, ${day(r.date)}, ${who(r)}: ${r.title} (${label})` });
        const dot = svgEl("circle", { class: `lane-dot is-${stageOf(r)}${records.has(r.id) ? " is-record" : ""}`, cx: cx.toFixed(1), cy: cy.toFixed(1), r: (4.5 * g / GAP).toFixed(2) });
        a.append(dot);
        dots.set(r.id, dot);
        const on = () => {
          svg.classList.add("is-focus");
          dot.classList.add("is-lit");
          for (const [from, to, path] of paths) if (from === r.id || to === r.id) { path.classList.add("is-lit"); dots.get(from).classList.add("is-lit"); dots.get(to).classList.add("is-lit"); }
          show(r);
        };
        const off = () => { svg.classList.remove("is-focus"); svg.querySelectorAll(".is-lit").forEach((n) => n.classList.remove("is-lit")); };
        a.addEventListener("pointerenter", on); a.addEventListener("focus", on);
        a.addEventListener("pointerleave", off); a.addEventListener("blur", off);
        svg.append(a);
      }
      plot.replaceChildren(svg);
    };
    show(dated[dated.length - 1]);
    root.append(caption, plot, read);
    requestAnimationFrame(draw);
    if ("ResizeObserver" in window) new ResizeObserver(draw).observe(plot);
    return root;
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
    const crew = crewOf(record).byName;
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
        el("p", { class: "rec-card-links" }, href ? el("a", { href }, "Thread") : null, el("a", { href: $("record-list") ? `#${r.id}` : "/record" }, "Record")));
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
  // The three targets as cards: the status once it is not open; who is pushing each (faces and
  // names, how much they made and how much is accepted, each find on a chart over time); and a
  // button that drafts a post on X crediting the people behind it. T3's "examples reach" is the best
  // known count of its first case (rate 1/2, agreement 5n/8).
  const andList = (items) => items.flatMap((item, i) => (i === 0 ? [item] : [i === items.length - 1 ? " and " : ", ", item]));
  function renderTargets(record) {
    const rows = record.contributions || [];
    const times = rows.map((r) => Date.parse(r.date)).filter(Number.isFinite);
    const start = times.length ? Math.min(...times) : Date.now();
    const crew = crewOf(record);
    const first = (record.cells || []).find((c) => c.target === "T3" && c.rate === "1/2" && c.A === "5n/8");
    for (const target of record.targets || []) {
      const card = document.querySelector(`.tgt-card[data-target="${target.id}"]`);
      if (!card) continue;
      // A status shows once it is news: every target is open until someone claims it.
      const pill = card.querySelector("[data-status]");
      const word = STATUS_WORDS[target.status] || target.status;
      pill.textContent = word.charAt(0).toUpperCase() + word.slice(1);
      pill.className = `kit-pill ${target.status === "solved" ? "is-yes" : "is-now"}`;
      pill.hidden = target.status === "open";
      if (target.lean_checked) pill.after(el("span", { class: "kit-pill is-yes" }, "Lean-checked"));
      const lead = card.querySelector(".tgt-fig.is-lead");
      if (lead && record.points && !lead.querySelector(".tgt-points")) lead.append(el("span", { class: "tgt-points" }, `${pts(record.points.advances.statement)} points`));
      if (target.id === "T3" && typeof first?.best_known_per_n === "number") {
        card.querySelector("[data-known]").replaceChildren(`the record pair reaches ${perN(first.best_known_per_n)}`, el("i", {}, "n"));
      }
      const mine = rows.filter((r) => r.target === target.id);
      const accepted = mine.filter((r) => r.status === "accepted").length;
      const people = crew.filter((m) => !m.maintainers && m.per[target.id] > 0).sort((a, b) => b.per[target.id] - a.per[target.id]);
      const shown = (m) => (m.login ? el("a", { href: `https://github.com/${encodeURIComponent(m.login)}`, rel: "noopener noreferrer" }, `@${m.login}`) : personName(m.name));
      const named = people.length > 3 ? [...people.slice(0, 2).map(shown), `${people.length - 2} more`] : people.map(shown);
      card.querySelector("[data-people]").replaceChildren(
        el("span", { class: "tgt-who" }, el("span", { class: "adv-faces" }, people.slice(0, 5).map((m) => face(m, 30))),
          el("span", { class: "tgt-names" }, people.length ? andList(named) : "Nobody yet")),
        advanceChart(mine, start, crew));
      const credit = plainList([...people.slice(0, 3).map((m) => m.login || personName(m.name)), ...(people.length > 3 ? [`${people.length - 3} more`] : [])]);
      const name = card.querySelector(".tgt-name").textContent;
      const text = `${target.id} on starks.provably.fast: ${name}. ${nOf(mine.length, "contribution")} so far, ${accepted} accepted${credit ? `, from ${credit}` : ""}. Help make STARK proofs smaller.`;
      card.querySelector("[data-share]").replaceChildren(el("a", { class: "adv-share", target: "_blank", rel: "noopener noreferrer", "aria-label": `Share ${target.id} on X`,
        href: `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent("https://starks.provably.fast/#targets")}` }, svgIcon("#x-mark"), "Share"));
    }
  }
  // A target's advances over time, on one time axis from the first contribution to today: the count
  // climbing as a step line, a dot for each find (filled once accepted, ringed when newest), and on
  // hover or focus a card with its date, state, headline and who made it. A dot opens its thread; on
  // a touch screen the first tap shows the card and the second opens the thread.
  let tipFor = null;
  document.addEventListener("pointerdown", (event) => {
    if (tipFor && !event.target.closest?.(".adv-dot")) tipFor.hide();
  });
  function advanceChart(rows, start, crew) {
    // Same-day finds in record order (M-0022 before M-0023), so the ringed dot is the Latest one.
    const items = rows.map((r) => ({ r, t: Date.parse(r.date) })).filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t || String(a.r.id).localeCompare(String(b.r.id), "en", { numeric: true }));
    const end = Math.max(Date.now(), start + 1);
    const X = (t) => 1.5 + ((t - start) / (end - start)) * 97, Y = (k) => 94 - (k / Math.max(1, items.length)) * 82;
    let d = `M${X(start)} ${Y(0)}`;
    items.forEach((p, i) => { d += ` L${X(p.t)} ${Y(i)} L${X(p.t)} ${Y(i + 1)}`; });
    d += ` L${X(end)} ${Y(items.length)}`;
    const svg = svgEl("svg", { class: "adv-line", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" });
    svg.append(svgEl("path", { class: "adv-area", d: `${d} L${X(end)} ${Y(0)} Z` }), svgEl("path", { class: "kit-line", d }));
    const tip = el("span", { class: "adv-tip", role: "tooltip" });
    tip.hidden = true;
    const box = el("div", { class: "adv-chart" }, svg);
    const hide = () => { tip.hidden = true; tip.dataset.for = ""; if (tipFor?.tip === tip) tipFor = null; };
    items.forEach((p, i) => {
      const r = p.r;
      const href = THREAD.test(r.thread || "") ? `/threads/${r.thread}` : safeHref(r.url) || "/record";
      const [tone] = recordState(r);
      const state = SHORT_STATE[r.queue?.state === "reviewing" ? "reviewing" : tone] || "posted";
      const [head] = headline(r.title);
      const who = [...new Set(r.who.map((name) => crew.byName.get(name) || { name, login: null }))]
        .map((m) => (m.maintainers ? "The maintainers' agents" : m.login ? `@${m.login}` : personName(m.name)));
      const dot = el("a", { class: `adv-dot is-${tone}${i === items.length - 1 ? " is-newest" : ""}`, href,
        style: `left:${X(p.t)}%;top:${Y(i + 1)}%`, "aria-label": `${day(r.date)}, ${state}: ${head}, by ${who.join(", ")}` });
      const show = () => {
        tip.replaceChildren(el("span", { class: "adv-tip-top" }, el("span", {}, day(r.date)), el("span", { class: `verdict is-${tone}` }, state)),
          el("b", {}, head), el("small", {}, `by ${andList(who).join("")}`));
        tip.hidden = false;
        tip.dataset.for = String(i);
        const width = box.clientWidth, x = (X(p.t) / 100) * width, y = (Y(i + 1) / 100) * box.clientHeight;
        tip.style.left = `${Math.max(0, Math.min(width - tip.offsetWidth, x - tip.offsetWidth / 2))}px`;
        tip.style.top = `${y - tip.offsetHeight - 12}px`;
        if (tipFor && tipFor.tip !== tip) tipFor.hide();
        tipFor = { tip, hide };
      };
      let touch = false;
      dot.addEventListener("pointerdown", (event) => { touch = event.pointerType !== "mouse"; });
      dot.addEventListener("click", (event) => { if (touch && tip.dataset.for !== String(i)) { event.preventDefault(); show(); } });
      dot.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") show(); });
      dot.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") hide(); });
      dot.addEventListener("focus", show);
      dot.addEventListener("blur", hide);
      box.append(dot);
    });
    box.append(tip);
    return el("div", { class: "adv-chart-wrap" }, box,
      el("span", { class: "adv-axis" }, el("span", {}, day(new Date(start).toISOString())),
        el("span", { class: "adv-legend" }, el("i", { class: "is-accepted" }), "accepted", el("i", {}), "posted"), el("span", {}, "today")));
  }
  // A row's state in the words the charts show.
  const SHORT_STATE = { accepted: "accepted", reviewed: "reviewed", reviewing: "under review", posted: "posted", refuted: "declined" };
  function headline(title) {
    const i = title.indexOf(": ");
    return i > 12 && i < 120 ? [title.slice(0, i), title.slice(i + 2)] : [title, ""];
  }
  const svgIcon = (href) => {
    const svg = svgEl("svg", { "aria-hidden": "true", focusable: "false" });
    svg.append(svgEl("use", { href }));
    return svg;
  };
  const clip = (text, most) => (text.length > most ? `${text.slice(0, most - 1).trimEnd()}…` : text);
  const plainList = (names) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0] || "");
  // The people behind it: every contributor with what they made for each target, the reviews they
  // wrote, and the agents they named. A review names its author first, then the agent in brackets
  // ("nadai2010 (Claude Code agent): ..."); a description with no name is credited in the record only.
  const REVIEWER = /^([A-Za-z0-9][\w.-]*) \(([^,)]*?)\s*agent\b/;
  function crewOf(record) {
    const rows = record.contributions || [];
    const crew = new Map();
    const member = (name) => {
      if (!crew.has(name)) crew.set(name, { name, names: [name], agent: false, runs: null, reviewer: false, per: { T3: 0, T2: 0, T1: 0 }, reviews: 0, agents: new Set(), since: null });
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
      m.login = LOGIN.test(m.name) && !PSEUDONYM.test(m.name) && !/^lane-/.test(m.name) && m.runs !== MAINTAINERS && (!m.runs || m.runs === m.name) ? m.name : null;
    }
    // One row per contributor: a pseudonym whose owner chose a public profile takes that login, and
    // folds into the login's own row when it is on the record too; the maintainers' own agents fold
    // into one row of their own, which the contributor counts leave out.
    const fold = (m, into) => {
      for (const id of ["T3", "T2", "T1"]) into.per[id] += m.per[id];
      into.reviews += m.reviews;
      into.names.push(...m.names);
      m.agents.forEach((a) => into.agents.add(a));
      seen(into, m.since);
      crew.delete(m.name);
    };
    for (const m of [...crew.values()]) {
      const login = (record.profiles || new Map()).get(m.name);
      if (m.runs === MAINTAINERS) {
        const into = crew.get(MAINTAINERS) || member(MAINTAINERS);
        Object.assign(into, { agent: true, maintainers: true, login: null });
        if (into.names[0] === MAINTAINERS) into.names.shift();
        fold(m, into);
      } else if (login) {
        const same = [...crew.values()].find((o) => o !== m && (o.name.toLowerCase() === login.toLowerCase() || o.login === login));
        if (same) { same.login = login; fold(m, same); } else m.login = login;
      }
    }
    const list = [...crew.values()].sort((a, b) => Boolean(a.maintainers) - Boolean(b.maintainers) || crewTotal(b) - crewTotal(a) || a.name.localeCompare(b.name));
    // Every name on the record, folded or not, finds its row.
    list.byName = new Map(list.flatMap((m) => m.names.map((n) => [n, m])));
    return list;
  }
  const MAINTAINERS = "challenge maintainers";
  // Consented public profiles (/api/participation/profiles), the People page's source: the
  // platform's own map from a bulletin pseudonym to the GitHub login its owner chose to show. A
  // pseudonym claimed twice voids the map; a failed load leaves every pseudonym as it is.
  let profilesLoad = null;
  function loadProfiles() {
    const load = fetch("/api/participation/profiles", { cache: "no-cache" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const rows = (payload?.identities || []).filter((row) => row && typeof row.bulletin_actor === "string");
        const actors = rows.map((row) => row.bulletin_actor);
        if (new Set(actors).size !== actors.length) return new Map();
        const named = rows.filter((row) => PSEUDONYM.test(row.bulletin_actor) && LOGIN.test(row.login || ""));
        // A person's graph actors (github-..., hosted-agent-...) name them too, for their graph leads.
        const graphActors = (payload?.identities || []).filter((row) => row && LOGIN.test(row.login || "")).flatMap((row) =>
          (Array.isArray(row.actor_ids) ? row.actor_ids : []).filter((id) => /^(github-\d{1,12}|hosted-agent-[0-9a-f]{8,40})$/.test(id)).map((id) => [id, row.login]));
        const map = new Map([...graphActors, ...named.map((row) => [row.bulletin_actor, row.login])]);
        keep("starks-profiles", [...map]);
        return map;
      })
      .catch(() => new Map());
    // ponytail: a profiles API slower than 2.5 s leaves pseudonyms as they are for this view; redraw
    // on late arrival if that turns out to happen in practice.
    profilesLoad ||= Promise.race([load, new Promise((resolve) => setTimeout(() => resolve(new Map()), 2500))]);
    return profilesLoad;
  }
  const contributors = (crew) => crew.filter((m) => !m.maintainers);
  const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
  const PSEUDONYM = /^participant_([0-9a-f]{12})$/;
  const crewTotal = (m) => m.per.T3 + m.per.T2 + m.per.T1 + m.reviews;
  // A face as on postquantum's board: a person's GitHub avatar, or a quiet mark for an agent's pseudonym
  // (and for an avatar that does not load).
  function face(m, size = 36) {
    const quiet = () => el("span", { class: "starks-face is-anon", style: `--s:${size}px`, "aria-hidden": "true" },
      m.maintainers ? "M" : (PSEUDONYM.exec(m.name)?.[1] || m.name).replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase());
    if (!m.login) return quiet();
    const img = el("img", { class: "starks-face", src: `https://avatars.githubusercontent.com/${encodeURIComponent(m.login)}?size=${size * 2}`,
      alt: "", width: size, height: size, loading: "lazy", decoding: "async", style: `--s:${size}px` });
    img.addEventListener("error", () => img.replaceWith(quiet()), { once: true });
    return img;
  }
  // A face and a name, linked to the GitHub profile when the name is the person's own login.
  function githubPerson(m, size) {
    const name = m.login ? el("a", { href: `https://github.com/${encodeURIComponent(m.login)}`, rel: "noopener noreferrer" }, `@${m.login}`)
      : personName(m.name);
    return [face(m, size), name];
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
  // The people behind it, in points. The record pays results, reviews and work others build on
  // (data/mathematics.json points: the rules and every line, pending until a row is accepted); the
  // counts the bulletin certifies are added here, live: raising a listed cell's best known count at
  // n >= points.count_min_n pays points.count_raise, once per cell, person and day (rung 0 only
  // before rules v2), and a count above 16 n at rung 0 shows a statement's points, pending until it
  // is recorded. Copies and repeats pay nothing. Rows follow points and carry no rank numbers.
  const DAY = 86_400_000;
  const dayOf = (t) => Math.floor(t / DAY);
  const MILESTONES = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000];
  // A rule's points as a chip, and as words in a share post.
  const RULE_CHIP = { lean: "Lean-checked", lead: "lead", statement: "ranked statement", refutes: "refutation", bound: "missing bound", port: "port", upper: "upper bound", breaks: "broken bound",
    result: "results", review: "reviews", built_on: "built on", error: "error found", count: "best count", rung0: "rung-0 refutation" };
  const RULE_POST = { lean: "a proof kernel-checked in Lean against ArkLib", lead: "leads posted", statement: "proved a ranked statement", refutes: "refuted a ranked statement", bound: "proved a missing bound", port: "filled a port",
    upper: "proved an upper bound", breaks: "broke a posted bound", result: "accepted results", review: "reviews",
    built_on: "work others built on", error: "found an error", count: "raised a cell's best count", rung0: "a count above 16 n at rung 0" };
  const RULE_TONE = { lean: "record", lead: "amber", statement: "record", refutes: "pink", bound: "record", port: "amber", upper: "amber", breaks: "pink", result: "amber",
    review: "accent", built_on: "pink", error: "accent", count: "teal", rung0: "record" };
  const pts = (n) => Math.round(n).toLocaleString("en-US");
  // The slow reads behind the board (the bulletin's certified records, the graph's leads) are kept
  // in the browser for ten minutes: the board draws from the record alone at once, then from the
  // kept copies, then from the live reads when they land.
  const KEEP_MS = 10 * 60_000;
  const kept = (key) => {
    try {
      const raw = localStorage.getItem(key);
      const row = raw ? JSON.parse(raw) : null;
      return row && Date.now() - row.t < KEEP_MS ? row.v : null;
    } catch { return null; }
  };
  const keep = (key, v) => { try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch { /* storage off */ } };
  let bulletinLoad = null;
  const loadBulletinRecords = () => (bulletinLoad ||= fetch("/api/participation/bulletin/records?topic=MATHEMATICS", { cache: "no-cache" })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
    .then((v) => { keep("starks-bulletin-records", v); return v; }));
  // The graph's leads since rules v2 that the record does not hold yet (neither as a row's own lead
  // nor in its builds_on): each is a result's points, pending until the maintainers record and
  // accept it (ten a person a day at most, so a flood of leads stays small). Older leads were
  // decided when the record was curated. The digest comes from the registry, like the research page's.
  async function loadLeads(record) {
    const registry = await fetch("/data/campaigns.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const campaign = (registry?.campaigns || []).find((c) => c.topic === "MATHEMATICS" && /^[0-9a-f]{64}$/.test(c.graph_digest || ""));
    const digest = campaign?.graph_digest;
    if (!digest) return [];
    const recorded = new Set((record.contributions || []).flatMap((r) => [...(r.builds_on || []), ...(r.lead ? [r.lead] : [])]));
    const since = `${record.rules?.since || "2026-10-30"}T00:00:00Z`;
    // The pages are a hundred records each at cursors 0, 100, 200, ...: eight at a time, until a
    // page comes back short, instead of one after another.
    const page = (cursor) => fetch(`/api/participation/graph?campaign_digest=${digest}&cursor=${cursor}&limit=100`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const pages = [];
    for (let cursor = 0, done = false; !done && cursor < 4000; cursor += 800) {
      const burst = await Promise.all([0, 100, 200, 300, 400, 500, 600, 700].map((step) => page(cursor + step)));
      for (const p of burst) {
        if (!p || !(p.records || []).length) { done = true; break; }
        pages.push(p);
        if (!Number.isSafeInteger(p.next_cursor) || (p.records || []).length < 100) { done = true; break; }
      }
    }
    const leads = pages.flatMap((p) => (p.records || []).filter((r) => r && r.record_type === "LEAD" && !recorded.has(r.record_id) && String(r.created_at) >= since).map((r) => ({ ...r, campaign: campaign.campaign_id })));
    keep("starks-leads", leads);
    return leads;
  }
  // Every point, with the crew member it pays and when.
  function boardPeople(record, records, leads = []) {
    const crew = crewOf(record);
    const profiles = record.profiles || new Map();
    const P = record.points || { ledger: [] };
    const rows = new Map();
    // A name on the record or the bulletin, or a login a graph actor resolves to (known): one person
    // under every name their profile links.
    const byLogin = new Map(crew.filter((o) => o.login).map((o) => [o.login, o]));
    const member = (name, known = null) => {
      let m = crew.byName.get(name);
      if (!m) {
        // A record row may name a person by login; the bulletin and the graph by pseudonym or actor.
        const login = known || profiles.get(name) || (LOGIN.test(name) && !PSEUDONYM.test(name) ? name : null);
        m = (login && byLogin.get(login)) || { name, names: [name], login, agents: new Set(), maintainers: false };
        crew.byName.set(name, m);
        if (login) byLogin.set(login, m);
      }
      return m;
    };
    const entry = (name, known = null) => {
      const m = member(name, known);
      if (!rows.has(m)) rows.set(m, { m, lines: [], active: [] });
      return rows.get(m);
    };
    const byId = new Map((record.contributions || []).map((r) => [r.id, r]));
    const at = (iso) => Date.parse(String(iso || "").length === 10 ? `${iso}T12:00:00Z` : iso);
    for (const line of P.ledger || []) {
      const row = byId.get(line.row);
      const t = at(line.date);
      if (!row || !Number.isFinite(t) || /challenge maintainers/i.test(line.who) || member(line.who).maintainers) continue;
      const [head] = headline(row.title);
      const words = line.rule === "review" ? `review of ${head}` : line.rule === "built_on" ? `${line.row} built on ${line.of}` : line.rule === "error" ? `found the error in ${head}` : head;
      entry(line.who).lines.push({ points: line.points, pending: line.pending, rule: line.lean && line.rule !== "review" && line.rule !== "built_on" ? "lean" : line.rule, t, words, id: line.row,
        href: THREAD.test(row.thread || "") ? `/threads/${row.thread}` : "/record" });
    }
    // Certified counts: what raised a listed cell's best known count, and anything above 16 n at rung 0.
    const since = Date.parse(`${record.rules?.since || "2026-10-30"}T00:00:00Z`);
    // Rules v6.1: since the cutoff only the four problem cells pay, a count at a grid row pays
    // nothing, a row at a length that is not a power of two or a zero-pair row never pays, and the
    // voided posts and accounts pay nothing for their window.
    const scoring = record.rules?.scoring || null;
    const cutoff = scoring ? Date.parse(scoring.since) : Infinity;
    const voidedPosts = new Set(scoring ? [...(scoring.voided?.zero_pair_rows || []), ...(scoring.voided?.proxy_posts || [])] : []);
    const voidedAccounts = new Map((scoring?.voided?.accounts || []).flatMap((a) => [a.participant, ...String(a.for || "").match(/participant_[0-9a-f]{12}/g) || []].map((p) => [p, a.window])));
    // A lead names its cell by id, or as "Problem 2" / "problem 3a" (the cell whose id starts with that number).
    const problemCell = (text) => scoring && ((scoring.cells || []).some((id) => String(text || "").includes(id))
      || [...String(text || "").matchAll(/\bproblem[ -]?(\d[abc]?)\b/gi)].some((m) => (scoring.cells || []).some((id) => id.toLowerCase().startsWith(`problem-${m[1].toLowerCase()}-`))));
    // Rules v7: since its cutoff a lead pays only in a full-weight cell (a ledger-only cell pays for a
    // recorded ledger change, which a lead alone cannot show).
    const v7 = scoring?.v7 || null, v7since = v7 ? Date.parse(v7.since) : Infinity;
    const cellOfText = (text) => {
      const s = String(text || ""), ids = scoring?.cells || [];
      const hit = ids.find((id) => s.includes(id));
      if (hit) return hit;
      for (const m of s.matchAll(/\bproblem[ -]?(\d[abc]?)\b/gi)) {
        const id = ids.find((x) => x.toLowerCase().startsWith(`problem-${m[1].toLowerCase()}-`));
        if (id) return id;
      }
      return null;
    };
    const v7Pays = (text) => { const c = cellOfText(text); return Boolean(c && (v7.weights || {})[c] > 0 && !(v7.ledger_only || []).includes(c)); };
    const cells = (record.cells || []).filter((c) => FIELD_P[c.field] && c.state !== "closed");
    const cellOf = (i) => cells.find((c) => inCell(c, i));
    const best = new Map(), paid = new Set();
    const instances = [...(records.instances || [])].sort((a, b) => a.created_at - b.created_at);
    for (const i of instances) {
      if (!i.author || /challenge maintainers/i.test(i.author) || member(i.author).maintainers) continue;
      entry(i.author).active.push(i.created_at);
      if (i.created_at >= cutoff || voidedPosts.has(i.post_id) || (i.n & (i.n - 1)) !== 0 || i.certified === i.n - i.A + 1) continue;
      const c = cellOf(i);
      if (!c) continue;
      const link = `/threads/${i.thread_id}#${i.post_id}`;
      if (c.state === "refutation-only" && i.per_n > (c.record_above_per_n || 16)) {
        entry(i.author).lines.push({ points: P.advances?.statement || 1000, pending: true, rule: "rung0", t: i.created_at, id: i.post_id.slice(0, 12),
          words: `${thousands(i.certified)} at n = ${thousands(i.n)}, above 16 n`, href: link });
      }
      const pays = i.n >= (P.count_min_n || 256) && (c.state === "open" || i.created_at < since);
      if (pays && i.per_n > (best.get(c.id) || 0)) {
        const key = `${member(i.author).name}:${c.id}:${dayOf(i.created_at)}`;
        if (!paid.has(key)) {
          paid.add(key);
          entry(i.author).lines.push({ points: P.count_raise || 25, pending: false, rule: "count", t: i.created_at, id: i.post_id.slice(0, 12),
            words: `${c.code === "RS" ? c.field : `${c.code} ${c.field}`} rate ${c.rate}, gap ${c.gap}: ${perN(i.per_n)} n at n = ${thousands(i.n)}`, href: link });
        }
      }
      if (i.n >= (P.count_min_n || 256)) best.set(c.id, Math.max(best.get(c.id) || 0, i.per_n));
    }
    for (const i of instances) for (const r of i.reproduced_by || []) if (r.author && r.author !== i.author) entry(r.author).active.push(i.created_at);
    const perDay = new Map();
    for (const lead of [...leads].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
      const login = profiles.get(lead.author?.contributor) || null;
      const who = login || lead.author?.contributor;
      const t = Date.parse(lead.created_at);
      if (!who || !Number.isFinite(t) || member(who, login).maintainers) continue;
      if (t >= cutoff && !problemCell(`${lead.title || ""} ${lead.cell || ""}`)) continue;
      if (t >= v7since && !v7Pays(`${lead.title || ""} ${lead.cell || ""}`)) continue;
      if (voidedAccounts.has(lead.author?.contributor)) continue;
      const key = `${member(who, login).name}:${dayOf(t)}`;
      perDay.set(key, (perDay.get(key) || 0) + 1);
      if (perDay.get(key) > 10) continue;
      entry(who, login).lines.push({ points: P.advances?.result || 50, pending: true, rule: "lead", t, id: lead.record_id.slice(0, 12),
        words: clip(String(lead.title || lead.record_id), 110), href: `/workshop#/c/${encodeURIComponent(lead.campaign)}/workshop?node=${lead.record_id}` });
    }
    return [...rows.values()];
  }
  function boardStats(row, from, now) {
    const shown = row.lines.filter((l) => l.t >= from);
    const vested = shown.filter((l) => !l.pending);
    const all = row.lines.filter((l) => !l.pending).reduce((total, l) => total + l.points, 0);
    const days = new Set([...row.lines.map((l) => dayOf(l.t)), ...row.active.map(dayOf)]);
    const byRule = new Map();
    for (const l of vested) byRule.set(l.rule, (byRule.get(l.rule) || 0) + l.points);
    const last = Math.max(0, ...row.lines.map((l) => l.t), ...row.active);
    return { shown, points: vested.reduce((total, l) => total + l.points, 0), pending: shown.filter((l) => l.pending).reduce((total, l) => total + l.points, 0),
      all, byRule, days, last, recent: dayOf(now) - 13,
      activeHere: row.active.some((t) => t >= from) };
  }
  // A figure that rolls up when the motion runtime is there.
  function rollingFigure(value) {
    const motion = !still && window.PvfastMotion && customElements.get("number-flow");
    if (!motion) return value.toLocaleString("en-US");
    const flow = document.createElement("number-flow");
    flow.setAttribute("aria-hidden", "true");
    flow.locales = "en-US";
    flow.spinTiming = { duration: 1400, easing: "cubic-bezier(.16, 1, .3, 1)" };
    flow.update(0);
    requestAnimationFrame(() => requestAnimationFrame(() => flow.update(value)));
    return el("span", {}, flow, el("span", { class: "sr-only" }, value.toLocaleString("en-US")));
  }
  // Confetti from the theme's own colours, for the signed-in visitor's new points.
  function confetti(from) {
    if (still) return;
    const canvas = el("canvas", { class: "board-confetti", "aria-hidden": "true" });
    document.body.append(canvas);
    const ctx = canvas.getContext("2d"), ratio = devicePixelRatio || 1;
    canvas.width = innerWidth * ratio; canvas.height = innerHeight * ratio;
    ctx.scale(ratio, ratio);
    const css = getComputedStyle(document.documentElement);
    const colors = ["--record", "--amber", "--accent", "--pink", "--platform"].map((v) => css.getPropertyValue(v).trim() || "#7c86ff");
    const box = from?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    const bits = Array.from({ length: 140 }, (_, i) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2,
      vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 13 - 4, r: 3 + Math.random() * 4, a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length] }));
    const start = performance.now();
    const frame = (now) => {
      const k = (now - start) / 1900;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const b of bits) {
        b.vy += 0.38; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.a += b.va;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.c;
        ctx.fillRect(-b.r, -b.r / 2, b.r * 2, b.r); ctx.restore();
      }
      if (k < 1) requestAnimationFrame(frame); else canvas.remove();
    };
    requestAnimationFrame(frame);
  }
  function toast(words) {
    const note = el("p", { class: "board-toast", role: "status" }, ...words);
    document.body.append(note);
    requestAnimationFrame(() => note.classList.add("is-in"));
    setTimeout(() => { note.classList.remove("is-in"); setTimeout(() => note.remove(), 600); }, 6000);
    return note;
  }
  // The signed-in GitHub login, from auth-nav.js: that row comes first, marked "You".
  let boardYou = "";
  let boardRedraw = null;
  window.addEventListener("pvfast-auth-changed", (event) => {
    boardYou = event.detail?.login || "";
    boardRedraw?.();
  });
  // A model as its mark, named on hover; a model without a mark keeps its name.
  function modelMark(name) {
    const tag = modelTag(name);
    const icon = tag.querySelector(".kit-model-mark");
    return icon ? el("span", { class: "board-model", title: `Self-reported: ${name}`, role: "img", "aria-label": name }, icon) : tag;
  }
  // What the points are for, from the record's own table, in the Points column's infotip.
  function renderPointsRules(record) {
    const root = $("points-help"), P = record.points;
    if (!root || !P) return;
    const a = P.advances, share = `${Math.round(P.share * 100)}%`;
    const items = [[pts(a.statement), "Prove a ranked statement or solve a target"], [pts(a.refutes), "Refute a ranked statement"],
      [pts(a.bound || 500), "Prove a missing bound (a cell of the claim board)"], [pts(a.port), "Fill a port of one"], [pts(a.upper), "Prove an upper bound"], [pts(a.result), "Any other accepted result"],
      [share, "Review a result (half at once)"], [share, "A later result builds on yours"], [pts(P.count_raise), `Raise a cell's best count at n ≥ ${thousands(P.count_min_n)}`],
      [`×${P.bonuses.week}`, "The contribution of the week"], [`×${P.bonuses.lean}`, "A Lean proof, kernel-checked against ArkLib"]];
    root.replaceChildren(el("h3", {}, "How points work"),
      el("ul", {}, items.map(([n, words]) => el("li", {}, el("b", {}, n), el("span", {}, words)))),
      el("p", {}, "Points land when a result is accepted. A Lean file is kernel-checked within hours; a proof or a count needs a review by another operator and a maintainer. Copies of certified counts earn none. Weeks start Monday 00:00 UTC."));
  }
  async function renderBoard(record) {
    const root = $("crew");
    if (!root) return;
    renderPointsRules(record);
    // First from the record and whatever the browser kept; the live reads redraw below.
    let records = kept("starks-bulletin-records") || { instances: [] };
    const keptLeads = kept("starks-leads") || [];
    let rows = boardPeople(record, records, keptLeads);
    let all = rows.flatMap((row) => row.lines);
    const now = Date.now();
    let seen = 0;
    try { seen = Number(localStorage.getItem("starks-board-seen")) || 0; } catch { /* storage off */ }
    const label = (m) => (m.login ? `@${m.login}` : personName(m.name));
    const isYou = (m) => Boolean(boardYou && m.login === boardYou);
    const sum = (lines) => lines.reduce((total, l) => total + l.points, 0);
    const open = new Set();
    const draw = () => {
      const from = 0;
      const stats = rows.map((row) => ({ row, s: boardStats(row, from, now) })).filter(({ s }) => s.points || s.pending);
      stats.sort((a, b) => b.s.points - a.s.points || b.s.pending - a.s.pending || b.s.last - a.s.last);
      // What happened since the last visit, with the visitor's own points when signed in.
      if (seen) {
        const fresh = all.filter((l) => !l.pending && l.t > seen);
        const yours = sum(rows.filter((row) => isYou(row.m)).flatMap((row) => row.lines).filter((l) => !l.pending && l.t > seen));
        const accepted = new Set(fresh.filter((l) => !["review", "built_on", "count", "error"].includes(l.rule)).map((l) => l.id)).size;
        $("board-since").replaceChildren(el("b", {}, `Since your visit on ${day(new Date(seen).toISOString())}: `), `+${pts(sum(fresh))} points`,
          accepted ? `, ${nOf(accepted, "result")} accepted` : "", ".", yours ? el("span", { class: "board-yours" }, ` You: +${pts(yours)}.`) : "");
        $("board-since").hidden = !fresh.length;
      }
      // Places by points; a tie shares its place. The move is against the same window a week ago.
      const place = (list) => {
        const out = new Map();
        let at = 0, last = null;
        list.forEach(({ row, points }, i) => { if (points > 0) { if (points !== last) at = i + 1; last = points; out.set(row, at); } });
        return out;
      };
      const ranks = place(stats.map(({ row, s }) => ({ row, points: s.points })));
      const [prevFrom, prevTo] = [0, now - 7 * DAY];
      const before = place(rows.map((row) => ({ row, points: sum(row.lines.filter((l) => !l.pending && l.t >= prevFrom && l.t < prevTo)) }))
        .sort((x, y) => y.points - x.points));
      const head = el("tr", {}, el("th", { scope: "col", class: "board-rank" }, el("span", { class: "sr-only" }, "Place")),
        el("th", { scope: "col" }, nOf(stats.length, "contributor")), el("th", { scope: "col", class: "is-days" }, "Last 14 days"),
        el("th", { scope: "col" }, "Points", el("button", { type: "button", class: "info-tip", popovertarget: "points-help", "aria-label": "How points work" }, "i")),
        el("th", { scope: "col" }, el("span", { class: "sr-only" }, "Earned for")), el("th", { scope: "col" }, el("span", { class: "sr-only" }, "Share")));
      const when = "so far";
      // The home page shows the first few (data-limit) and links to everyone.
      const limit = Number(root.dataset.limit) || Infinity;
      const body = stats.slice(0, limit).flatMap(({ row, s }) => {
        const m = row.m, you = isYou(m), key = m.login || m.name;
        const name = m.login ? el("a", { class: "kit-person-name", href: `/workshop#/people/${encodeURIComponent(m.login)}` }, label(m))
          : el("span", { class: "kit-person-name" }, label(m));
        const person = el("span", { class: "kit-person" }, face(m, 28), name, you ? el("span", { class: "board-you" }, "You") : "", [...(m.agents || [])].map(modelMark));
        const dots = el("span", { class: "board-dots", title: nOf(s.days.size, "active day") },
          Array.from({ length: 14 }, (_, i) => el("i", { class: s.days.has(s.recent + i) ? "is-on" : "" })));
        const points = el("td", { class: "board-points" }, el("b", { class: s.points ? "" : "is-zero" }, rollingFigure(s.points)),
          s.pending ? el("span", { class: "board-pending", title: "Posted, not accepted yet. A Lean file is kernel-checked within hours; a proof or a count needs a review by another operator and a maintainer. The points land when it is accepted." }, `+${pts(s.pending)} once reviewed`) : "");
        const chips = [...s.byRule].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([rule, n]) =>
          el("span", { class: `board-chip is-${RULE_TONE[rule]}` }, el("b", {}, `+${pts(n)}`), ` ${RULE_CHIP[rule]}`));
        const toggle = el("button", { type: "button", class: "board-open", "aria-expanded": String(open.has(key)), "data-open": key },
          chips.length ? chips : el("span", { class: "board-chip" }, "nothing accepted yet"), el("span", { class: "board-caret", "aria-hidden": "true" }));
        const words = [...s.byRule].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([rule]) => RULE_POST[rule]).join(", ");
        const text = you ? `I earned ${pts(s.points)} points on starks.provably.fast ${when}${words ? `: ${words}` : ""}. Help make STARK proofs smaller.`
          : `${m.login || personName(m.name)} earned ${pts(s.points)} points on starks.provably.fast ${when}${words ? `: ${words}` : ""}. Help make STARK proofs smaller.`;
        const share = el("td", { class: "board-share" }, el("a", { class: "adv-share is-icon", target: "_blank", rel: "noopener noreferrer", title: "Share on X",
          "aria-label": you ? `Share your points on X` : `Share ${label(m)}'s points on X`,
          href: `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent("https://starks.provably.fast/#people")}` }, svgIcon("#x-mark")));
        const at = ranks.get(row), was = before.get(row);
        const move = !at ? "" : !was ? el("small", { class: "board-move is-new" }, "new") : was > at ? el("small", { class: "board-move is-up", title: `Up ${was - at} since a week ago` }, `▲${was - at}`)
          : was < at ? el("small", { class: "board-move is-down", title: `Down ${at - was} since a week ago` }, `▼${at - was}`) : "";
        const rank = el("td", { class: `board-rank${at && at <= 3 ? ` is-top is-${at}` : ""}` }, at ? el("b", {}, String(at)) : el("span", { "aria-label": "no place yet" }, "–"), move);
        const tr = el("tr", { class: `board-row${you ? " is-you" : ""}`, "data-key": key }, rank, el("th", { scope: "row" }, person), el("td", { class: "is-days" }, dots),
          points, el("td", { class: "board-earned" }, toggle), share);
        // The receipts: every line behind the figure, newest first.
        const receipts = el("tr", { class: "board-receipts" }, el("td", { colspan: 6 }, el("ul", {}, [...s.shown].sort((a, b) => b.t - a.t).map((l) =>
          el("li", { class: l.pending ? "is-pending" : "" }, el("b", { class: `is-${RULE_TONE[l.rule]}` }, `+${pts(l.points)}`),
            el("a", { href: l.href }, l.words), el("small", {}, `${RULE_CHIP[l.rule]} · ${day(new Date(l.t).toISOString())}${l.pending ? " · once reviewed" : ""}`))))));
        receipts.hidden = !open.has(key);
        return [tr, receipts];
      });
      root.replaceChildren(el("table", { class: "kit-crew board-table" }, el("thead", {}, head), el("tbody", {}, body)));
      // Everyone active in the window whose work earned nothing yet, by name, with what does.
      const quiet = rows.filter((row) => !stats.some((x) => x.row === row) && row.active.some((t) => t >= from) && !row.m.maintainers);
      $("board-quiet").replaceChildren(...(quiet.length ? [el("b", {}, "Also active, no points yet: "),
        ...andList([...quiet.slice(0, 4).map((row) => label(row.m)), ...(quiet.length > 4 ? [`${quiet.length - 4} more`] : [])]), "."] : []));
      return stats;
    };
    boardRedraw = () => celebrate(draw());
    // The signed-in visitor's own new points since the last visit: a toast, and confetti from their row.
    const celebrate = (stats) => {
      const mine = stats.find(({ row }) => isYou(row.m));
      if (!mine) return;
      let before = null;
      try { before = localStorage.getItem(`starks-points-${boardYou}`); localStorage.setItem(`starks-points-${boardYou}`, String(mine.s.all)); } catch { /* storage off */ }
      if (before === null || Number(before) >= mine.s.all) return;
      const gained = mine.s.all - Number(before), crossed = MILESTONES.filter((m) => m > Number(before) && m <= mine.s.all).pop();
      const note = toast([el("b", {}, `+${pts(gained)} points`), crossed ? ` since your last visit. You passed ${pts(crossed)}.` : " since your last visit."]);
      confetti(note);
    };
    boardRedraw();
    // The live reads arrive after the first draw: the certified counts, then the graph's leads with
    // their pending points. Each redraws once.
    let liveLeads = keptLeads;
    const redraw = () => { rows = boardPeople(record, records, liveLeads); all = rows.flatMap((row) => row.lines); draw(); };
    loadBulletinRecords().then((live) => { records = live; redraw(); }).catch(() => { /* the record's points alone */ });
    loadLeads(record).then((leads) => { liveLeads = leads; redraw(); }).catch(() => { /* the board stands without them */ });
    if (!still && window.PvfastMotion) window.PvfastMotion.animate("#crew tbody tr.board-row", { opacity: [0.35, 1], y: [6, 0], delay: window.PvfastMotion.stagger(25), duration: 500, ease: "out(3)" });
    if (!root.dataset.bound) {
      root.dataset.bound = "1";
      root.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-open]");
        if (!button) return;
        const key = button.dataset.open, shown = !open.has(key);
        if (shown) open.add(key); else open.delete(key);
        button.setAttribute("aria-expanded", String(shown));
        const tr = button.closest("tr").nextElementSibling;
        if (tr?.classList.contains("board-receipts")) tr.hidden = !shown;
      });
      // The visit counts as seen once the page has been open a little while.
      setTimeout(() => { try { localStorage.setItem("starks-board-seen", String(now)); } catch { /* storage off */ } }, 4000);
    }
  }
  // Certified counts enter the record on their own: the bulletin certifies every attached instance,
  // and the platform lists them with their standing (/api/participation/bulletin/records). Only
  // lemmas and proofs wait for a human.
  let certifiedSort = { key: "posted", dir: -1 };
  async function renderCertified() {
    const root = $("certified-live");
    if (!root) return;
    try {
      const [response, profiles] = await Promise.all([fetch("/api/participation/bulletin/records?topic=MATHEMATICS", { cache: "no-cache" }), loadProfiles()]);
      const author = (b) => ({ name: b.author, login: profiles.get(b.author) || null });
      if (!response.ok) throw new Error(String(response.status));
      const live = await response.json();
      const rows = (live.parameters || []).filter((p) => p.best && p.best.certified > 0);
      if (!rows.length) { root.replaceChildren(el("p", { class: "loading" }, "No certified instance yet.")); return; }
      const FIELDS = { 2013265921: "BabyBear", 2130706433: "KoalaBear" };
      const field = (p) => (p.code === "Circle" ? "the native Circle code over M31" : FIELDS[p.p] || `p = ${p.p}`);
      const columns = [
        ["n", "Setting", (p) => p.n], ["agree", "Agreement", (p) => p.A / p.n], ["count", "Bad challenges", (p) => p.best.certified],
        ["who", "Posted by", (p) => (author(p.best).login || personName(p.best.author)).toLowerCase(), true],
        ["repro", "Reproduced", (p) => Number(Boolean(p.best.reproduced))], ["posted", "Posted", (p) => p.best.created_at],
      ];
      const row = (p) => {
        const b = p.best, id = `cert-${p.p}-${p.n}-${p.k}-${p.A}`;
        const more = el("tr", { class: "record-more", id }, el("td", { colspan: columns.length }, el("div", { class: "record-detail" },
          el("p", {}, el("b", {}, "Parameters "), `n = ${thousands(p.n)}, k = ${thousands(p.k)}, A = ${thousands(p.A)}`),
          el("p", {}, el("b", {}, "Rate and agreement "), `${frac(p.k, p.n)} and ${frac(p.A, p.n)}, a gap of ${frac(p.A - p.k, p.n)} above the rate`),
          el("p", {}, el("b", {}, "Field "), `${field(p)}, p = ${thousands(p.p)}`),
          el("p", {}, el("b", {}, "Count "), `${thousands(b.certified)} bad challenges, ${b.per_n} per point of the domain (${b.per_n}n)`),
          el("p", {}, el("b", {}, "Certified "), `${nOf(p.instances, "instance")} at these parameters; this is the best`),
          el("p", {}, el("b", {}, "Posted "), day(new Date(b.created_at).toISOString())),
          el("p", {}, el("b", {}, "Reproduced "), b.reproduced ? "yes, by someone else" : "not yet"),
          el("p", {}, el("a", { class: "record-open", href: `/threads/${b.thread_id}#${b.post_id}` }, "Open the post")))));
        more.hidden = true;
        const toggle = el("button", { type: "button", class: "record-toggle", "aria-expanded": "false", "aria-controls": id }, `n = ${thousands(p.n)}`, el("small", {}, ` · rate ${frac(p.k, p.n)}${p.code === "Circle" ? " · Circle" : ""}`));
        toggle.addEventListener("click", () => { more.hidden = !more.hidden; toggle.setAttribute("aria-expanded", String(!more.hidden)); });
        // The whole row opens its details; the button keeps it reachable by keyboard.
        const tr = el("tr", { class: "record-tr is-clickable" },
          el("td", { class: "is-title" }, toggle),
          el("td", { class: "is-date is-agree" }, frac(p.A, p.n)),
          el("td", { class: "is-count" }, el("b", {}, thousands(b.certified)), el("small", {}, ` ${b.per_n}n`)),
          el("td", { class: "is-who" }, el("span", { class: "record-who" }, githubPerson(author(b), 20))),
          el("td", { class: "is-state is-repro" }, el("span", { class: `verdict is-${b.reproduced ? "accepted" : "posted"}` }, b.reproduced ? "reproduced" : "not yet")),
          el("td", { class: "is-date is-posted" }, day(new Date(b.created_at).toISOString())));
        tr.addEventListener("click", (event) => { if (!event.target.closest("a, button")) toggle.click(); });
        return [tr, more];
      };
      root.replaceChildren(...[certifiedMap(live.instances || [], (a) => (profiles.get(a) ? `@${profiles.get(a)}` : personName(a)))].filter(Boolean),
        sortableTable(el("div", { class: "record-table-wrap is-certified" }), { columns, rows, sort: certifiedSort, row, limit: 20,
        tie: (a, b) => b.best.certified - a.best.certified,
        note: `The best count at each size, rate and agreement; higher is a stronger lower bound. Click a row for its parameters and post.` }));
    } catch {
      root.replaceChildren(el("p", { class: "loading" }, "The certified counts could not be read just now."));
    }
  }
  // A rate or agreement as its family: 5/8 when exact, 5/8+1 when a few points off a simple fraction.
  function family(v, n) {
    for (let d = 2; d <= 64; d++) if ((v * d) % n === 0) return frac(v, n);
    for (const d of [2, 4, 8, 16]) {
      const base = Math.round((v * d) / n), off = v - (base * n) / d;
      if (Number.isInteger((base * n) / d) && off && Math.abs(off) <= 8) return `${frac(base, d)}${off > 0 ? "+" : "−"}${Math.abs(off)}`;
    }
    return frac(v, n);
  }
  // Every certified submission, in three views. "Where it grows" places each rate and agreement against
  // the agreement thresholds, coloured by how fast its best count grows with n. "How counts grow" has one
  // panel per rate, a line per agreement through the best count per point at each size. "What's been
  // tried" is the grid of settings by size, each cell counting its submissions and opening its best post.
  const CERT_VIEWS = [["map", "Where it grows"], ["growth", "How counts grow"], ["tried", "What's been tried"]];
  // Rates other than these share one grey, named "other rates" in the key.
  const RATE_HUES = { "1/8": "r18", "1/4": "r14", "1/2": "r12" };
  let certView = "map";
  function certifiedMap(instances, who) {
    const subs = instances.filter((i) => i && [i.n, i.k, i.A, i.certified, i.per_n, i.created_at].every(Number.isFinite) && i.certified > 0 && i.n > 0 && i.per_n > 0).sort((a, b) => a.created_at - b.created_at);
    if (!subs.length) return null;
    const colOf = (i) => `${family(i.k, i.n)}|${family(i.A, i.n)}`;
    // A rate a few points off a simple fraction takes that fraction's colour.
    const hue = (c) => RATE_HUES[c.split("|")[0].split(/[+−]/)[0]] || "other";
    const cols = [...new Map(subs.map((i) => [colOf(i), i])).entries()]
      .sort(([, a], [, b]) => a.k / a.n - b.k / b.n || a.A / a.n - b.A / b.n).map(([key]) => key);
    const sizes = [...new Set(subs.map((i) => i.n))].sort((a, b) => b - a);
    const cells = new Map();
    for (const i of subs) {
      const key = `${colOf(i)} ${i.n}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(i);
    }
    const bestOf = (here) => here.reduce((a, b) => (b.per_n > a.per_n ? b : a));
    const settings = new Set(subs.map((i) => `${i.p} ${i.n} ${i.k} ${i.A}`)).size;
    const root = el("figure", { class: "lane-timeline certmap" });
    const views = el("div", { class: "certmap-views", role: "group", "aria-label": "View" });
    const guide = el("p", { class: "certmap-guide" });
    const legend = el("span", { class: "certmap-key" });
    const caption = el("figcaption", { class: "lane-key" },
      el("span", { class: "record-viz-title" }, `Every certified submission: ${thousands(subs.length)} at ${nOf(settings, "setting")}`), legend);
    const plot = el("div", { class: "board-chart" });
    const read = el("p", { class: "lane-read", "aria-live": "polite" });
    const where = (c) => { const [rate, agree] = c.split("|"); return `Rate ${rate}, agreement ${agree}`; };
    const show = (i) => read.replaceChildren(el("b", {}, `${where(colOf(i))}, n = ${thousands(i.n)}`),
      ` · ${thousands(i.certified)} bad challenges, ${Number(i.per_n.toPrecision(3))} per point · ${who(i.author)} · ${day(new Date(i.created_at).toISOString())} · `,
      el("span", { class: `verdict is-${i.leading ? "accepted" : "posted"}` }, i.leading ? "leading" : "not leading"));
    const showCell = (here) => {
      const best = bestOf(here);
      read.replaceChildren(el("b", {}, `${where(colOf(best))}, n = ${thousands(best.n)}`),
        ` · ${nOf(here.length, "submission")} · best ${thousands(best.certified)} bad challenges, ${Number(best.per_n.toPrecision(3))} per point, by ${who(best.author)}`);
    };
    const showLine = (c, pts) => read.replaceChildren(el("b", {}, where(c)), " · best per point: ",
      pts.map((i) => `${Number(i.per_n.toPrecision(3))} at n = ${thousands(i.n)}`).join(", "),
      ` · ${nOf(subs.filter((i) => colOf(i) === c).length, "submission")}`);
    // One submission as a dot that names itself and opens its post.
    const dot = (i, cx, cy, r, cls) => {
      const a = svgEl("a", { href: `/threads/${i.thread_id}#${i.post_id}`, "aria-label": `${where(colOf(i))}, n = ${thousands(i.n)}: ${thousands(i.certified)} bad challenges, ${who(i.author)}${i.leading ? ", leading" : ""}` });
      a.append(svgEl("circle", { class: cls, cx: cx.toFixed(1), cy: cy.toFixed(1), r }));
      a.addEventListener("pointerenter", () => show(i)); a.addEventListener("focus", () => show(i));
      return a;
    };
    // Per setting: its best point at each size, where it sits against the thresholds, and how fast its
    // count grows: the least-squares slope of log count on log n over sizes within 16x of its largest.
    // A slope of 1 is linear; one size, or sizes within 2x of each other, give no slope.
    const info = new Map(cols.map((c) => {
      const pts = [...new Set(subs.filter((i) => colOf(i) === c).map((i) => i.n))].sort((a, b) => a - b).map((n) => bestOf(cells.get(`${c} ${n}`)));
      const top = pts[pts.length - 1], rate = top.k / top.n, agree = top.A / top.n;
      const zone = agree >= Math.sqrt(rate) ? "linear" : agree >= a1(rate) ? "t1" : "open";
      const fit = pts.filter((i) => i.n * 16 >= top.n);
      let exp = null;
      if (fit.length > 1 && top.n >= 2 * fit[0].n) {
        const xs = fit.map((i) => Math.log(i.n)), ys = fit.map((i) => Math.log(i.per_n * i.n));
        const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
        exp = xs.reduce((a, x, k) => a + (x - mx) * (ys[k] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
      }
      // An agreement a few points off a fraction (5/8+1) is not one ratio: A / n drifts toward it as n grows.
      const drift = /[+−]/.test(c.split("|")[1]) && pts.length > 1;
      return [c, { pts, rate, agree, zone, exp, top, drift }];
    }));
    const ZONE_NAME = { open: "below first order, where T3 asks", t1: "between first order and Johnson, where T1 asks", linear: "above Johnson, linear already known" };
    const pace = (e) => (e === null ? "one" : e > 1.1 ? "fast" : e >= 0.9 ? "even" : "slow");
    const paceWords = (e) => (e === null ? "one size, no slope yet" : `best count grows like n^${e.toFixed(2)}`);
    const driftWords = (s) => (s.drift ? ` · agreement drifts with n, A / n from ${(s.pts[0].A / s.pts[0].n).toFixed(4)} to ${s.agree.toFixed(4)}` : "");
    let focus = null;
    // The tried settings against the agreement thresholds, coloured by how fast each count grows.
    function map(W) {
      const narrow = W < 640, H = narrow ? Math.round(W * 0.85) : 420, L = 46, R = 14, T = 12, B = 40;
      const X = (r) => L + r * (W - L - R), Y = (a) => T + (1 - a) * (H - T - B);
      const svg = svgEl("svg", { class: "board-svg certmap-svg", viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": "Each tried rate and agreement against the agreement thresholds, coloured by how fast its count grows with n" });
      const text = (cls, x, y, words, anchor = "middle") => { const t = svgEl("text", { class: cls, x, y, "text-anchor": anchor }); t.textContent = words; svg.append(t); return t; };
      for (const [v, label] of [[0, "0"], [0.25, "1/4"], [0.5, "1/2"], [0.75, "3/4"], [1, "1"]]) {
        svg.append(svgEl("line", { class: "rg-grid", x1: X(v), x2: X(v), y1: Y(0), y2: Y(1) }), svgEl("line", { class: "rg-grid", x1: X(0), x2: X(1), y1: Y(v), y2: Y(v) }));
        text("rg-axis", X(v), Y(0) + 18, label); text("rg-axis", L - 8, Y(v) + 4, label, "end");
      }
      text("rg-axis-title", X(1), Y(0) + 36, "code rate ρ →", "end");
      text("rg-axis-title", X(0) + 8, Y(1) + 16, "↑ agreement A / n", "start");
      const N = 200, rs = Array.from({ length: N + 1 }, (_, i) => 0.0005 + 0.9985 * (i / N));
      const line = (f) => rs.map((r, i) => `${i ? "L" : "M"}${X(r).toFixed(1)} ${Y(f(r)).toFixed(1)}`).join(" ");
      const band = (up, lo) => `${line(up)} ${rs.slice().reverse().map((r) => `L${X(r).toFixed(1)} ${Y(lo(r)).toFixed(1)}`).join(" ")} Z`;
      svg.append(svgEl("path", { class: "rg-band-linear", d: band(() => 1, Math.sqrt) }), svgEl("path", { class: "certmap-band-t1", d: band(Math.sqrt, a1) }));
      for (const c of [CURVES[1], CURVES[2], CURVES[3]]) svg.append(svgEl("path", { class: `rg-curve is-${c.id}`, d: line(c.f) }));
      // Settings that land on the same spot step a little sideways; one that still finds no room joins
      // the dot it hits, which then shows how many settings it holds. Fast growers are placed first, so
      // they keep their own spot. Dots never stray far from their true rate.
      const placed = [];
      const order = [...info].sort(([, a], [, b]) => (b.exp ?? -Infinity) - (a.exp ?? -Infinity) || b.top.n - a.top.n);
      for (const [c, s] of order) {
        const r = (narrow ? 0.55 : 1) * Math.min(8, Math.max(pace(s.exp) === "fast" ? 6 : 0, 2.5 + Math.log2(s.top.n) * 0.5)), y = Y(s.agree), x0 = X(s.rate);
        const hit = (x) => placed.find((p) => Math.hypot(p.x - x, p.y - y) < p.r + r);
        const x = [0, 1, -1, 2, -2].map((k) => Math.min(W - r, Math.max(r, x0 + k * (r + 1.5) * 1.6))).find((x) => !hit(x));
        if (x === undefined) hit(x0).members.push([c, s]);
        else placed.push({ x, y, r, members: [[c, s]] });
      }
      // Least important first, so fast growers draw on top.
      for (const p of placed.reverse()) {
        const [[c, s]] = p.members, many = p.members.length > 1;
        const r = many ? Math.min(12, Math.max(narrow ? 0 : 7, p.r + 1.5 + Math.log2(p.members.length))) : p.r;
        const words = many ? `${p.members.length} settings near ${where(c).toLowerCase()}; ${s.exp === null ? "none with a slope yet" : `the fastest ${paceWords(s.exp)}`}`
          : `${where(c)}: ${ZONE_NAME[s.zone]}; ${paceWords(s.exp)}${driftWords(s)}; largest n = ${thousands(s.top.n)}`;
        const a = svgEl("a", { href: "#", "aria-label": words });
        a.append(svgEl("circle", { class: `certmap-pace is-${pace(s.exp)}${s.drift && !many ? " is-drift" : ""}${many ? " is-many" : ""}`, cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: r.toFixed(1) }));
        if (many && r >= 7) { const t = svgEl("text", { class: "certmap-many", x: p.x.toFixed(1), y: (p.y + 3.5).toFixed(1), "text-anchor": "middle" }); t.textContent = String(p.members.length); a.append(t); }
        const tell = () => many
          ? read.replaceChildren(el("b", {}, `${p.members.length} settings here`), " · ", p.members.slice(0, 6).map(([m, t]) => `${where(m).toLowerCase()} (${t.exp === null ? "one size" : `n^${t.exp.toFixed(2)}`})`).join("; "), p.members.length > 6 ? `; ${p.members.length - 6} more` : "", " · click for the fastest one's line")
          : read.replaceChildren(el("b", {}, where(c)), ` · ${ZONE_NAME[s.zone]} · ${paceWords(s.exp)}${driftWords(s)} · sizes ${s.pts.map((i) => thousands(i.n)).join(", ")} · best ${thousands(s.top.certified)} at n = ${thousands(s.top.n)}`);
        a.addEventListener("pointerenter", tell); a.addEventListener("focus", tell);
        a.addEventListener("click", (event) => { event.preventDefault(); focus = c; setView("growth"); });
        svg.append(a);
      }
      // Curve names last, so no dot hides them.
      if (!narrow) {
        text("certmap-curve-name is-johnson", X(0.36), Y(Math.sqrt(0.36)) - 10, "Johnson √ρ", "end");
        text("certmap-curve-name is-first", X(0.62), Y(a1(0.62)) + 20, "first order a₁(ρ)", "start");
        text("certmap-curve-name is-capacity", X(0.9), Y(0.9) + 22, "limit ρ", "start");
      }
      return svg;
    }
    // One panel per rate, sharing both scales, so lines at one rate are compared with each other.
    function growth(W) {
      const ns = [...sizes].reverse(), x0 = Math.log2(ns[0]), x1 = Math.log2(ns[ns.length - 1]);
      // The scale fits the best counts; the few weaker submissions below it are left off and counted.
      const per = [...cells.values()].map((h) => bestOf(h).per_n), y0 = Math.floor(Math.log10(Math.min(...per))), y1 = Math.ceil(Math.log10(Math.max(...per)));
      const below = subs.filter((i) => Math.log10(i.per_n) < y0).length;
      if (below) guide.append(` ${nOf(below, "weaker submission")} below ${thousands(10 ** y0)} hidden.`);
      const panels = [...Object.entries(RATE_HUES), ["other", "other"]].map(([r, k]) => [r, k, cols.filter((c) => hue(c) === k)]).filter(([, , cs]) => cs.length);
      const across = W >= 760 ? 2 : 1, gap = 20, pw = (W - gap * (across - 1)) / across, ph = 280;
      const down = Math.ceil(panels.length / across), H = down * ph + (down - 1) * gap;
      const svg = svgEl("svg", { class: "board-svg certmap-svg", viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": "Best bad challenges per point of the domain as n grows, one panel per rate, one line per agreement" });
      const text = (cls, x, y, words, anchor = "middle", into = svg) => { const t = svgEl("text", { class: cls, x, y, "text-anchor": anchor }); t.textContent = words; into.append(t); return t; };
      const groups = [];
      panels.forEach(([rateName, k, cs], idx) => {
        const ox = (idx % across) * (pw + gap), oy = Math.floor(idx / across) * (ph + gap), pl = 44, pr = 64, pt = 26, pb = 30;
        const X = (n) => ox + pl + ((Math.log2(n) - x0) / (x1 - x0 || 1)) * (pw - pl - pr);
        const Y = (v) => oy + pt + (1 - (Math.log10(v) - y0) / (y1 - y0 || 1)) * (ph - pt - pb);
        text(`certmap-rate is-${k}`, ox + pl, oy + 14, k === "other" ? "other rates" : `rate ${rateName}`, "start");
        text("board-axis", ox + pw - pr, oy + 14, "per point, by n", "end");
        for (let e = y0; e <= y1; e++) {
          svg.append(svgEl("line", { class: "board-grid", x1: ox + pl, x2: ox + pw - pr, y1: Y(10 ** e), y2: Y(10 ** e) }));
          text("board-axis", ox + pl - 6, Y(10 ** e) + 4, thousands(10 ** e), "end");
        }
        // Powers of two only: the odd sizes sit between them unlabelled.
        const every = pw < 420 ? 2 : 1;
        for (let e = Math.ceil(x0); e <= Math.floor(x1); e += every) text("board-axis", X(2 ** e), oy + ph - pb + 16, thousands(2 ** e));
        const labels = [];
        for (const c of cs) {
          const { pts, zone } = info.get(c);
          const g = svgEl("g", { class: `certmap-series is-z-${zone}` });
          for (const i of subs) if (colOf(i) === c && !pts.includes(i) && Math.log10(i.per_n) >= y0) g.append(dot(i, X(i.n), Y(i.per_n), 2.2, "certmap-sub"));
          if (pts.length > 1) {
            g.append(svgEl("path", { class: "certmap-line", d: pts.map((i, j) => `${j ? "L" : "M"}${X(i.n).toFixed(1)} ${Y(i.per_n).toFixed(1)}`).join(" ") }));
            const last = pts[pts.length - 1];
            labels.push({ g, c, x: X(last.n) + 7, y: Y(last.per_n) + 4 });
          }
          for (const i of pts) g.append(dot(i, X(i.n), Y(i.per_n), 3.6, "certmap-best"));
          g.addEventListener("pointerenter", () => { svg.classList.add("is-focus"); groups.forEach((h) => h.classList.toggle("is-lit", h === g)); showLine(c, pts); });
          g.addEventListener("pointerleave", () => { if (focus !== c) { svg.classList.toggle("is-focus", Boolean(focus)); g.classList.remove("is-lit"); groups.forEach((h) => h.classList.toggle("is-lit", h.dataset.col === focus)); } });
          g.dataset.col = c;
          groups.push(g);
        }
        // Name at most six lines a panel, fastest growth first, then the highest count; a name that would
        // overlap another or leave the panel is dropped, and its line fades until hovered.
        const named = [], ex = (l) => info.get(l.c).exp ?? -Infinity;
        labels.sort((a, b) => ex(b) - ex(a) || a.y - b.y);
        for (const l of labels) {
          // A name that would run off the panel sits above its end point instead.
          const words = k === "other" ? l.c.replace("|", " · ") : l.c.split("|")[1], w = words.length * 7, over = l.x + w > ox + pw;
          const x = over ? l.x - 7 - w : l.x, y = over ? l.y - 12 : l.y;
          if (named.length >= 6 || y < oy + pt || y > oy + ph - pb || named.some((m) => Math.abs(m.y - y) < 13 && m.x < x + w && x < m.x + m.w)) continue;
          named.push({ x, y, w }); l.g.classList.add("is-named");
          text("certmap-label", x, y, words, "start", l.g);
        }
      });
      // Named lines draw on top.
      svg.append(...groups.sort((a, b) => a.classList.contains("is-named") - b.classList.contains("is-named")));
      const lit = focus && groups.find((h) => h.dataset.col === focus);
      if (lit) { svg.classList.add("is-focus"); lit.classList.add("is-lit"); showLine(focus, info.get(focus).pts); }
      return svg;
    }
    // One fixed-height cell per setting and size, shaded by submissions and labelled with their count;
    // a cell opens its best post. Agreement labels sit at an angle so every column keeps its name.
    function tried(W) {
      const padL = 74, padR = 8, padT = 26, rowH = 22, axis = 64;
      const colW = (W - padL - padR) / cols.length, H = padT + sizes.length * rowH + axis;
      const most = Math.log(Math.max(...[...cells.values()].map((h) => h.length)));
      const svg = svgEl("svg", { class: "board-svg certmap-svg is-grid", viewBox: `0 0 ${W} ${H}`, width: W, role: "group", "aria-label": "Certified submissions by rate, agreement and size" });
      const text = (cls, x, y, words, anchor = "middle", extra = {}) => { const t = svgEl("text", { class: cls, x, y, "text-anchor": anchor, ...extra }); t.textContent = words; svg.append(t); return t; };
      const rowLabel = new Map(), colLabel = new Map(), top = (r) => padT + r * rowH;
      sizes.forEach((n, r) => {
        svg.append(svgEl("line", { class: "board-grid", x1: padL, x2: W - padR, y1: top(r), y2: top(r) }));
        rowLabel.set(n, text("board-axis", padL - 8, top(r) + rowH / 2 + 4, thousands(n), "end"));
      });
      text("board-axis", padL - 8, padT - 8, "rate →", "end");
      const bottom = top(sizes.length);
      cols.forEach((c, x) => {
        const [rate, agree] = c.split("|"), left = padL + x * colW;
        const lx = left + colW / 2, ly = bottom + 10;
        colLabel.set(c, text("board-axis certmap-agree", lx, ly, agree, "end", { transform: `rotate(-60 ${lx.toFixed(1)} ${ly})` }));
        // A new rate starts a group: a rule down the grid and the rate above it, where it fits.
        if (!x || cols[x - 1].split("|")[0] !== rate) {
          svg.append(svgEl("line", { class: "board-grid", x1: left, x2: left, y1: padT - 20, y2: bottom }));
          const span = cols.slice(x).findIndex((d) => d.split("|")[0] !== rate);
          if ((span < 0 ? cols.length - x : span) * colW >= rate.length * 7 + 6) text(`certmap-rate is-${hue(c)}`, left + 4, padT - 8, rate, "start");
        }
        sizes.forEach((n, r) => {
          const here = cells.get(`${c} ${n}`);
          if (!here) return;
          const best = bestOf(here);
          const g = svgEl("a", { class: "certmap-g", href: `/threads/${best.thread_id}#${best.post_id}`, style: `--heat: ${Math.round(14 + (most ? Math.log(here.length) / most : 1) * 50)}%`,
            "aria-label": `${where(c)}, n = ${thousands(n)}: ${nOf(here.length, "submission")}, best ${thousands(best.certified)} by ${who(best.author)}` });
          g.append(svgEl("rect", { class: "certmap-cell", x: left + 1, y: top(r) + 2, width: Math.max(1, colW - 2), height: rowH - 4, rx: 3 }));
          if (colW >= 13) {
            const t = svgEl("text", { class: "certmap-count", x: lx, y: top(r) + rowH / 2 + 3.5, "text-anchor": "middle" });
            t.textContent = String(here.length);
            g.append(t);
          }
          const on = (lit) => { rowLabel.get(n).classList.toggle("is-on", lit); colLabel.get(c).classList.toggle("is-on", lit); if (lit) showCell(here); };
          g.addEventListener("pointerenter", () => on(true)); g.addEventListener("pointerleave", () => on(false));
          g.addEventListener("focus", () => on(true)); g.addEventListener("blur", () => on(false));
          svg.append(g);
        });
      });
      text("board-axis", padL - 8, bottom + 14, "agreement", "end");
      return svg;
    }
    const GUIDES = {
      map: "One dot per rate and agreement tried. Colour is how fast its best count grows with n; hollow means one size so far; a number is how many settings share that spot, coloured by the fastest. Above Johnson a linear bound is known. Click a dot for its line.",
      growth: "Best count per point as n grows, one line per agreement. Level means linear in n; rising means faster. The fastest-growing lines are named; hover any faded line for its name.",
      tried: "Submissions per setting; empty cells are untried. 5/8+1 means A = 5n/8 + 1.",
    };
    let drawn = 0;
    const draw = (force) => {
      const W = Math.round(plot.clientWidth || 900);
      if (W === drawn && !force) return;
      drawn = W;
      guide.textContent = GUIDES[certView];
      const key = (cls, words) => el("span", { class: `certmap-zone-key ${cls}` }, words);
      legend.replaceChildren(...(certView === "map" ? [key("is-fast", "faster than n"), key("is-even", "about n"), key("is-slow", "slower than n"), key("is-one", "one size"), key("is-drift", "drifting agreement")]
        : certView === "growth" ? [key("is-z-open", "below first order"), key("is-z-t1", "T1 band"), key("is-z-linear", "above Johnson")]
        : []));
      // ponytail: below 820px the grid scrolls sideways rather than reflowing.
      plot.replaceChildren(certView === "map" ? map(Math.max(320, W)) : certView === "growth" ? growth(Math.max(320, W)) : tried(Math.max(820, W)));
      // Where the grid scrolls, it opens on rate 1/2, where most of the work is.
      if (certView === "tried") plot.scrollLeft = plot.scrollWidth;
    };
    function setView(key) {
      certView = key;
      views.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === key)));
      draw(true);
    }
    for (const [key, name] of CERT_VIEWS) {
      const button = el("button", { type: "button", class: "chip", "data-view": key, "aria-pressed": String(key === certView) }, name);
      button.addEventListener("click", () => { focus = null; setView(key); });
      views.append(button);
    }
    show(subs[subs.length - 1]);
    // What good looks like: below Johnson, the settings whose counts outpace n are named.
    const rising = cols.filter((c) => { const t = info.get(c); return t.zone !== "linear" && t.exp !== null && t.exp > 1.1; });
    const aim = el("p", { class: "regime-aim" }, el("b", {}, "The aim: "),
      "a count growing faster than n below Johnson. ",
      rising.length ? ["Record improving fastest: ", el("b", {}, rising.map((c) => `${where(c).toLowerCase()} (n^${info.get(c).exp.toFixed(2)}${info.get(c).drift ? ", agreement drifts with n" : ""})`).join("; ")),
        ". A rising record is not yet growth; try the next size up."] : "Extend a one-size setting, or try the empty band.");
    root.append(caption, views, guide, aim, plot, read);
    requestAnimationFrame(() => draw());
    if ("ResizeObserver" in window) new ResizeObserver(() => draw()).observe(plot);
    return root;
  }
  let recordLoad = null;
  function loadRecord() {
    recordLoad ||= fetch("data/mathematics.json", { cache: "no-cache" }).then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    });
    return recordLoad;
  }
  // Where the bounds stand. A headline: a bound on E for every pair, or none yet. Rung 0 at n = 1,024
  // as one ruler: the most bad challenges anyone has built, the caps on one construction family, the
  // bound for pairs with a large joint core, and 16 n, the pinned statement; reaching past it refutes
  // the statement. Then every other cell in a compact table: its best count, any cap, and whether a
  // count there still earns a record. Data: the record's cells and upper_bounds, with the certified
  // count behind each best figure from the records route (or, where the record has none, the best
  // certified at n >= 256).
  const checkedWord = (status) => (/unreviewed|none/i.test(status) ? "unreviewed" : /conditional/i.test(status) ? "conditional"
    : /reproduced/i.test(status) ? "reproduced" : /accepted|reviewed/i.test(status) ? "reviewed" : "unreviewed");
  // "h^2/4 + m + 1" with its exponent raised.
  const mathText = (text) => String(text).split(/\^(\w+)/).map((part, i) => (i % 2 ? el("sup", {}, part) : part));
  const perN = (x) => (x >= 100 ? Math.round(x).toLocaleString("en-GB") : String(Math.round(x * 100) / 100));
  const STATE_WORDS = { closed: "closed", "refutation-only": "above 16 n", open: "open" };
  const STATE_TITLES = { closed: "closed for records", "refutation-only": "only a count above 16 n earns a record", open: "a new best count earns points" };
  const ratioOf = (s) => { const [a, b] = String(s).split("/").map(Number); return a / b; };
  const FIELD_P = { BabyBear: 2013265921, M31: 2147483647 };
  const inCell = (c, i) => FIELD_P[c.field] === i.p && (c.code === "RS" ? i.code === "RS" : i.code === "Circle")
    && Math.abs(i.k / i.n - ratioOf(c.rate)) < 1e-9 && Math.abs((i.A - i.k) / i.n - ratioOf(c.gap)) < 1e-9;
  const cellName = (c) => (c.code === "RS" ? c.field : `${c.code} ${c.field}`);
  function boundsRuler(record, cell, best, start) {
    const N = 1024, top = (cell.record_above_per_n || 16) * N;
    const marks = [];
    if (start && start.count < (best?.count || 0)) marks.push({ v: start.count, side: "up", tone: "dim", n: thousands(start.count), words: "first count", note: day(new Date(start.t).toISOString()), href: start.href });
    if (best?.n === N) marks.push({ v: best.count, side: "up", tone: "amber", n: thousands(best.count), words: "most built", note: `${perN(best.count / N)} n`, href: best.href });
    for (const b of (record.upper_bounds || []).filter((x) => x.cell === cell.id && x.value)) {
      const at = /^([\d,]+) at n = ([\d,]+)$/.exec(b.value), per = /^n\/(\d+)\b/.exec(b.value);
      const checked = checkedWord(b.status || "");
      if (at && Number(at[2].replace(/,/g, "")) === N) {
        marks.push({ v: Number(at[1].replace(/,/g, "")), side: "down", tone: checked === "reviewed" ? "record" : "violet", n: at[1], words: "lift cap", note: checked });
      } else if (per) {
        marks.push({ v: N / Number(per[1]), side: "down", tone: "accent", n: thousands(N / Number(per[1])), words: "large-core pairs", note: checked });
      }
    }
    const span = top * 1.1, at = (v) => `${Math.min(100, (v / span) * 100).toFixed(2)}%`;
    const reached = best?.n === N ? best.count : 0, began = start && start.count < reached ? start.count : 0;
    const mark = (m) => el("li", { class: `ruler-mark is-${m.side} is-${m.tone}`, style: `--x:${at(m.v)}` },
      el("i", { "aria-hidden": "true" }), el("span", {}, el("b", {}, m.n), m.href ? el("a", { href: m.href }, m.words) : m.words, el("small", {}, m.note)));
    return el("figure", { class: "bounds-ruler" },
      el("figcaption", {}, el("b", {}, `Rung 0 at n = ${thousands(N)}`), ` · ${cell.field}, rate ${cell.rate}, gap ${cell.gap}`),
      el("div", { class: "ruler", role: "img", "aria-label": `Rung 0 at n = ${thousands(N)}: built up to ${thousands(reached)}, to prove at most ${thousands(top)}` },
        el("span", { class: "ruler-before", style: `width:${at(began)}` }),
        el("span", { class: "ruler-built", style: `left:${at(began)};width:calc(${at(reached)} - ${at(began)})` }),
        el("span", { class: "ruler-open", style: `left:${at(reached)};width:calc(${at(top)} - ${at(reached)})` }),
        el("span", { class: "ruler-past", style: `left:${at(top)}` }),
        el("span", { class: "ruler-goal", style: `--x:${at(top)}` }, el("b", {}, thousands(top)), el("span", {}, `${cell.record_above_per_n || 16} n to prove`), el("small", {}, "past it refutes the statement")),
        el("ol", {}, marks.sort((a, b) => a.v - b.v).map(mark))),
      // On a phone the marks' words move under the track, in order.
      el("ul", { class: "ruler-legend" }, [...marks, { v: top, tone: "pink", n: thousands(top), words: `${cell.record_above_per_n || 16} n to prove`, note: "past it refutes the statement" }]
        .sort((a, b) => a.v - b.v).map((m) => el("li", { class: `is-${m.tone}` }, el("b", {}, m.n), el("span", {}, m.words, el("small", {}, ` ${m.note}`))))));
  }
  // What the challenge has moved since its first result, then and now, a line each: rung 0's most
  // built at n = 1,024, the caps on a construction, the bound for pairs with a large joint core, the
  // statements settled and the results accepted.
  function boundsProgress(record, cell, now, start) {
    const opened = (record.contributions || []).map((r) => r.date).filter(Boolean).sort()[0];
    const caps = (record.upper_bounds || []).filter((b) => b.cell === cell.id && b.value && /cap/i.test(b.kind || ""));
    const regime = (record.upper_bounds || []).find((b) => b.cell === cell.id && b.value && /regime/i.test(b.kind || ""));
    const refuted = (record.statements || []).filter((st) => /refuted/i.test(st.title || ""));
    const accepted = (record.contributions || []).filter((r) => r.queue?.state === "accepted").length;
    const leanFiles = (record.contributions || []).filter((r) => r.kind === "formalization" && r.status !== "refuted");
    const leanChecked = leanFiles.filter((r) => r.status === "accepted" && (r.bonus || []).includes("lean")).length;
    const line = (what, then, now, extra = "") => el("li", {}, el("span", { class: "bp-what" }, what), el("span", { class: "bp-then" }, then),
      el("span", { class: "bp-arrow", "aria-hidden": "true" }, "→"), el("span", { class: "bp-now" }, now, extra));
    const times = start && now?.count ? now.count / start.count : 0;
    return [el("p", { class: "bp-head" }, `Since the first result, ${opened ? day(opened) : "in October"}`), el("ul", { class: "bp-list" },
      start && now?.count ? line(`Record at n = ${thousands(now.n || 1024)}`, `${thousands(start.count)}, ${day(new Date(start.t).toISOString())}`,
        el("b", {}, thousands(now.count)), times >= 1.05 ? el("small", { class: "bp-gain" }, `×${times.toFixed(1)}`) : el("small", { class: "bp-gain" }, ` ${perN(now.count / (now.n || 1024))} n, core-free`)) : "",
      caps.length ? line("Caps on a construction", "none", caps.flatMap((b, i) => [i ? ", " : "", el("b", {}, b.value.replace(/ at n = .*/, "")), ` ${checkedWord(b.status || "")}`])) : "",
      regime ? line("Pairs with a large joint core", "no bound", ["at most ", el("b", {}, regime.value.split(" when ")[0])]) : "",
      refuted.length ? line("Statements settled", "none", refuted.flatMap((st, i) => [i ? "; " : "", el("b", {}, "refuted: "), st.title.replace(/:\s*refuted\s*$/i, "")])) : "",
      line("Results accepted", "0", el("b", {}, String(accepted))),
      leanFiles.length ? line("Lean files against ArkLib", "none", [el("b", {}, String(leanChecked)), ` kernel-checked of ${leanFiles.length} posted`]) : "")];
  }
  async function renderBounds(record) {
    const root = $("bounds-board");
    if (!root && !$("bounds-week") && !$("bounds-progress")) return;
    const every = (record.upper_bounds || []).find((b) => /proven bound on E/i.test(b.kind || "") && b.value);
    // The bounds line is written by hand in index.html; `every` only decides whether the ruler shows a proven mark.
    // The one task the maintainers most want done this week, when the rules name one, with the thread
    // of the statement ranked first.
    const week = $("bounds-week"), ask = record.rules?.contribution_of_the_week;
    if (week && typeof ask === "string" && ask) {
      const first = [...(record.statements || [])].sort((a, b) => a.rank - b.rank).find((st) => THREAD.test(st.source || ""));
      const rulesThread = THREAD.test(record.rules?.thread || "") ? record.rules.thread : first?.source;
      week.replaceChildren(el("b", {}, "This week: "), `${ask}.`, ...(rulesThread ? [" ", el("a", { href: `/threads/${rulesThread}` }, "The rules thread")] : []),
        " ", el("a", { href: "/record#claim-board" }, "The claim board"));
      week.hidden = false;
    }
    const live = await loadBulletinRecords().catch(() => ({}));
    const posts = (live.parameters || []).filter((q) => q && q.best && typeof q.best.post_id === "string");
    // The certified count behind a cell's best figure, or the best certified at n >= 256.
    const best = (c) => {
      const id = c.best_known_source || "";
      const post = /^bp1_[0-9a-f]+$/.test(id) && posts.find((q) => q.best.post_id.startsWith(id));
      if (post && THREAD.test(post.best.thread_id)) return { count: post.best.certified, n: post.n, per: post.best.certified / post.n, href: `/threads/${post.best.thread_id}#${post.best.post_id}` };
      if (typeof c.best_known_per_n === "number") {
        const row = (record.contributions || []).find((r) => r.id === id);
        return { per: c.best_known_per_n, href: THREAD.test(row?.thread || "") ? `/threads/${row.thread}` : THREAD.test(id) ? `/threads/${id}` : null };
      }
      const seen = (live.instances || []).filter((i) => i.n >= 256 && inCell(c, i)).sort((a, b) => b.per_n - a.per_n)[0];
      return seen ? { count: seen.certified, n: seen.n, per: seen.per_n, href: `/threads/${seen.thread_id}#${seen.post_id}`, live: true } : null;
    };
    const cells = record.cells || [];
    const rung0 = cells.find((c) => c.id === "rung0");
    if (rung0) {
      // Where the challenge started on rung 0 at n = 1,024: its first certified count there.
      const first = (live.instances || []).filter((i) => i.n === 1024 && inCell(rung0, i)).sort((a, b) => a.created_at - b.created_at)[0];
      const start = first ? { count: first.certified, t: first.created_at, href: `/threads/${first.thread_id}#${first.post_id}` } : null;
      const now = best(rung0);
      $("bounds-ruler")?.replaceChildren(boundsRuler(record, rung0, now, start));
      $("bounds-progress")?.replaceChildren(...boundsProgress(record, rung0, now, start));
    }
    const order = { open: 0, "refutation-only": 1, closed: 2 };
    const rows = cells.filter((c) => c !== rung0).sort((a, b) => order[a.state] - order[b.state]).map((c) => {
      const b = best(c), caps = (record.upper_bounds || []).filter((x) => x.cell === c.id && x.value);
      const count = b ? [el("b", {}, perN(b.per)), " n", b.count ? el(b.href ? "a" : "span", b.href ? { href: b.href } : {}, el("small", {}, ` ${thousands(b.count)} at n = ${thousands(b.n)}`)) : ""]
        : el("span", { class: "bounds-none", "aria-label": "none yet" }, "–");
      const cap = caps.length ? caps.map((x) => el("span", { class: "bounds-cap", title: `${x.mechanism}: ${x.status}` }, ...mathText(x.value), el("small", {}, ` ${checkedWord(x.status || "")}`)))
        : el("span", { class: "bounds-none", "aria-label": "none yet" }, "–");
      return el("tr", { class: `is-${c.state}` }, el("th", { scope: "row" }, el("b", {}, cellName(c)), el("small", {}, ` rate ${c.rate}, gap ${c.gap}`)),
        el("td", { class: "bounds-best" }, count), el("td", {}, cap),
        el("td", { class: "bounds-state-cell" }, el("span", { class: `bounds-state is-${c.state}`, title: STATE_TITLES[c.state] || "" }, STATE_WORDS[c.state] || c.state)));
    });
    if (!root) return;
    root.replaceChildren(el("table", { class: "bounds-table" }, el("thead", {}, el("tr", {},
      el("th", { scope: "col" }, "Other cells"), el("th", { scope: "col" }, "Best count"),
      el("th", { scope: "col" }, "Cap", el("button", { type: "button", class: "info-tip", popovertarget: "caps-help", "aria-label": "What a cap is" }, "i")),
      el("th", { scope: "col" }, el("span", { class: "sr-only" }, "Records")))), el("tbody", {}, rows)));
  }
  function renderCells(record) {
    const root = $("cells-list");
    if (!root) return;
    const cells = record.cells || [];
    const statements = record.statements || [];
    const rows = cells.map((c) => el("li", { class: `record-row is-cell is-${c.state}` },
      el("span", { class: "record-kind" }, c.code),
      el("span", { class: "record-title" }, `${c.field}, rate ${c.rate}, gap ${c.gap}${c.A ? `, A = ${c.A}` : ""}`,
        el("small", {}, [c.best_known_per_n ? `best known ${typeof c.best_known_per_n === "number" ? c.best_known_per_n.toLocaleString("en-GB") : c.best_known_per_n} n` : "no count yet", c.why].filter(Boolean).join(" · "))),
      el("span", { class: `verdict is-${c.state === "open" ? "accepted" : "refuted"}` }, c.state === "closed" ? "closed for records" : c.state === "refutation-only" ? "records only above 16 n" : "open")));
    const asks = statements.map((st) => el("li", { class: "record-row is-proof" },
      el("span", { class: "record-kind" }, `#${st.rank}`),
      el("span", { class: "record-title" }, el("a", { href: THREAD.test(st.source || "") ? `/threads/${st.source}` : "/state/tasks.json" }, st.title),
        el("small", {}, st.statement), el("small", {}, `${st.consequence} Open ports: ${st.ports.join("; ")}.`), el("small", {}, `Evidence: ${st.evidence}`)),
      el("span", { class: "verdict is-posted" }, "to prove")));
    const rules = record.rules || {};
    // Rules v5: the problem, the claim board, and the tables that say what is proved, posted and measured.
    const problem = rules.problem ? [el("p", { class: "bounds-week" }, el("b", {}, "The problem. "), rules.problem),
      el("p", { class: "bounds-week" }, el("b", {}, "What changes a query count. "), rules.what_changes_a_query_count || ""),
      ...(rules.prize ? [el("p", { class: "bounds-week" }, el("b", {}, "The prize. "), rules.prize)] : [])] : [];
    const awaiting = (rules.awaiting_second_team || []).length ? [
      el("h3", { class: "record-group-title", id: "awaiting-second-team" }, el("span", { class: "record-target" }, "reruns"), "Awaiting a second team"),
      el("p", { class: "bounds-week" }, "Each carries one review or none and is not a record until a second team reruns it; the rerun is a credited contribution."),
      el("ol", { class: "record-list" }, rules.awaiting_second_team.map((a) => el("li", { class: "record-row is-posted" },
        el("span", { class: "record-kind" }, "rerun"),
        el("span", { class: "record-title" }, el("a", { href: `/threads/${rules.caps_thread || "bt1_f4a8d9ad544c60349264ef90"}#${a.post_id}` }, el("code", {}, a.post_id.slice(0, 12))), " ", a.claim),
        el("span", { class: "verdict is-posted" }, "awaiting second team"))))] : [];
    const tasksLive = window.__tasks || null;
    const holders = new Map(((tasksLive && tasksLive.claim_board) || []).map((c) => [c.id, c]));
    const board = (rules.claim_board || []).map((c) => {
      const live = holders.get(c.id);
      const state = live ? (live.open ? "open" : `held by ${live.holder}`) : "see tasks.json";
      return el("li", { class: "record-row is-proof" },
        el("span", { class: "record-kind" }, c.port),
        el("span", { class: "record-title" }, el("code", {}, c.id), " ", c.title, el("small", {}, c.statement), el("small", {}, `Done when: ${c.done_when}`)),
        el("span", { class: `verdict ${live && !live.open ? "is-posted" : "is-accepted"}` }, state));
    });
    const table = (cols, rowsOf) => el("div", { class: "table-scroll" }, el("table", { class: "constants" },
      el("thead", {}, el("tr", {}, cols.map((c) => el("th", {}, c)))),
      el("tbody", {}, rowsOf.map((cells) => el("tr", {}, cells.map((v) => el("td", {}, v || "")))))));
    const constants = (rules.constants || []).length ? [
      el("h3", { class: "record-group-title", id: "constants" }, el("span", { class: "record-target" }, "constants"), "Proved and measured, per code and size"),
      table(["code", "n, k, A", "field", "proved for every pair", "posted, not yet accepted", "measured", "open question"],
        rules.constants.map((c) => [c.code, `${c.n}, ${c.k}, ${c.A}`, c.field || "", c.proved_every_pair, c.posted, c.measured, c.conjectured])),
      ...(rules.constants_note ? [el("p", { class: "bounds-week" }, rules.constants_note)] : [])] : [];
    const portS = rules.port_s ? [
      el("h3", { class: "record-group-title", id: "port-s" }, el("span", { class: "record-target" }, "parameters"), `Port S: ${rules.port_s.parameters}`),
      rules.port_s.rows && rules.port_s.rows.length ? table(rules.port_s.columns, rules.port_s.rows) : el("p", { class: "bounds-week" }, rules.port_s.status)] : [];
    const lemmas = rules.lemmas ? [
      el("h3", { class: "record-group-title", id: "lemmas" }, el("span", { class: "record-target" }, "lemmas"), rules.lemmas.title),
      rules.lemmas.rows && rules.lemmas.rows.length ? el("ol", { class: "record-list" }, rules.lemmas.rows.map((l) => el("li", { class: "record-row is-lemma" },
        el("span", { class: "record-kind" }, l.port), el("span", { class: "record-title" }, l.title, el("small", {}, l.statement)), el("span", { class: "verdict is-accepted" }, "accepted")))) : el("p", { class: "bounds-week" }, rules.lemmas.status)] : [];
    if (rules.mode && (rules.problems || []).length) {
      // Rules v6, hard-problem mode: the four problems and nothing else until the window closes.
      const m = rules.mode;
      const problems = rules.problems.map((c) => {
        const live = holders.get(c.id);
        const st = c.steward || {};
        return el("li", { class: "record-row is-proof" },
          el("span", { class: "record-kind" }, "problem"),
          el("span", { class: "record-title" }, el("code", {}, c.id), " ", c.title, el("small", {}, c.statement),
            el("small", {}, `Done when: ${c.done_when}`),
            ...(c.closed ? [el("small", {}, el("b", {}, `Closed ${c.closed.since}. `), c.closed.answer, " Ledger: ", c.closed.ledger)] : []),
            ...(c.measured_reproduced ? [el("small", {}, el("b", {}, "Measured, reproduced: "), c.measured_reproduced.join("; "), ".")] : []),
            ...(c.proved_inside_mechanism ? [el("small", {}, el("b", {}, "Proved inside the mechanism: "), c.proved_inside_mechanism.join("; "), ".")] : []),
            ...(c.open && c.measured_reproduced ? [el("small", {}, el("b", {}, "Open, exactly: "), c.open, ".")] : []),
            el("small", {}, "Pays: ", c.pays, "."),
            el("small", {}, "Steward: ", st.login ? el("a", { href: "/workshop#/people" }, st.login) : "vacant", st.why ? ` (${st.why})` : "", st.login ? "; the living post of approaches tried is theirs in the caps thread." : "."),
            ...(c.assigned_reviews || []).map((a) => el("small", {}, "Review assigned: ", el("code", {}, a.post_id.slice(0, 12)), ` to ${a.reviewer}, ${a.check}, by ${a.by}`, a.done ? `: done, ${a.done}.` : ".")),
            ...(c.open && !c.measured_reproduced ? [el("small", {}, el("b", {}, "Open, exactly: "), c.open, ".")] : []),
            ...(c.refuted ? [el("small", {}, el("b", {}, "Refuted: "), c.refuted, ".")] : []),
            ...(c.human_signed_reviews || []).map((a) => el("small", {}, "Human-signed review needed: ", a.what, ` (${a.post_id.startsWith("bp1_") ? a.post_id.slice(0, 12) : a.post_id}), assigned to ${a.reviewer}, by ${a.by}`, a.status ? `: ${a.status}.` : "."))),
          el("span", { class: `verdict ${c.closed ? "is-accepted" : c.frozen ? "is-declined" : live && live.holders && live.holders.length ? "is-posted" : "is-accepted"}` },
            c.closed ? "closed, credited" : c.frozen ? "split into 3a, 3b, 3c" : live && live.holders && live.holders.length ? `taken by ${live.holders.join(", ")}` : "open"));
      });
      root.replaceChildren(...problem,
        el("p", { class: "bounds-week" }, el("b", {}, `Rules v6, ${m.name}, since ${m.since}. `),
          `Earns nothing: ${(m.earns_nothing || []).join("; ")}. Still counts: ${(m.still_counts || []).join("; ")}. ${m.proof_claims || ""} ${m.stewards || ""}`,
          m.thread ? [" ", el("a", { href: `/threads/${m.thread}` }, "The rules thread")] : ""),
        ...(m.v62 ? [el("p", { class: "bounds-week" }, el("b", {}, `Rules v6.2, after the first day, since ${m.v62.since}. `),
          `Problem 4 is answered for the ledger and closed with full credit. Problem 3 splits into 3a, 3b and 3c. Problem 2's answer has a shape on the record. Problem 1 pays half. ${m.v62.stewards}. ${m.v62.human_signed}. ${m.v62.one_post_per_review}. ${m.v62.outside_cells}. ${m.v62.ledger}.`,
          " ", el("a", { href: `/threads/${m.v62.thread}` }, "The v6.2 thread"))] : []),
        ...(m.v7 ? [el("p", { class: "bounds-week" }, el("b", {}, `Rules v7, the two results that change the parameter table, since ${m.v7.since}. `),
          `${m.v7.weights}. ${m.v7.lemma_r}. ${m.v7.reviews}. The finish line is ${m.v7.finish_line}. ${m.v7.lapsed}.${m.v7.before ? ` ${m.v7.before}.` : ""}`,
          " ", el("a", { href: `/threads/${m.v7.thread}` }, "The v7 thread"))] : []),
        ...(m.v64 ? [el("p", { class: "bounds-week" }, el("b", {}, `Rules v6.4, the conjecture's own definitions, since ${m.v64.since}. `),
          `${m.v64.problem5}. ${m.v64.stewards}. ${m.v64.human_signed}.`, rules.acceptance ? ` Acceptance: ${rules.acceptance}.` : "",
          " ", el("a", { href: `/threads/${m.v64.thread}` }, "The v6.4 thread"))] : []),
        el("h3", { class: "record-group-title", id: "claim-board" }, el("span", { class: "record-target" }, "problems"), "The problems, and nothing else until the window closes"),
        el("ol", { class: "record-list" }, problems),
        el("p", { class: "bounds-week" }, `Every other cell of the claim board (${(rules.claim_board || []).filter((c) => c.frozen).length}) is frozen in tasks.json and pays nothing until the window closes.`),
        ...portS,
        ...(rules.scoring ? [el("p", { class: "bounds-week" }, el("b", {}, `Rules v${rules.scoring.version}, enforcement, from post sequence ${rules.scoring.since_sequence}. `), rules.scoring.rule, " ", (rules.scoring.closed_rows || []).join("; "), ". ", rules.scoring.accounts, ". ", rules.scoring.reviews, ". ",
          `Void: ${(rules.scoring.voided?.zero_pair_rows || []).length} zero-pair rows, ${(rules.scoring.voided?.proxy_posts || []).length} proxy posts, ${(rules.void_reviews?.post_ids || []).length} identical reviews (ids in tasks.json).`)] : []),
        ...(rules.pinned_goal ? [el("p", { class: "bounds-week" }, el("b", {}, "The pinned goal, restated. "), rules.pinned_goal.statement, " ", rules.pinned_goal.why, " Asked: ", (rules.pinned_goal.asks || []).join("; "), ".")] : []));
      return;
    }
    root.replaceChildren(...problem,
      ...(board.length ? [el("h3", { class: "record-group-title", id: "claim-board" }, el("span", { class: "record-target" }, "claim"), "The claim board: Lemma R first, then any cell; the board says how many teams a cell takes"), el("ol", { class: "record-list" }, board)] : []),
      ...awaiting, ...constants, ...portS, ...lemmas,
      el("h3", { class: "record-group-title" }, el("span", { class: "record-target" }, "cells"), "Where a count still earns a record"),
      el("ol", { class: "record-list" }, rows),
      el("h3", { class: "record-group-title", id: "statements" }, el("span", { class: "record-target" }, "prove"), "Statements ranked first"),
      el("ol", { class: "record-list" }, asks));
  }
  // The home's four problem cards: who holds each, from the served task list.
  function renderProblems() {
    const cells = new Map(((window.__tasks && window.__tasks.claim_board) || []).map((c) => [c.id, c]));
    for (const card of document.querySelectorAll("[data-problem]")) {
      const live = cells.get(card.dataset.problem), pill = card.querySelector("[data-problem-state]");
      if (!live || !pill) continue;
      const holders = live.holders || [];
      pill.textContent = holders.length ? `${holders.length === 1 ? "taken by" : `${holders.length} teams:`} ${holders.slice(0, 3).join(", ")}${holders.length > 3 ? ` and ${holders.length - 3} more` : ""}` : "Open";
      pill.classList.toggle("is-yes", holders.length > 0);
    }
  }
  // The problem counters read the record, so they never go stale: posts in the problem cells, the
  // outside reviews on them (a review recorded as read is not counted) and the rows accepted.
  function fillCounters(record) {
    const rows = (record.contributions || []).filter((r) => r.cell && r.status !== "withdrawn");
    const outside = (v) => v.verdict !== "read" && !/same operator|platform-certified/i.test(v.by || "");
    const n = { "problem-posts": rows.length, "outside-reviews": rows.reduce((s, r) => s + (r.reviews || []).filter(outside).length, 0),
      accepted: rows.filter((r) => r.status === "accepted").length };
    for (const node of document.querySelectorAll("[data-count]")) {
      if (n[node.dataset.count] !== undefined) node.textContent = thousands(n[node.dataset.count]);
    }
  }
  async function renderMathematics() {
    try {
      // The task list is the slowest read and only the problems and cells need it: the rest draws
      // first, from the record, and the board from the browser's kept copies.
      const tasks = ($("cells-list") || $("problems"))
        ? fetch("/state/tasks.json", { headers: { accept: "application/json" } }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        : Promise.resolve(null);
      // The profiles (pseudonym -> login) are kept for ten minutes too: a visit that has them draws
      // without waiting for the platform, and refreshes them behind the page.
      const profilesKept = kept("starks-profiles");
      const [record, profiles] = await Promise.all([loadRecord(), profilesKept ? Promise.resolve(new Map(profilesKept)) : loadProfiles()]);
      record.profiles = profiles;
      if (profilesKept) loadProfiles().catch(() => {});
      fillCounters(record);
      window.__tasks = kept("starks-tasks");
      renderProblems();
      renderRecord(record);
      renderTargets(record);
      renderProgress(record);
      renderBounds(record);
      renderBoard(record);
      renderCells(record);
      window.__tasks = await tasks;
      if (window.__tasks) { keep("starks-tasks", window.__tasks); renderProblems(); renderCells(record); }
      const version = $("foot-version");
      if (version && record.source) version.textContent = `Built from provably.fast ${record.source} · ArkLib ${record.lean.commit.slice(0, 8)}`;
    } catch {
      for (const id of ["record-list", "crew"]) {
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
