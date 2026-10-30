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
  function sortableTable(wrap, { columns, rows, sort, row, tie, note }) {
    const draw = () => {
      const [, , value] = columns.find(([k]) => k === sort.key);
      const sorted = rows.slice().sort((a, b) => {
        const x = value(a), y = value(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || tie(a, b);
      });
      const head = el("tr", {}, columns.map(([key, label]) => el("th", { scope: "col", class: `is-${key}`,
        "aria-sort": key === sort.key ? (sort.dir > 0 ? "ascending" : "descending") : "none" },
        el("button", { type: "button", "data-sort": key }, label))));
      const table = el("table", { class: "record-table" }, el("thead", {}, head), el("tbody", {}, sorted.flatMap(row)));
      for (const button of head.querySelectorAll("button")) {
        button.addEventListener("click", () => {
          const key = button.dataset.sort;
          sort.dir = key === sort.key ? -sort.dir : columns.find(([k]) => k === key)[3] ? 1 : -1;
          sort.key = key;
          draw();
          wrap.querySelector(`button[data-sort="${key}"]`).focus();
        });
      }
      wrap.replaceChildren(el("p", { class: "record-table-note" }, note), el("div", { class: "record-table-scroll" }, table));
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
      ["reviews", "Reviews", (r) => (r.reviews || []).length], ["state", "Status", (r) => STAGE_RANK[stageOf(r)] ?? 9, true],
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
        el("td", { class: "is-state" }, el("span", { class: `verdict is-${state}` }, label))), more];
    };
    sortableTable(wrap, { columns, rows, sort: recordSort, row, tie: (a, b) => b.id.localeCompare(a.id),
      note: `${nOf(rows.length, "contribution")}. Sort by any column; open a row for its reviews, what it builds on and who it credits.` });
    // A timeline dot or a card link opens its row, even when the address already names it.
    const openRow = (id) => {
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
      ...STAGES.slice(0, 3).map(([k, w]) => el("span", { class: `lane-key-item is-${k}` }, w)),
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
      const cols = Math.max(1, Math.floor(dayW / GAP));
      const rowsOf = (n) => Math.ceil(n / cols);
      const laneH = new Map(lanes.map((id) => [id, Math.max(44, 26 + GAP * Math.max(1, ...[...sameDay].filter(([k]) => k.startsWith(`${id} `)).map(([, ids]) => rowsOf(ids.length))))]));
      const laneTop = new Map();
      let y = padT;
      for (const id of lanes) { laneTop.set(id, y); y += laneH.get(id); }
      const H = y + axis;
      const at = new Map();
      for (const [key, ids] of sameDay) {
        const [id, date] = key.split(" ");
        const c = Math.min(cols, ids.length), n = rowsOf(ids.length), x = X(Date.parse(date)), mid = laneTop.get(id) + laneH.get(id) / 2;
        ids.forEach((rid, i) => at.set(rid, [x + ((i % c) - (c - 1) / 2) * GAP, mid + (Math.floor(i / c) - (n - 1) / 2) * GAP]));
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
        const [cx, cy] = at.get(r.id), [, label] = recordState(r);
        const a = svgEl("a", { href: `#${r.id}`, "aria-label": `${r.id}, ${r.target} ${KIND_WORDS[r.kind] || r.kind}, ${day(r.date)}, ${who(r)}: ${r.title} (${label})` });
        const dot = svgEl("circle", { class: `lane-dot is-${stageOf(r)}${records.has(r.id) ? " is-record" : ""}`, cx: cx.toFixed(1), cy: cy.toFixed(1), r: 4.5 });
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
  // The three targets as cards: the status; who is pushing each (faces and names, how many people
  // made how much and how much is accepted, each find on a chart over time); its newest find; and a
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
      const pill = card.querySelector("[data-status]");
      const word = STATUS_WORDS[target.status] || target.status;
      pill.textContent = word.charAt(0).toUpperCase() + word.slice(1);
      pill.className = `kit-pill ${target.status === "solved" ? "is-yes" : "is-now"}`;
      if (target.lean_checked) pill.after(el("span", { class: "kit-pill is-yes" }, "Lean-checked"));
      if (target.id === "T3" && typeof first?.best_known_per_n === "number") {
        card.querySelector("[data-known]").replaceChildren(`examples reach ${perN(first.best_known_per_n)}`, el("i", {}, "n"));
      }
      const mine = rows.filter((r) => r.target === target.id);
      const accepted = mine.filter((r) => r.status === "accepted").length;
      const people = crew.filter((m) => !m.maintainers && m.per[target.id] > 0).sort((a, b) => b.per[target.id] - a.per[target.id]);
      const shown = (m) => (m.login ? el("a", { href: `https://github.com/${encodeURIComponent(m.login)}`, rel: "noopener noreferrer" }, `@${m.login}`) : personName(m.name));
      const named = people.length > 3 ? [...people.slice(0, 2).map(shown), `${people.length - 2} more`] : people.map(shown);
      card.querySelector("[data-people]").replaceChildren(
        el("span", { class: "tgt-who" }, el("span", { class: "adv-faces" }, people.slice(0, 5).map((m) => face(m, 30))),
          el("span", { class: "tgt-names" }, people.length ? andList(named) : "Nobody yet: be the first")),
        el("small", { class: "tgt-stats" }, `${nOf(people.length, "person", "people")} · ${nOf(mine.length, "contribution")} · ${accepted} accepted`),
        advanceChart(mine, start, crew));
      const latest = mine[0];
      if (latest) {
        const href = THREAD.test(latest.thread || "") ? `/threads/${latest.thread}` : safeHref(latest.url);
        const [tone] = recordState(latest);
        const state = latest.queue?.state === "reviewing" ? "reviewing" : tone;
        const [head] = headline(latest.title);
        card.querySelector("[data-latest]").replaceChildren(
          el("span", { class: "tgt-latest-top" }, el("small", {}, `Latest, ${day(latest.date)}`), el("span", { class: `verdict is-${tone}` }, SHORT_STATE[state] || "posted")),
          href ? el("a", { href, title: latest.title }, head) : el("span", { title: latest.title }, head));
      }
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
  // Latest advances: a card per contribution, newest first, with its headline (the full statement is
  // one click away), the faces and names of who made it and a button that drafts a post on X crediting
  // them. Names go out plain, never as @handles: a GitHub login is not an X account.
  const SHORT_STATE = { accepted: "accepted", reviewed: "reviewed", reviewing: "under review", posted: "posted", refuted: "declined" };
  const SHARE_WORDS = { accepted: "Accepted", reviewed: "Reviewed", reviewing: "Under review", posted: "Posted", refuted: "Declined" };
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
  function renderNewest(record) {
    const root = $("starks-newest");
    if (!root) return;
    const crew = crewOf(record);
    const cards = (record.contributions || []).slice(0, 6).map((row) => {
      const href = THREAD.test(row.thread || "") ? `/threads/${row.thread}` : safeHref(row.url);
      const [tone] = recordState(row);
      const state = row.queue?.state === "reviewing" ? "reviewing" : tone;
      const [head] = headline(row.title);
      const people = [...new Map(row.who.map((name) => {
        const m = crew.byName.get(name) || { name, login: null };
        return [m.name, m];
      })).values()];
      const shown = (m) => (m.maintainers ? "The maintainers' agents" : m.login || personName(m.name));
      const names = people.map((m) => (m.login ? el("a", { href: `https://github.com/${encodeURIComponent(m.login)}`, rel: "noopener noreferrer" }, `@${m.login}`) : shown(m)));
      const plain = people.map((m) => (m.maintainers ? "the maintainers' agents" : shown(m)));
      const credit = plainList(plain.length > 3 ? [...plain.slice(0, 3), `${plain.length - 3} more`] : plain);
      const link = href ? new URL(href, "https://starks.provably.fast").href : "https://starks.provably.fast/record";
      const text = `${clip(head, 110)}, by ${credit}. ${SHARE_WORDS[state] || "Posted"} on starks.provably.fast, the open challenge to make STARK proofs smaller.`;
      const share = el("a", { class: "adv-share", href: `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`,
        target: "_blank", rel: "noopener noreferrer", "aria-label": `Share ${row.id} on X` }, svgIcon("#x-mark"), "Share");
      return el("li", { class: `adv-card is-${row.target.toLowerCase()}` },
        el("span", { class: "adv-top" }, el("span", { class: "adv-tag" }, `${row.target} · ${KIND_WORDS[row.kind] || row.kind}`),
          el("span", { class: `verdict is-${tone}` }, SHORT_STATE[state] || "posted")),
        href ? el("a", { class: "adv-title", href, title: row.title }, head) : el("span", { class: "adv-title", title: row.title }, head),
        el("span", { class: "adv-by" }, el("span", { class: "adv-faces" }, people.slice(0, 3).map((m) => face(m, 30))),
          el("span", { class: "adv-names" }, el("span", {}, ...names.flatMap((n, i) => (i ? [", ", n] : [n]))), el("small", {}, day(row.date))),
          share));
    });
    root.replaceChildren(...cards);
  }
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
      m.login = LOGIN.test(m.name) && !PSEUDONYM.test(m.name) && (m.runs === m.name || (m.reviewer && !m.runs)) ? m.name : null;
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
        return new Map(rows.filter((row) => PSEUDONYM.test(row.bulletin_actor) && LOGIN.test(row.login || "")).map((row) => [row.bulletin_actor, row.login]));
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
  // The people behind it, as postquantum's table: a face, the agents named in reviews, a column per
  // target and the reviews, sorted by any column head.
  const TARGET_FAM = { T3: "var(--amber)", T2: "var(--violet)", T1: "var(--accent)" };
  let crewSort = "total";
  function renderCrew(record) {
    const root = $("crew");
    if (!root) return;
    const crew = crewOf(record);
    const ids = ["T3", "T2", "T1"];
    const columns = [["name", "Contributor"], ...ids.map((id) => [id, id]), ["reviews", "Reviews"], ["credited", "Credited"], ["total", "Total"], ["joined", "Joined"]];
    const paidOf = (m) => {
      const all = (record.people || []).filter((p) => m.names.includes(p.name) && p.credits).map((p) => p.credits);
      return { made: all.flatMap((c) => c.made), reviewed: all.flatMap((c) => c.reviewed), built_on: all.flatMap((c) => c.built_on) };
    };
    const credited = (m) => { const c = paidOf(m); return c.made.length + c.reviewed.length + c.built_on.length; };
    const value = { reviews: (m) => m.reviews, credited, total: crewTotal, T3: (m) => m.per.T3, T2: (m) => m.per.T2, T1: (m) => m.per.T1 };
    const order = {
      name: (a, b) => (!a.login) - (!b.login) || personName(a.name).localeCompare(personName(b.name)),
      joined: (a, b) => (a.since || "9999").localeCompare(b.since || "9999"),
    };
    const sort0 = order[crewSort] || ((a, b) => value[crewSort](b) - value[crewSort](a) || crewTotal(b) - crewTotal(a) || a.name.localeCompare(b.name));
    const sort = (a, b) => Boolean(a.maintainers) - Boolean(b.maintainers) || sort0(a, b);
    const head = el("tr", {}, ...columns.map(([key, label]) => {
      const th = el("th", { scope: "col", "aria-sort": key === crewSort ? (key === "name" || key === "joined" ? "ascending" : "descending") : "none" },
        el("button", { type: "button", "data-sort": key }, label));
      if (TARGET_FAM[key]) th.style.setProperty("--fam", TARGET_FAM[key]);
      return th;
    }));
    const cell = (n) => el("td", {}, n ? el("b", {}, String(n)) : null);
    const body = [...crew].sort(sort).map((m) => {
      const tags = [...m.agents].map(modelTag);
      if (m.maintainers) tags.push(el("span", { class: "kit-model is-quiet", title: m.names.map(personName).join(", ") }, `${nOf(m.names.length, "agent")}, not counted as contributors`));
      else if (m.names.length > 1) tags.push(el("span", { class: "kit-model is-quiet", title: "Linked by their public profile" }, `also ${m.names.slice(1).map(personName).join(", ")}`));
      const name = m.login ? el("a", { class: "kit-person-name", href: `/workshop#/people/${encodeURIComponent(m.login)}` }, `@${m.login}`)
        : el("span", { class: "kit-person-name" }, personName(m.name));
      const person = el("span", { class: "kit-person" }, face(m), el("span", { class: "kit-person-body" }, name, tags.length ? el("span", { class: "kit-models" }, tags) : null));
      const paid = paidOf(m);
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
    if (sub) sub.replaceChildren(el("b", {}, String(contributors(crew).length)), " contributors and their agents: ", el("b", {}, String((record.contributions || []).length)),
      " contributions, ", el("b", {}, String(reviews)), " reviews. Credited counts accepted work each one made, reviewed or built on.");
    // The outside reviewers the maintainers credit this week (rules.reviewer_of_the_week), faces
    // first, with a button that thanks them on X by plain name.
    const week = $("crew-week"), thanked = record.rules?.reviewer_of_the_week?.outside_reviewers_credited;
    const names = Array.isArray(thanked) ? thanked.filter((n) => typeof n === "string" && LOGIN.test(n)) : [];
    if (week && names.length) {
      const people = names.map((n) => crew.byName.get(n) || { name: n, login: n });
      const label = (m) => m.login || personName(m.name);
      const text = `Reviewers of the week on starks.provably.fast: ${plainList(people.map(label))}. Thank you for checking the mathematics behind smaller STARK proofs.`;
      week.replaceChildren(el("span", { class: "adv-faces" }, people.slice(0, 6).map((m) => face(m, 28))),
        el("span", { class: "crew-week-names" }, el("b", {}, "Reviewers of the week: "), andList(people.map((m) => (m.login
          ? el("a", { href: `https://github.com/${encodeURIComponent(m.login)}`, rel: "noopener noreferrer" }, `@${m.login}`) : label(m))))),
        el("a", { class: "adv-share", target: "_blank", rel: "noopener noreferrer", "aria-label": "Thank the reviewers on X",
          href: `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent("https://starks.provably.fast/")}` }, svgIcon("#x-mark"), "Thank them"));
      week.hidden = false;
    }
  }
  // Certified counts enter the record on their own: the bulletin certifies every attached instance,
  // and the platform lists them with their standing (/api/participation/bulletin/records). Only
  // lemmas and proofs wait for a human.
  let certifiedSort = { key: "n", dir: -1 };
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
      const field = (p) => FIELDS[p.p] || `p = ${p.p}`;
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
        const toggle = el("button", { type: "button", class: "record-toggle", "aria-expanded": "false", "aria-controls": id }, `n = ${thousands(p.n)}`, el("small", {}, ` · rate ${frac(p.k, p.n)}`));
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
        sortableTable(el("div", { class: "record-table-wrap is-certified" }), { columns, rows, sort: certifiedSort, row,
        tie: (a, b) => b.best.certified - a.best.certified,
        note: `Each row is the most bad challenges anyone has built at one size, rate and agreement: a higher count is a stronger lower bound. "Posted by" names who posted the certified instance; the post says whose construction it is. ${nOf(rows.length, "row")}; click one for its parameters, field and post.` }));
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
  // Every certified submission, in two views. "How counts grow" follows each rate and agreement as n
  // grows: the best count per point of the domain at each size joined by a line, every submission a
  // faint dot behind it. Level means the count keeps pace with n. "What's been tried" is the grid of
  // settings, agreement across and n up, tinted by how many submissions each has had; empty cells are
  // settings nobody has posted. Every dot opens its post.
  const CERT_VIEWS = [["growth", "How counts grow"], ["tried", "What's been tried"]];
  // Rates other than these share one grey, named "other rates" in the key.
  const RATE_HUES = { "1/8": "r18", "1/4": "r14", "1/2": "r12" };
  let certView = "growth";
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
    function growth(W) {
      const padL = 52, padR = 70, padT = 30, padB = 42, H = Math.round(Math.min(440, Math.max(320, W * 0.45)));
      const ns = [...sizes].reverse(), x0 = Math.log2(ns[0]), x1 = Math.log2(ns[ns.length - 1]);
      // The scale fits the best counts; the few weaker submissions below it are left off and counted.
      const per = [...cells.values()].map((h) => bestOf(h).per_n), y0 = Math.floor(Math.log10(Math.min(...per))), y1 = Math.ceil(Math.log10(Math.max(...per)));
      const below = subs.filter((i) => Math.log10(i.per_n) < y0).length;
      const X = (n) => padL + ((Math.log2(n) - x0) / (x1 - x0 || 1)) * (W - padL - padR);
      const Y = (v) => padT + (1 - (Math.log10(v) - y0) / (y1 - y0 || 1)) * (H - padT - padB);
      const svg = svgEl("svg", { class: "board-svg certmap-svg", viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": "Best bad challenges per point of the domain as n grows, one line per rate and agreement" });
      const text = (cls, x, y, words, anchor = "middle", into = svg) => { const t = svgEl("text", { class: cls, x, y, "text-anchor": anchor }); t.textContent = words; into.append(t); return t; };
      for (let e = y0; e <= y1; e++) {
        for (const m of [1, 2, 5]) {
          const v = m * 10 ** e;
          if (v > 10 ** y1) break;
          svg.append(svgEl("line", { class: "board-grid", x1: padL, x2: W - padR, y1: Y(v), y2: Y(v), opacity: m === 1 ? 1 : 0.45 }));
          text("board-axis", padL - 8, Y(v) + 4, thousands(v), "end");
        }
      }
      // Narrow, every other size is named.
      ns.forEach((n, k) => { if (W >= 560 || k % 2 === 0) text("board-axis", X(n), H - padB + 18, thousands(n)); });
      text("board-axis", W - padR, H - 6, "n, the size of the domain →", "end");
      text("board-axis", 0, 12, "↑ bad challenges per point", "start");
      if (below) guide.append(` ${nOf(below, "weaker submission")} below ${thousands(10 ** y0)} per point ${below === 1 ? "is" : "are"} left off.`);
      const groups = [], labels = [];
      for (const c of cols) {
        const mine = subs.filter((i) => colOf(i) === c);
        const pts = [...new Set(mine.map((i) => i.n))].sort((a, b) => a - b).map((n) => bestOf(cells.get(`${c} ${n}`)));
        const g = svgEl("g", { class: `certmap-series is-${hue(c)}` });
        for (const i of mine) if (!pts.includes(i) && Math.log10(i.per_n) >= y0) g.append(dot(i, X(i.n), Y(i.per_n), 2.4, "certmap-sub"));
        if (pts.length > 1) {
          g.append(svgEl("path", { class: "certmap-line", d: pts.map((i, k) => `${k ? "L" : "M"}${X(i.n).toFixed(1)} ${Y(i.per_n).toFixed(1)}`).join(" ") }));
          const last = pts[pts.length - 1];
          labels.push({ g, c, x: X(last.n) + 8, y: Y(last.per_n) + 4 });
        }
        for (const i of pts) g.append(dot(i, X(i.n), Y(i.per_n), 4, "certmap-best"));
        const on = () => { svg.classList.add("is-focus"); g.classList.add("is-lit"); showLine(c, pts); };
        const off = () => { svg.classList.remove("is-focus"); g.classList.remove("is-lit"); };
        g.addEventListener("pointerenter", on); g.addEventListener("pointerleave", off);
        groups.push(g);
      }
      // Line labels at their right ends, nudged apart where they would overlap.
      labels.sort((a, b) => a.y - b.y);
      labels.forEach((l, k) => { if (k && l.y - labels[k - 1].y < 13) l.y = labels[k - 1].y + 13; text("certmap-label", l.x, l.y, l.c.split("|")[1], "start", l.g); });
      svg.append(...groups);
      return svg;
    }
    function tried(W) {
      const padL = 74, padR = 8, padT = 30, axis = 34, GAP = 6;
      const colW = (W - padL - padR) / cols.length, perRow = Math.max(1, Math.floor((colW - 12) / GAP));
      const rowH = new Map(sizes.map((n) => [n, Math.max(36, 16 + GAP * Math.max(1, ...cols.map((c) => Math.ceil((cells.get(`${c} ${n}`) || []).length / perRow))))]));
      const rowTop = new Map();
      let y = padT;
      for (const n of sizes) { rowTop.set(n, y); y += rowH.get(n); }
      const H = y + axis, most = Math.log(Math.max(...[...cells.values()].map((h) => h.length)));
      const svg = svgEl("svg", { class: "board-svg certmap-svg is-grid", viewBox: `0 0 ${W} ${H}`, width: W, role: "group", "aria-label": "Certified submissions by rate, agreement and size" });
      const text = (cls, x, y, words, anchor = "middle") => { const t = svgEl("text", { class: cls, x, y, "text-anchor": anchor }); t.textContent = words; svg.append(t); return t; };
      const rowLabel = new Map(), colLabel = new Map();
      for (const n of sizes) {
        const top = rowTop.get(n);
        svg.append(svgEl("line", { class: "board-grid", x1: padL, x2: W - padR, y1: top, y2: top }));
        rowLabel.set(n, text("board-axis", padL - 8, top + rowH.get(n) / 2 + 4, `n = ${thousands(n)}`, "end"));
      }
      text("board-axis", padL - 8, padT - 12, "rate", "end");
      text("board-axis", padL - 8, H - 10, "agreement", "end");
      cols.forEach((c, x) => {
        const [rate, agree] = c.split("|"), left = padL + x * colW;
        colLabel.set(c, text("board-axis", left + colW / 2, H - 10, agree));
        // A new rate starts a group: a rule down the grid and the rate above it.
        if (!x || cols[x - 1].split("|")[0] !== rate) {
          svg.append(svgEl("line", { class: "board-grid", x1: left, x2: left, y1: padT - 22, y2: H - axis }));
          text(`certmap-rate is-${hue(c)}`, left + 4, padT - 12, rate, "start");
        }
        for (const n of sizes) {
          const here = cells.get(`${c} ${n}`);
          if (!here) continue;
          const top = rowTop.get(n), h = rowH.get(n), c0 = Math.min(perRow, here.length), r0 = Math.ceil(here.length / perRow);
          const g = svgEl("g", { class: "certmap-g", style: `--heat: ${Math.round(6 + (most ? Math.log(here.length) / most : 1) * 30)}%` });
          g.append(svgEl("rect", { class: "certmap-cell", x: left + 2, y: top + 2, width: colW - 4, height: h - 4, rx: 7 }));
          here.forEach((i, k) => g.append(dot(i, left + colW / 2 + ((k % perRow) - (c0 - 1) / 2) * GAP, top + h / 2 + (Math.floor(k / perRow) - (r0 - 1) / 2) * GAP, 2.3, `certmap-dot${i.leading ? " is-lead" : ""}`)));
          const on = (lit) => { rowLabel.get(n).classList.toggle("is-on", lit); colLabel.get(c).classList.toggle("is-on", lit); if (lit) showCell(here); };
          g.addEventListener("pointerenter", () => on(true)); g.addEventListener("pointerleave", () => on(false));
          svg.append(g);
        }
      });
      return svg;
    }
    const GUIDES = {
      growth: "Each line follows one rate and agreement as n grows, through the best count per point at each size: level means the count grows in step with n, falling means slower. Colour is the rate; the label at a line's end is its agreement. Faint dots are the other submissions.",
      tried: "Each cell is a setting someone has posted; darker cells have had more submissions, and each dot is one, filled where it leads. Empty cells are untried. Agreement 5/8+1 means A = 5n/8 + 1.",
    };
    let drawn = 0;
    const draw = (force) => {
      const W = Math.round(plot.clientWidth || 900);
      if (W === drawn && !force) return;
      drawn = W;
      guide.textContent = GUIDES[certView];
      legend.replaceChildren(...(certView === "growth"
        ? [...Object.entries(RATE_HUES), ["other", "other"]].filter(([, k]) => cols.some((c) => hue(c) === k)).map(([r, k]) => el("span", { class: `certmap-rate-key is-${k}` }, r === "other" ? "other rates" : `rate ${r}`))
        : [el("i", { class: "is-lead", "aria-hidden": "true" }), "leads its setting", el("i", { "aria-hidden": "true" }), "other submission"]));
      // ponytail: below 820px the grid scrolls sideways rather than reflowing.
      plot.replaceChildren(certView === "growth" ? growth(Math.max(320, W)) : tried(Math.max(820, W)));
      // Where the grid scrolls, it opens on rate 1/2, where most of the work is.
      plot.scrollLeft = plot.scrollWidth;
    };
    for (const [key, name] of CERT_VIEWS) {
      const button = el("button", { type: "button", class: "chip", "aria-pressed": String(key === certView) }, name);
      button.addEventListener("click", () => {
        certView = key;
        views.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        draw(true);
      });
      views.append(button);
    }
    show(subs[subs.length - 1]);
    // What good looks like, with the lines still rising at their largest n named from the data.
    const rising = cols.filter((c) => {
      const pts = sizes.filter((n) => cells.has(`${c} ${n}`)).slice(0, 2).map((n) => bestOf(cells.get(`${c} ${n}`)).per_n);
      return pts.length === 2 && pts[0] > pts[1];
    });
    const aim = el("p", { class: "regime-aim" }, el("b", {}, "The aim: "),
      "lift a line. Each point is the most bad challenges anyone has built at that size, so a higher point is a stronger lower bound. A line that keeps rising as n grows would refute T3's linear bound; one that stays level is consistent with it. ",
      rising.length ? ["Still rising at its largest n: ", el("b", {}, rising.map((c) => where(c).toLowerCase()).join("; ")), ". Try the next size up. "] : null,
      "Or extend a short line to a new n, or pick an empty cell in What's been tried.");
    root.append(caption, views, guide, aim, plot, read);
    requestAnimationFrame(() => draw());
    if ("ResizeObserver" in window) new ResizeObserver(() => draw()).observe(plot);
    return root;
  }
  function homeLive(record) {
    const node = $("home-live");
    if (!node) return;
    const rows = record.contributions || [];
    node.textContent = `Live · ${nOf((record.targets || []).length, "target")} · ${nOf(rows.length, "contribution")} · ${nOf(contributors(crewOf(record)).length, "contributor")}`;
  }
  let recordLoad = null;
  function loadRecord() {
    recordLoad ||= fetch("data/mathematics.json", { cache: "no-cache" }).then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    });
    return recordLoad;
  }
  // Rules v2's two panels as one table, a row per cell: on the left, every bound or cap posted for the
  // cell, how far it is checked and what it limits; on the right, the cell's best known count and
  // whether records still pay there (saturated where the cell is closed). Only the left one moves the
  // query numbers. Data: the record's cells and upper_bounds (targets.json), with the certified count
  // behind each best known figure from the records route.
  const checkedWord = (status) => (/unreviewed|none/i.test(status) ? "unreviewed" : /conditional/i.test(status) ? "conditional"
    : /reproduced/i.test(status) ? "reproduced" : /accepted|reviewed/i.test(status) ? "reviewed" : "unreviewed");
  // "h^2/4 + m + 1" with its exponent raised.
  const mathText = (text) => String(text).split(/\^(\w+)/).map((part, i) => (i % 2 ? el("sup", {}, part) : part));
  // "11,831 at n = 1,024": the figure, then where it holds.
  const BOUND_SPLIT = /^(.*?)\s+((?:when|if|at)\s.*)$/;
  function boundLine(b) {
    const [, head, tail] = BOUND_SPLIT.exec(b.value) || [null, b.value, ""];
    const checked = checkedWord(b.status || "");
    return el("li", { class: "bounds-cap", title: `${b.mechanism}: ${b.status}` },
      el("span", { class: "bounds-val" }, el("b", {}, ...mathText(head)), tail ? ` ${tail}` : ""),
      el("span", { class: `bounds-tag is-${checked}` }, checked), el("small", {}, /regime/i.test(b.kind || "") ? "a regime" : "one construction"));
  }
  const perN = (x) => (x >= 100 ? Math.round(x).toLocaleString("en-GB") : String(Math.round(x * 100) / 100));
  const STATE_WORDS = { closed: "saturated", "refutation-only": "pays above 16 n", open: "open" };
  const STATE_TITLES = { closed: "saturated, closed for records", "refutation-only": "only a count above 16 n earns a record", open: "open for records" };
  async function renderBounds(record) {
    const root = $("bounds-board");
    if (!root) return;
    const bounds = (record.upper_bounds || []).filter((b) => b.value);
    const every = (record.upper_bounds || []).find((b) => /proven bound on E/i.test(b.kind || "") && b.value);
    const open = $("bounds-open");
    if (open && every) open.textContent = `A proven bound on E: ${every.value}.`;
    // The one task the maintainers most want done this week, when the rules name one, with the thread
    // of the statement ranked first.
    const week = $("bounds-week"), ask = record.rules?.contribution_of_the_week;
    if (week && typeof ask === "string" && ask) {
      const first = [...(record.statements || [])].sort((a, b) => a.rank - b.rank).find((st) => THREAD.test(st.source || ""));
      week.replaceChildren(el("b", {}, "Contribution of the week: "), `${ask}.`, ...(first ? [" ", el("a", { href: `/threads/${first.source}` }, "The thread")] : []));
      week.hidden = false;
    }
    const sources = new Map();
    const rows = (record.cells || []).map((c) => {
      const mine = bounds.filter((b) => b.cell === c.id);
      const source = el("small", { class: "bounds-source" });
      sources.set(c, source);
      return el("tr", { class: `is-${c.state}` },
        el("th", { scope: "row", class: "bounds-cell" }, el("b", {}, c.code === "RS" ? c.field : `${c.code} ${c.field}`), el("small", {}, `rate ${c.rate} · gap ${c.gap}`)),
        el("td", { class: "is-upper" }, mine.length ? el("ul", { class: "bounds-caps" }, mine.map(boundLine)) : el("span", { class: "bounds-none" }, "nothing posted yet")),
        el("td", { class: "is-lower" }, el("span", { class: "bounds-low" },
          el("span", { class: "bounds-count" }, typeof c.best_known_per_n === "number" ? el("span", {}, el("b", {}, perN(c.best_known_per_n)), " n") : el("span", { class: "bounds-none" }, "no count yet"), source),
          el("span", { class: `bounds-state is-${c.state}`, title: STATE_TITLES[c.state] || "" }, STATE_WORDS[c.state] || c.state))));
    });
    const head = el("tr", {}, el("th", { scope: "col", class: "bounds-cell" }, "Cell"),
      el("th", { scope: "col", class: "is-upper" }, el("span", { class: "bounds-th" }, "Proven above"), el("small", {}, "Upper bounds")),
      el("th", { scope: "col", class: "is-lower" }, el("span", { class: "bounds-th" }, "Built below"), el("small", {}, "Best known count")));
    root.replaceChildren(el("table", { class: "bounds-table" }, el("thead", {}, head), el("tbody", {}, rows)));
    // The certified count behind each best known figure, linked to its post: a bulletin post named by
    // its id's prefix, or a contribution on the record by its own thread.
    try {
      const response = await fetch("/api/participation/bulletin/records?topic=MATHEMATICS", { cache: "no-cache" });
      const live = response.ok ? await response.json() : {};
      const posts = (live.parameters || []).filter((q) => q && q.best && typeof q.best.post_id === "string");
      for (const [c, slot] of sources) {
        const id = c.best_known_source || "";
        const post = /^bp1_[0-9a-f]+$/.test(id) && posts.find((q) => q.best.post_id.startsWith(id));
        const row = (record.contributions || []).find((r) => r.id === id);
        if (post && THREAD.test(post.best.thread_id)) {
          slot.replaceChildren(el("a", { href: `/threads/${post.best.thread_id}#${post.best.post_id}` }, `${thousands(post.best.certified)} at n = ${thousands(post.n)}`));
        } else if (row && THREAD.test(row.thread || "")) {
          slot.replaceChildren(el("a", { href: `/threads/${row.thread}` }, row.id));
        }
      }
    } catch { /* the figures stand without their links */ }
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
    root.replaceChildren(el("h3", { class: "record-group-title" }, el("span", { class: "record-target" }, "cells"), "Where a count still earns a record"),
      el("ol", { class: "record-list" }, rows),
      el("h3", { class: "record-group-title", id: "statements" }, el("span", { class: "record-target" }, "prove"), "Statements ranked first"),
      el("ol", { class: "record-list" }, asks));
  }
  async function renderMathematics() {
    try {
      const [record, profiles] = await Promise.all([loadRecord(), loadProfiles()]);
      record.profiles = profiles;
      renderRecord(record);
      renderTargets(record);
      renderNewest(record);
      renderProgress(record);
      renderBounds(record);
      renderCells(record);
      renderCrew(record);
      homeLive(record);
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
